import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyDraftEdits, validatePlans } from "../api/plans";
import { refreshSchedule } from "../api/schedule";
import type { RefreshScheduleResult } from "../api/types";
import { usePlanEditMode } from "./usePlanEditMode";

vi.mock("../api/plans", () => ({
  applyDraftEdits: vi.fn(),
  validatePlans: vi.fn(),
}));

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

describe("usePlanEditMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyDraftEditsMock.mockResolvedValue(undefined);
    validatePlansMock.mockResolvedValue({ status: "ok" });
    refreshScheduleMock.mockResolvedValue(refreshResult);
  });

  it("queues non-critical goal child drafts without calling backend APIs", () => {
    const { result } = renderHook(() => usePlanEditMode());

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "createChild",
        parentId: "master-plan-id",
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
        parentId: "master-plan-id",
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

  it("saves non-critical goal child drafts before validation and refresh", async () => {
    const onSaved = vi.fn();
    const callOrder: string[] = [];

    applyDraftEditsMock.mockImplementation(async () => {
      callOrder.push("apply");
    });
    validatePlansMock.mockImplementation(async () => {
      callOrder.push("validate");
      return { status: "ok" };
    });
    refreshScheduleMock.mockImplementation(async () => {
      callOrder.push("refresh");
      return refreshResult;
    });

    const { result } = renderHook(() => usePlanEditMode({ onSaved }));

    act(() => {
      result.current.enterEditMode();
      result.current.queueEdit({
        type: "createChild",
        parentId: "master-plan-id",
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
        parentId: "master-plan-id",
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
    expect(onSaved).toHaveBeenCalledWith({
      editCount: 1,
      refreshResult,
    });
  });
});
