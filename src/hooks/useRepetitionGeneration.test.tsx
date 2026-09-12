import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type DraftEdit,
} from "../api/types";
import { usePlanEditMode } from "./usePlanEditMode";

beforeEach(() => vi.restoreAllMocks());
function fixture(
  options: {
    constraintFailure?: boolean;
    uncertain?: boolean;
    refreshFailure?: boolean;
  } = {},
) {
  let generated = false;
  let fail = options.constraintFailure;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/schedule/refresh") && options.refreshFailure)
      throw new Error("Refresh offline");
    if (url.endsWith("/generate-instances")) {
      generated = true;
      if (options.uncertain) throw new Error("Response lost");
    }
    if (url.includes("/constraints/") && fail) {
      fail = false;
      throw new Error("Window offline");
    }
    const body = url.endsWith("/children")
      ? { plan_id: "repeat", template_root_id: "template" }
      : url.endsWith("/generation-status")
        ? {
            repetitions: [
              {
                plan_id: "repeat",
                generated_at: generated ? "now" : null,
                instance_count: generated ? 14 : 0,
              },
            ],
          }
        : url.endsWith("/repeat")
          ? {
              children: [],
              repetition_detail: {
                template_root_id: "template",
                generated_at: generated ? "now" : null,
              },
            }
          : { children: [], ancestry: [] };
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const edits: DraftEdit[] = [
  {
    type: "createChild",
    draftId: "new",
    parentRef: persistedPlanRef("master"),
    body: { kind: "REPETITION", name: "Lunch", is_critical: false },
  },
  {
    type: "addConstraintGroup",
    planRef: templatePlanRef(draftPlanRef("new")),
    body: {
      windows: [
        {
          start_time: "2026-09-12T16:00:00Z",
          end_time: "2026-09-12T20:00:00Z",
        },
      ],
    },
  },
  {
    type: "addPrerequisite",
    planRef: persistedPlanRef("other"),
    prerequisitePlanRef: draftPlanRef("new"),
  },
];
it("generates only selected work and remaps an unrelated prerequisite", async () => {
  const fetchMock = fixture();
  const { result } = renderHook(() => usePlanEditMode());
  act(() => edits.forEach(result.current.queueEdit));
  await act(() => result.current.generateInstances(draftPlanRef("new")));
  expect(result.current.draftEdits).toEqual([
    { ...edits[2], prerequisitePlanRef: persistedPlanRef("repeat") },
  ]);
  expect(result.current.successMessage).toContain("14 instance(s)");
  expect(
    fetchMock.mock.calls.some(([url]) => String(url).includes("/other/")),
  ).toBe(false);
});
it("preserves only unapplied work after failure and does not recreate a repetition", async () => {
  const fetchMock = fixture({ constraintFailure: true });
  const { result } = renderHook(() => usePlanEditMode());
  act(() => edits.forEach(result.current.queueEdit));
  await act(() => result.current.generateInstances(draftPlanRef("new")));
  expect(result.current.draftEdits).toHaveLength(2);
  expect(result.current.draftEdits[0]).toMatchObject({
    planRef: templatePlanRef(persistedPlanRef("repeat")),
  });
  await act(() => result.current.generateInstances(persistedPlanRef("repeat")));
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/children")),
  ).toHaveLength(1);
  expect(result.current.error).toBeNull();
});
it("recovers an uncertain generation response and ignores duplicate clicks", async () => {
  const fetchMock = fixture({ uncertain: true });
  const { result } = renderHook(() => usePlanEditMode());
  await act(async () => {
    const first = result.current.generateInstances(persistedPlanRef("repeat"));
    const second = result.current.generateInstances(persistedPlanRef("repeat"));
    await first;
    await second;
  });
  expect(result.current.error).toBeNull();
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/generate-instances"),
    ),
  ).toHaveLength(1);
});
it("keeps generation complete if schedule refresh fails", async () => {
  const fetchMock = fixture({ refreshFailure: true });
  const { result } = renderHook(() => usePlanEditMode());
  await act(() =>
    result.current.generateInstances(draftPlanRef("new"), edits.slice(0, 2)),
  );
  expect(result.current.draftEdits).toEqual([]);
  expect(result.current.successMessage).toContain("schedule refresh failed");
  expect(result.current.error?.errors[0].message).toBe("Refresh offline");
  await act(() => result.current.generateInstances(persistedPlanRef("repeat")));
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/generate-instances"),
    ),
  ).toHaveLength(1);
});
it("does not refresh while an unrelated pending repetition remains a blocker", async () => {
  const fetchMock = fixture();
  const { result } = renderHook(() => usePlanEditMode());
  const other: DraftEdit = {
    type: "createChild",
    draftId: "other",
    parentRef: persistedPlanRef("master"),
    body: { kind: "REPETITION", name: "Later", is_critical: false },
  };
  act(() => result.current.queueEdit(other));
  await act(() =>
    result.current.generateInstances(draftPlanRef("new"), edits.slice(0, 2)),
  );
  expect(result.current.draftEdits).toEqual([other]);
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/schedule/refresh"),
    ),
  ).toHaveLength(0);
});
