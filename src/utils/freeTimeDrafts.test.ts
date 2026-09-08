import { describe, expect, it } from "vitest";
import type { FreeTimeActivityDTO } from "../api/types";
import { activityDraft, buildFreeTimeEdits } from "./freeTimeDrafts";

describe("free-time draft operations", () => {
  it("clears families and removes prerequisites using persisted references", () => {
    const activity: FreeTimeActivityDTO = {
      free_time_activity_id: "activity-1",
      name: "Practice",
      enabled: true,
      real_fraction: "1",
      minimum_block_size_minutes: 0,
      allowed_block_families: ["home"],
      prerequisite_plan_ids: ["plan-1"],
      created_at: "",
      updated_at: "",
    };
    const row = {
      ...activityDraft(activity),
      enabled: false,
      prerequisites: [],
      families: "",
    };
    expect(buildFreeTimeEdits([row], [activity])).toEqual([
      { op: "set_enabled", activity_ref: "activity-1", enabled: false },
      { op: "clear_block_families", activity_ref: "activity-1" },
      {
        op: "remove_prerequisite",
        activity_ref: "activity-1",
        prerequisite_plan_id: "plan-1",
      },
    ]);
  });
});
