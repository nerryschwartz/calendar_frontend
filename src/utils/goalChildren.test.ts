import { expect, it } from "vitest";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type DraftEdit,
} from "../api/types";
import { planDetail } from "../test/plan";
import {
  goalChildren,
  normalizeChildOrders,
  type ChildOrderEdit,
} from "./goalChildren";
import { orderSaveEdits } from "./savePlanDrafts";
import { removeDraftWithDependents, resolveDraftEditRefs } from "./planDrafts";

const parent = persistedPlanRef("plan-1");
const create: DraftEdit = {
  type: "createChild",
  draftId: "new",
  parentRef: parent,
  body: { name: "New child", kind: "TASK", is_critical: false },
};
const order: ChildOrderEdit = {
  type: "reorderChildren",
  planRef: parent,
  criticalRefs: [persistedPlanRef("b")],
  nonCriticalRefs: [persistedPlanRef("a")],
  previousChildRefs: [persistedPlanRef("a"), persistedPlanRef("b")],
};
const plan = planDetail({
  children: [
    {
      plan_id: "a",
      name: "A",
      plan_kind: "TASK",
      goal_is_critical: true,
      goal_sort_order: 0,
    },
    {
      plan_id: "b",
      name: "B",
      plan_kind: "GOAL",
      goal_is_critical: false,
      goal_sort_order: 0,
    },
  ],
});

it("projects critical changes and appends queued children while excluding queued deletions", () => {
  const edits: DraftEdit[] = [
    order,
    create,
    { type: "delete", planRef: persistedPlanRef("a") },
    { type: "rename", planRef: draftPlanRef("new"), name: "Renamed" },
  ];
  expect(
    goalChildren(plan, parent, edits).map((child) => [
      child.name,
      child.critical,
    ]),
  ).toEqual([
    ["B", true],
    ["Renamed", false],
  ]);
  expect(normalizeChildOrders(edits)[0]).toMatchObject({
    criticalRefs: [persistedPlanRef("b")],
    nonCriticalRefs: [draftPlanRef("new")],
  });
});

it("orders creates and relevant deletions before the atomic parent reorder", () => {
  const deletion: DraftEdit = {
    type: "delete",
    planRef: persistedPlanRef("a"),
  };
  const result = orderSaveEdits([order, create, deletion]);
  expect(result.map((edit) => edit.type)).toEqual([
    "createChild",
    "delete",
    "reorderChildren",
  ]);
  expect(result[2]).toMatchObject({ nonCriticalRefs: [draftPlanRef("new")] });
});

it("coalesces parent orders and retains other parents and cancellation-safe refs", () => {
  const next = {
    ...order,
    nonCriticalRefs: [draftPlanRef("new")],
    criticalRefs: [],
  };
  const other = { ...order, planRef: templatePlanRef(draftPlanRef("repeat")) };
  expect(normalizeChildOrders([create, order, other, next])).toEqual([
    create,
    other,
    next,
  ]);
  expect(removeDraftWithDependents([create, next], 0)).toMatchObject([
    { type: "reorderChildren", nonCriticalRefs: [] },
  ]);
  expect(
    resolveDraftEditRefs(next, new Map([["new", "saved-new"]])),
  ).toMatchObject({ nonCriticalRefs: [persistedPlanRef("saved-new")] });
});
