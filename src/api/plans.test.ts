import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyDraftEdits, validatePlans } from "./plans";
import { refreshSchedule } from "./schedule";
import type { RefreshScheduleResult } from "./types";

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
      return new Response(JSON.stringify(refreshResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await applyDraftEdits([
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
});
