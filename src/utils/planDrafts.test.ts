import { expect, it } from "vitest";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type DraftEdit,
} from "../api/types";
import { resolveDraftEditRefs, resolvePlanRefDrafts } from "./planDrafts";

it("resolves stable generated plan, template, group and window references", () => {
  const ids = new Map([
    ["instance-node", "plan-id"],
    ["template:draft:instance-node", "template-id"],
    ["instance-group", "group-id"],
    ["instance-window", "window-id"],
  ]);
  const edit: DraftEdit = {
    type: "removeConstraintWindow",
    planRef: draftPlanRef("instance-node"),
    groupId: "instance-group",
    windowId: "instance-window",
  };
  expect(resolveDraftEditRefs(edit, ids)).toEqual({
    ...edit,
    planRef: persistedPlanRef("plan-id"),
    groupId: "group-id",
    windowId: "window-id",
  });
  expect(
    resolvePlanRefDrafts(templatePlanRef(draftPlanRef("instance-node")), ids),
  ).toEqual(persistedPlanRef("template-id"));
});
