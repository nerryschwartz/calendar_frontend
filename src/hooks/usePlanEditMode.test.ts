import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DraftEditApplyError,
  applyDraftEdits,
  validatePlans,
} from "../api/plans";
import { refreshSchedule } from "../api/schedule";
import {
  ApiError,
  persistedPlanRef,
  type RefreshScheduleResult,
} from "../api/types";
import { usePlanEditMode } from "./usePlanEditMode";

vi.mock("../api/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/plans")>();
  return {
    ...actual,
    applyDraftEdits: vi.fn(),
    validatePlans: vi.fn(),
  };
});

vi.mock("../api/schedule", () => ({
  refreshSchedule: vi.fn(),
}));

const applyDraftEditsMock = vi.mocked(applyDraftEdits);
const validatePlansMock = vi.mocked(validatePlans);
const refreshScheduleMock = vi.mocked(refreshSchedule);

const refreshResult: RefreshScheduleResult = {
  run_started_at: "2026-08-23T17:00:00.000Z",
  resolved_blocks: null,
  block_assignment: null,
  resolved: null,
  assignment: null,
  free_time: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("usePlanEditMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyDraftEditsMock.mockImplementation(async (edits) => edits.length);
    validatePlansMock.mockResolvedValue({ status: "ok" });
    refreshScheduleMock.mockResolvedValue(refreshResult);
  });

  it("queues non-critical goal child drafts without calling backend APIs", () => {
    const { result } = renderHook(() => usePlanEditMode());

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "createChild",
        draftId: "draft-goal",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        },
      });
    });

    expect(result.current.draftEdits).toEqual([
      {
        type: "createChild",
        draftId: "draft-goal",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        },
      },
    ]);
    expect(applyDraftEditsMock).not.toHaveBeenCalled();
    expect(validatePlansMock).not.toHaveBeenCalled();
    expect(refreshScheduleMock).not.toHaveBeenCalled();
  });

  it("finishes saving non-critical goal child drafts before refresh resolves", async () => {
    const onSaved = vi.fn();
    const callOrder: string[] = [];
    const refresh = deferred<RefreshScheduleResult>();

    applyDraftEditsMock.mockImplementation(async () => {
      callOrder.push("apply");
      return 1;
    });
    validatePlansMock.mockImplementation(async () => {
      callOrder.push("validate");
      return { status: "ok" };
    });
    refreshScheduleMock.mockImplementation(async () => {
      callOrder.push("refresh");
      return refresh.promise;
    });

    const { result } = renderHook(() => usePlanEditMode({ onSaved }));

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "createChild",
        draftId: "draft-goal",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        },
      });
    });

    await act(async () => {
      await result.current.saveEdits();
    });

    expect(applyDraftEditsMock).toHaveBeenCalledWith([
      {
        type: "createChild",
        draftId: "draft-goal",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        },
      },
    ]);
    expect(callOrder).toEqual(["apply", "validate", "refresh"]);

    await waitFor(() => {
      expect(result.current.editMode).toBe(false);
    });
    expect(result.current.draftEdits).toEqual([]);
    expect(result.current.saving).toBe(false);
    expect(result.current.refreshingSchedule).toBe(true);
    expect(onSaved).toHaveBeenCalledWith({
      editCount: 1,
    });

    await act(async () => {
      refresh.resolve(refreshResult);
      await refresh.promise;
    });

    await waitFor(() => {
      expect(result.current.refreshingSchedule).toBe(false);
    });
    expect(result.current.refreshResult).toEqual(refreshResult);
  });

  it("keeps saved edits discarded when the separate refresh fails", async () => {
    const refresh = deferred<RefreshScheduleResult>();
    refreshScheduleMock.mockReturnValue(refresh.promise);

    const { result } = renderHook(() => usePlanEditMode());

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "createChild",
        draftId: "draft-goal",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        },
      });
    });

    await act(async () => {
      await result.current.saveEdits();
    });

    expect(result.current.editMode).toBe(false);
    expect(result.current.draftEdits).toEqual([]);

    await act(async () => {
      refresh.reject(new Error("Refresh was too slow"));
      await refresh.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.refreshingSchedule).toBe(false);
    });
    expect(result.current.editMode).toBe(false);
    expect(result.current.draftEdits).toEqual([]);
    expect(result.current.error?.errors[0]?.message).toBe(
      "Refresh was too slow",
    );
    expect(result.current.successMessage).toBe(
      "Saved 1 edit(s), but schedule refresh failed",
    );
  });

  it("clears a successful delete draft and exits edit mode when validation fails", async () => {
    const validationError = new ApiError({
      errors: [
        {
          code: "VALIDATION_FAILED",
          message: "Plan graph is invalid",
          details: {},
        },
      ],
    });
    validatePlansMock.mockRejectedValue(validationError);

    const { result } = renderHook(() => usePlanEditMode());

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "delete",
        planRef: persistedPlanRef("deleted-plan-id"),
      });
    });

    await act(async () => {
      await result.current.saveEdits();
    });

    expect(applyDraftEditsMock).toHaveBeenCalledWith([
      { type: "delete", planRef: persistedPlanRef("deleted-plan-id") },
    ]);
    expect(validatePlansMock).toHaveBeenCalledTimes(1);
    expect(refreshScheduleMock).not.toHaveBeenCalled();
    expect(result.current.editMode).toBe(false);
    expect(result.current.draftEdits).toEqual([]);
    expect(result.current.error).toBe(validationError.detail);
  });

  it("removes only applied draft edits when a later edit fails", async () => {
    const failedEditError = new ApiError({
      errors: [
        {
          code: "SAVE_FAILED",
          message: "Second edit failed",
          details: {},
        },
      ],
    });
    applyDraftEditsMock.mockRejectedValue(
      new DraftEditApplyError(failedEditError, 1),
    );

    const { result } = renderHook(() => usePlanEditMode());

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "rename",
        planRef: persistedPlanRef("first-plan-id"),
        name: "Applied rename",
      });
      result.current.queueEdit({
        type: "delete",
        planRef: persistedPlanRef("second-plan-id"),
      });
    });

    await act(async () => {
      await result.current.saveEdits();
    });

    expect(validatePlansMock).not.toHaveBeenCalled();
    expect(refreshScheduleMock).not.toHaveBeenCalled();
    expect(result.current.editMode).toBe(true);
    expect(result.current.draftEdits).toEqual([
      { type: "delete", planRef: persistedPlanRef("second-plan-id") },
    ]);
    expect(result.current.error).toBe(failedEditError.detail);
  });
});
