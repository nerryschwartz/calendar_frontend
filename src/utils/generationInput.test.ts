import { expect, it } from "vitest";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type DraftEdit,
} from "../api/types";
import {
  generationBaseline,
  generationInput,
  generationIsFresh,
} from "./generationInput";
import {
  allPendingPlans,
  generatedLinkState,
  pendingPlans,
  type GenerationEdit,
} from "./generatedPlans";
import { removeDraftWithDependents } from "./planDrafts";
import { mockGenerationPreview, repetitionCreate } from "../test/repetition";

async function batchFor(
  edits: DraftEdit[] = [repetitionCreate],
): Promise<GenerationEdit> {
  const { baseline, sourceRefs } = await generationBaseline(
    draftPlanRef("repeat"),
    edits,
  );
  const input = generationInput(baseline, sourceRefs, edits);
  return {
    type: "generateInstances",
    planRef: draftPlanRef("repeat"),
    baseline,
    sourceRefs,
    preview: mockGenerationPreview(input),
  };
}
it("invalidates semantic template/settings edits and restores freshness when removed", async () => {
  const batch = await batchFor();
  const unrelated: DraftEdit = {
    type: "rename",
    planRef: persistedPlanRef("other"),
    name: "Other",
  };
  const changed: DraftEdit = {
    type: "taskScheduling",
    planRef: templatePlanRef(draftPlanRef("repeat")),
    body: { duration_minutes: 45 },
  };
  expect(generationIsFresh(batch, [repetitionCreate, batch, unrelated])).toBe(
    true,
  );
  expect(generationIsFresh(batch, [repetitionCreate, batch, changed])).toBe(
    false,
  );
  expect(generationIsFresh(batch, [repetitionCreate, batch])).toBe(true);
  expect(
    generationIsFresh(batch, [
      repetitionCreate,
      batch,
      {
        type: "repetitionSettings",
        planRef: draftPlanRef("repeat"),
        body: { manual_count: 3 },
      },
    ]),
  ).toBe(false);
});
it("derives subtree detachment and removes generated dependencies during regeneration", async () => {
  const goal: DraftEdit = {
    ...repetitionCreate,
    body: { ...repetitionCreate.body, template_type: "GOAL" },
  };
  const child: DraftEdit = {
    type: "createChild",
    draftId: "child",
    parentRef: templatePlanRef(draftPlanRef("repeat")),
    body: {
      kind: "TASK",
      name: "Nested",
      duration_minutes: 10,
      is_critical: false,
    },
  };
  const batch = await batchFor([goal, child]);
  const all = [goal, child, batch];
  const generated = allPendingPlans(all).filter((item) => item.generation);
  const rename: DraftEdit = {
    type: "rename",
    planRef: draftPlanRef(generated[0].draftId),
    name: "Custom",
  };
  expect(generatedLinkState(generated[1], [...all, rename])).toBe("Detached");
  expect(generatedLinkState(generated[2], [...all, rename])).toBe("Linked");
  expect(generatedLinkState(generated[1], all)).toBe("Linked");
  const dependency: DraftEdit = {
    type: "addPrerequisite",
    planRef: persistedPlanRef("outside"),
    prerequisitePlanRef: draftPlanRef(generated[1].draftId),
  };
  expect(removeDraftWithDependents([...all, rename, dependency], 2)).toEqual([
    goal,
    child,
  ]);
});

it("keeps omitted instance roots hidden after partial Save drops their original delete edits", async () => {
  const batch = await batchFor();
  const remaining: DraftEdit[] = [{ ...batch, omittedIndices: [0] }];
  expect(pendingPlans(remaining)).toHaveLength(1);
  expect(pendingPlans(remaining)[0].generation?.index).toBe(1);
});

it("builds nested repetition template graphs with canonical subtype and child metadata", async () => {
  const outer = {
    ...repetitionCreate,
    body: { ...repetitionCreate.body, template_type: "GOAL" as const },
  };
  const nested = {
    ...repetitionCreate,
    draftId: "nested",
    parentRef: templatePlanRef(draftPlanRef("repeat")),
  };
  const batch = await batchFor([outer, nested]);
  const nodes = batch.preview.input.template.nodes;
  expect(nodes[0]).toMatchObject({
    kind: "GOAL",
    duration_minutes: null,
    is_critical: null,
    sort_order: null,
  });
  expect(nodes.find((node) => node.ref === "draft:nested")).toMatchObject({
    kind: "REPETITION",
    duration_minutes: null,
    sort_order: 0,
  });
  expect(
    nodes.find((node) => node.ref === "template:draft:nested"),
  ).toMatchObject({ kind: "TASK", is_critical: null, sort_order: null });
});
