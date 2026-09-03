import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyDraftEdits, validatePlans } from "./plans";
import { refreshSchedule } from "./schedule";
import {
  draftPlanRef,
  persistedPlanRef,
  type RefreshScheduleResult,
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
