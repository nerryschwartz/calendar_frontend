import { apiGet, apiPost } from './client'
import type {
  BlockCalendarDTO,
  RefreshScheduleResult,
  TaskCalendarDTO,
} from './types'

export function getTaskCalendar(): Promise<TaskCalendarDTO> {
  return apiGet<TaskCalendarDTO>('/api/calendar/tasks')
}

export function getBlockCalendar(): Promise<BlockCalendarDTO> {
  return apiGet<BlockCalendarDTO>('/api/calendar/blocks')
}

export function refreshSchedule(): Promise<RefreshScheduleResult> {
  return apiPost<RefreshScheduleResult>('/api/schedule/refresh')
}
