import { beforeEach, expect, it, vi } from "vitest";
import { getPlanDeletePreview, getPlanDetail } from "./plans";
import { getRepetitionGenerationStatus } from "./repetitions";
import { repetitionReadiness } from "./repetitionReadiness";
import { draftPlanRef, persistedPlanRef, templatePlanRef, type DraftEdit } from "./types";
import { planDetail } from "../test/plan";
vi.mock("./plans", () => ({ getPlanDeletePreview: vi.fn(), getPlanDetail: vi.fn() }));
vi.mock("./repetitions", () => ({ getRepetitionGenerationStatus: vi.fn() }));
beforeEach(() => {
  vi.mocked(getRepetitionGenerationStatus).mockResolvedValue({ repetitions: [{ plan_id: "repeat", name: "Lunch", parent_id: "parent", template_root_id: "template", generated_at: null, instance_count: 0 }] });
  vi.mocked(getPlanDetail).mockResolvedValue(planDetail());
  vi.mocked(getPlanDeletePreview).mockResolvedValue({ affected_plan_ids: ["parent", "repeat"] } as Awaited<ReturnType<typeof getPlanDeletePreview>>);
});
it("finds tree-wide persisted and draft blockers, excluding templates", async () => {
  const create = (draftId: string, parentRef = persistedPlanRef("master")): DraftEdit => ({ type: "createChild", draftId, parentRef, body: { kind: "REPETITION", name: draftId, is_critical: false } });
  const result = await repetitionReadiness([create("pending"), create("blueprint", templatePlanRef(persistedPlanRef("repeat")))]);
  expect(result.blockers).toEqual([{ ref: persistedPlanRef("repeat"), name: "Lunch" }, { ref: draftPlanRef("pending"), name: "pending" }]);
});
it("expands deletion previews and cancels pending descendants before Save", async () => {
  const deletion: DraftEdit = { type: "delete", planRef: persistedPlanRef("parent") };
  const result = await repetitionReadiness([
    deletion,
    { type: "createChild", draftId: "child", parentRef: persistedPlanRef("parent"), body: { kind: "REPETITION", name: "New", is_critical: false } },
    { type: "taskScheduling", planRef: templatePlanRef(draftPlanRef("child")), body: { duration_minutes: 30 } },
  ]);
  expect(result.blockers).toEqual([]);
  expect(result.effectiveEdits).toEqual([deletion]);
});
it("never treats a failed readiness read as permission to save", async () => {
  vi.mocked(getRepetitionGenerationStatus).mockRejectedValueOnce(new Error("offline"));
  await expect(repetitionReadiness([])).rejects.toThrow("offline");
});
