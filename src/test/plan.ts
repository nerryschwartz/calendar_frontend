import type { PlanDetailDTO } from "../api/types";

export function planDetail(
  overrides: Partial<PlanDetailDTO> = {},
): PlanDetailDTO {
  return {
    plan_id: "plan-1",
    name: "Example plan",
    plan_kind: "GOAL",
    is_master: false,
    parent_id: "master",
    goal_is_critical: false,
    goal_sort_order: 0,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    ancestry: [],
    children: [],
    prerequisite_plan_ids: [],
    prerequisites: [],
    time_constraint_groups: [],
    goal_detail: null,
    task_detail: null,
    block_detail: null,
    repetition_detail: null,
    ...overrides,
  };
}
