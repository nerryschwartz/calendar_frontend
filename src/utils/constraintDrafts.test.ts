import { expect, it } from "vitest";
import { draftPlanRef, type DraftEdit } from "../api/types";
import { projectConstraintGroups } from "./constraintDrafts";

it("projects edits and removal of pending groups without writes", () => {
  const planRef = draftPlanRef("instance");
  const first = {
    start_time: "2026-09-12T16:00:00Z",
    end_time: "2026-09-12T20:00:00Z",
  };
  const second = {
    start_time: "2026-09-13T16:00:00Z",
    end_time: "2026-09-13T20:00:00Z",
  };
  const edits: DraftEdit[] = [
    {
      type: "addConstraintGroup",
      planRef,
      groupId: "pending-group",
      body: { windows: [first] },
    },
    {
      type: "replaceConstraintWindows",
      planRef,
      groupId: "pending-group",
      body: { windows: [first, second] },
    },
  ];
  expect(projectConstraintGroups([], edits, planRef)[0].windows).toEqual([
    expect.objectContaining(first),
    expect.objectContaining(second),
  ]);
  expect(
    projectConstraintGroups(
      [],
      [
        ...edits,
        { type: "removeConstraintGroup", planRef, groupId: "pending-group" },
      ],
      planRef,
    ),
  ).toEqual([]);
});
