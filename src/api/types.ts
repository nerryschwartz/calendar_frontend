export type PlanKind = 'GOAL' | 'TASK' | 'BLOCK' | 'REPETITION'
export type RepeatMode = 'MANUAL_COUNT' | 'DATE_RANGE'
export type CalendarEntryType = 'TASK' | 'FREE_TIME'
export type TimerSourceKind = 'TASK' | 'BLOCK' | 'FREE_TIME'
export type NotificationSourceKind = 'TASK' | 'BLOCK'
export type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE'
export type ConstraintKind =
  | 'USER'
  | 'SYSTEM_REPETITION_WINDOW'
  | 'SYSTEM_MASTER_HORIZON'

export interface ApiErrorMessage {
  code: string
  message: string
  details: Record<string, string>
}

export interface ApiErrorDetail {
  errors: ApiErrorMessage[]
  value?: unknown
}

export interface AssignmentConflict {
  conflicting_plan_ids: string[]
  affected_priority_by_plan_id: [string, number][]
  reason_code: string | null
  task_ids: string[]
  explanation: string
  is_global: boolean
  is_approximate: boolean
}

export interface AssignmentResult {
  run_started_at: string
  optimization_status: SolverStatus
  calendar_entries: CalendarEntryDTO[]
  conflicts: AssignmentConflict[]
  warnings: ApiErrorMessage[]
  runtime_ms: number
  calendar_run_id: string | null
}

export interface RefreshScheduleResult {
  run_started_at: string
  resolved_blocks: unknown | null
  block_assignment: unknown | null
  resolved: unknown | null
  assignment: AssignmentResult | null
  free_time: unknown | null
}

export interface PlanAncestryItemDTO {
  plan_id: string
  name: string
  plan_kind: PlanKind
}

export interface PlanChildSummaryDTO {
  plan_id: string
  name: string
  plan_kind: PlanKind
  goal_is_critical: boolean | null
  goal_sort_order: number | null
}

export interface PlanPrerequisiteSummaryDTO {
  prerequisite_plan_id: string
  name: string
  plan_kind: PlanKind
}

export interface TimeWindowDTO {
  time_window_id: string
  start_time: string
  end_time: string
}

export interface TimeConstraintGroupDTO {
  constraint_group_id: string
  plan_id: string
  constraint_kind: ConstraintKind
  windows: TimeWindowDTO[]
}

export interface TaskPlanDTO {
  plan_id: string
  name: string
  is_master: boolean
  parent_id: string | null
  duration_minutes: number
  divisible: boolean
  minimum_chunk_size_minutes: number | null
  user_completed: boolean
  completed_at: string | null
  allowed_block_families: string[]
  created_at: string
  updated_at: string
}

export interface BlockPlanDTO {
  plan_id: string
  name: string
  is_master: boolean
  parent_id: string | null
  duration_minutes: number
  divisible: boolean
  minimum_chunk_size_minutes: number | null
  user_completed: boolean
  completed_at: string | null
  block_family: string
  created_at: string
  updated_at: string
}

export interface GoalPlanDTO {
  plan_id: string
  name: string
  is_master: boolean
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface RepetitionPlanDTO {
  plan_id: string
  name: string
  is_master: boolean
  parent_id: string | null
  repeat_mode: RepeatMode
  start_time: string
  repeat_interval_minutes: number
  manual_count: number | null
  end_time: string | null
  template_root_id: string
  default_instance_critical: boolean
  generated_at: string | null
  created_at: string
  updated_at: string
}

export interface PlanDetailDTO {
  plan_id: string
  name: string
  plan_kind: PlanKind
  is_master: boolean
  parent_id: string | null
  goal_is_critical: boolean | null
  goal_sort_order: number | null
  created_at: string
  updated_at: string
  ancestry: PlanAncestryItemDTO[]
  children: PlanChildSummaryDTO[]
  prerequisite_plan_ids: string[]
  prerequisites: PlanPrerequisiteSummaryDTO[]
  time_constraint_groups: TimeConstraintGroupDTO[]
  goal_detail: GoalPlanDTO | null
  task_detail: TaskPlanDTO | null
  block_detail: BlockPlanDTO | null
  repetition_detail: RepetitionPlanDTO | null
}

export interface MasterPlanResponse {
  master_plan_id: string
  plan: PlanDetailDTO
}

export interface CalendarEntryDTO {
  calendar_entry_id: string
  entry_type: CalendarEntryType
  start_time: string
  end_time: string
  source_plan_id: string | null
  source_free_time_activity_id: string | null
  display_label: string
  calendar_run_id: string | null
}

export interface BlockCalendarEntryDTO {
  block_calendar_entry_id: string
  start_time: string
  end_time: string
  source_plan_id: string
  display_label: string
  calendar_run_id: string | null
}

export interface TaskCalendarDTO {
  entries: CalendarEntryDTO[]
  calendar_run_id: string | null
}

export interface BlockCalendarDTO {
  entries: BlockCalendarEntryDTO[]
  calendar_run_id: string | null
}

export interface ActiveTimerDTO {
  timer_key: string
  source_kind: TimerSourceKind
  plan_id: string | null
  display_label: string
  window_start_at: string
  window_end_at: string
  calendar_entry_id: string | null
  block_calendar_entry_id: string | null
}

export interface NotificationQueueItemDTO {
  notification_id: string
  source_kind: NotificationSourceKind
  plan_id: string
  timer_key: string
  window_end_at: string
  calendar_entry_id: string | null
  block_calendar_entry_id: string | null
  display_label: string
  created_at: string
}

export interface CreateChildBody {
  kind: PlanKind
  is_critical: boolean
  name: string
  duration_minutes?: number | null
  divisible?: boolean | null
  minimum_chunk_size_minutes?: number | null
  block_family?: string | null
  repeat_mode?: RepeatMode | null
  start_time?: string | null
  repeat_interval_minutes?: number | null
  manual_count?: number | null
  end_time?: string | null
  default_instance_critical?: boolean | null
  template_type?: PlanKind | null
  template_name?: string | null
  template_duration_minutes?: number | null
  template_divisible?: boolean | null
  template_minimum_chunk_size_minutes?: number | null
  template_block_family?: string | null
}

export type DraftEdit =
  | { type: 'rename'; planId: string; name: string }
  | { type: 'createChild'; parentId: string; body: CreateChildBody }
  | { type: 'move'; planId: string; position: number; isCritical?: boolean }
  | { type: 'addPrerequisite'; planId: string; prerequisitePlanId: string }
  | { type: 'removePrerequisite'; planId: string; prerequisitePlanId: string }
  | { type: 'delete'; planId: string }
  | { type: 'taskComplete'; planId: string }
  | { type: 'taskReopen'; planId: string }
  | { type: 'blockComplete'; planId: string }
  | { type: 'blockReopen'; planId: string }

export class ApiError extends Error {
  detail: ApiErrorDetail

  constructor(detail: ApiErrorDetail) {
    super(detail.errors.map((e) => e.message).join('; ') || 'Request failed')
    this.name = 'ApiError'
    this.detail = detail
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getAssignmentConflicts(detail: ApiErrorDetail): AssignmentConflict[] {
  const value = detail.value
  if (!value || typeof value !== 'object') return []
  const assignment = value as AssignmentResult
  if (Array.isArray(assignment.conflicts)) {
    return assignment.conflicts
  }
  return []
}
