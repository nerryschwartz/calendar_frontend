import { expect, it } from "vitest";
import { draftPlanRef, persistedPlanRef, templatePlanRef, type DraftEdit } from "../api/types";
import { generationEdits } from "./repetitionDrafts";
const create = (draftId: string, parentRef = persistedPlanRef("master"), kind: "GOAL" | "REPETITION" = "GOAL"): DraftEdit => ({ type: "createChild", draftId, parentRef, body: { name: draftId, kind, is_critical: false } });
it("selects recursive draft dependencies and template edits, not unrelated work", () => {
  const edits: DraftEdit[] = [
    create("parent"), create("unrelated"), create("repeat", draftPlanRef("parent"), "REPETITION"),
    create("prerequisite"),
    { type: "addPrerequisite", planRef: draftPlanRef("repeat"), prerequisitePlanRef: draftPlanRef("prerequisite") },
    { type: "taskScheduling", planRef: templatePlanRef(draftPlanRef("repeat")), body: { duration_minutes: 30 } },
    { type: "rename", planRef: persistedPlanRef("master"), name: "Unrelated rename" },
    { type: "addPrerequisite", planRef: draftPlanRef("unrelated"), prerequisitePlanRef: draftPlanRef("repeat") },
  ];
  expect(generationEdits(edits, draftPlanRef("repeat"))).toEqual([edits[0], edits[2], edits[3], edits[4], edits[5]]);
});
it("orders creates before dependent edits and rejects missing references", () => {
  const rename: DraftEdit = { type: "rename", planRef: draftPlanRef("repeat"), name: "Lunch" };
  const repetition = create("repeat", persistedPlanRef("master"), "REPETITION");
  expect(generationEdits([rename, repetition], draftPlanRef("repeat"))).toEqual([repetition, rename]);
  expect(() => generationEdits([rename], draftPlanRef("repeat"))).toThrow("missing");
});
it("includes persisted template subtree edits and rejects queued deletion", () => {
  const edit: DraftEdit = { type: "taskScheduling", planRef: persistedPlanRef("template-task"), body: { duration_minutes: 45 } };
  expect(generationEdits([edit], persistedPlanRef("repeat"), ["template-task"])).toEqual([edit]);
  expect(() => generationEdits([{ type: "delete", planRef: persistedPlanRef("repeat") }], persistedPlanRef("repeat"))).toThrow("deletion");
});
