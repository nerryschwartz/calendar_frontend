import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { draftPlanRef, persistedPlanRef, templatePlanRef } from "../api/types";
import { usePlanEditMode } from "./usePlanEditMode";
import { mockGenerationPreview, repetitionCreate } from "../test/repetition";
import { pendingPlans } from "../utils/generatedPlans";

beforeEach(() => vi.restoreAllMocks());
function fixture(fail = false) {
  const fetchMock = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/preview-instances")) {
        if (fail) throw new Error("Preview offline");
        return new Response(
          JSON.stringify(mockGenerationPreview(JSON.parse(String(init?.body)))),
        );
      }
      return new Response(JSON.stringify({ repetitions: [] }));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
it("previews editable instances without saving selected or unrelated queued work", async () => {
  const fetchMock = fixture();
  const { result } = renderHook(() => usePlanEditMode());
  act(() => {
    result.current.queueEdit(repetitionCreate);
    result.current.queueEdit({
      type: "rename",
      planRef: persistedPlanRef("other"),
      name: "Unrelated",
    });
    result.current.queueEdit({
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
    });
  });
  await act(() => result.current.generateInstances(draftPlanRef("repeat")));
  expect(result.current.error).toBeNull();
  expect(result.current.draftEdits).toHaveLength(4);
  expect(
    pendingPlans(result.current.draftEdits).filter((item) => item.generation),
  ).toHaveLength(2);
  expect(
    fetchMock.mock.calls.every(([url]) =>
      String(url).endsWith("/preview-instances"),
    ),
  ).toBe(true);
  expect(result.current.successMessage).toContain("nothing saved");
  act(() => result.current.discardAndExit());
  expect(result.current.draftEdits).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("preserves queued input after a failed preview and ignores concurrent Generate clicks", async () => {
  const fetchMock = fixture(true);
  const { result } = renderHook(() => usePlanEditMode());
  await act(async () => {
    const first = result.current.generateInstances(draftPlanRef("repeat"), [
      repetitionCreate,
    ]);
    const duplicate = result.current.generateInstances(draftPlanRef("repeat"), [
      repetitionCreate,
    ]);
    await first;
    await duplicate;
  });
  expect(result.current.draftEdits).toEqual([repetitionCreate]);
  expect(result.current.error?.errors[0].message).toBe("Preview offline");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
