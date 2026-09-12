import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyDraftEdits, DraftEditApplyError, validatePlans } from "./plans";
import { refreshSchedule } from "./schedule";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type RefreshScheduleResult,
  type DraftEdit,
} from "./types";

const refreshResult: RefreshScheduleResult = {
  run_started_at: "2026-08-23T17:00:00.000Z",
  resolved_blocks: null,
  block_assignment: null,
  resolved: null,
  assignment: null,
  free_time: null,
};

describe("plan draft API calls", () => {
  it("resolves a first-instance template after a subtype create response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/children")
        ? { plan_id: "repeat", template_root_id: "template" }
        : url.endsWith("/repeat")
          ? { repetition_detail: { template_root_id: "template" } }
          : {};
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal("fetch", fetchMock);
    await applyDraftEdits([
      {
        type: "createChild",
        draftId: "repeat",
        parentRef: persistedPlanRef("master"),
        body: { name: "Lunch", kind: "REPETITION", is_critical: false },
      },
      {
        type: "addConstraintGroup",
        planRef: templatePlanRef(draftPlanRef("repeat")),
        body: {
          windows: [
            {
              start_time: "2026-09-12T16:00:00Z",
              end_time: "2026-09-12T20:00:00Z",
            },
          ],
        },
      },
    ]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/plans/template/constraints/groups"),
      expect.anything(),
    );
  });
  it("saves queued repetition settings to the resolved plan", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({}), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await applyDraftEdits([
      {
        type: "repetitionSettings",
        planRef: persistedPlanRef("repeat-1"),
        body: { repeat_interval_minutes: 720 },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/repetitions/repeat-1/settings"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ repeat_interval_minutes: 720 }),
      }),
    );
  });
  it("retries failed constraints using the child already created on the previous attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ plan_id: "created-id" }), {
          status: 200,
        }),
      )
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const edits: DraftEdit[] = [
      {
        type: "createChild",
        draftId: "new-child",
        parentRef: persistedPlanRef("parent"),
        body: { kind: "TASK", name: "Child", is_critical: false },
      },
      {
        type: "addConstraintGroup",
        planRef: draftPlanRef("new-child"),
        body: {
          windows: [
            {
              start_time: "2026-09-10T10:00:00Z",
              end_time: "2026-09-10T11:00:00Z",
            },
          ],
        },
      },
    ];
    let failed: DraftEditApplyError | undefined;
    try {
      await applyDraftEdits(edits);
    } catch (error) {
      failed = error as DraftEditApplyError;
    }
    expect(failed?.appliedCount).toBe(1);
    expect(failed?.remainingEdits?.[0]).toMatchObject({
      planRef: persistedPlanRef("created-id"),
    });
    await applyDraftEdits(failed!.remainingEdits!);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/plans/created-id/constraints/groups"),
      expect.anything(),
    );
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a queued non-critical goal child before validate and refresh", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      const input = String(_input);
      const body = input.includes("/children")
        ? {
            plan_id: "created-plan-id",
            name: "Generic goal",
            plan_kind: "GOAL",
            is_master: false,
            parent_id: "master-plan-id",
          }
        : refreshResult;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await applyDraftEdits([
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
    await validatePlans();
    await refreshSchedule();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/plans/master-plan-id/children"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "GOAL",
          is_critical: false,
          name: "Generic goal",
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/plans/validate"),
      {
        method: "POST",
        headers: undefined,
        body: undefined,
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/schedule/refresh"),
      {
        method: "POST",
        headers: undefined,
        body: undefined,
      },
    );
  });

  it("resolves a queued child as the parent for another queued child", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const createdId = url.includes("/api/plans/master-plan-id/children")
        ? "created-parent-id"
        : "created-child-id";
      return new Response(
        JSON.stringify({
          plan_id: createdId,
          name: "Created plan",
          plan_kind: "GOAL",
          is_master: false,
          parent_id: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await applyDraftEdits([
      {
        type: "createChild",
        draftId: "draft-parent",
        parentRef: persistedPlanRef("master-plan-id"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Parent draft",
        },
      },
      {
        type: "createChild",
        draftId: "draft-child",
        parentRef: draftPlanRef("draft-parent"),
        body: {
          kind: "GOAL",
          is_critical: false,
          name: "Child draft",
        },
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/plans/master-plan-id/children"),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/plans/created-parent-id/children"),
      expect.any(Object),
    );
  });
});
