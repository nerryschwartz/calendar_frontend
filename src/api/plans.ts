import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  CreateChildBody,
  DraftEdit,
  MasterPlanResponse,
  PlanDetailDTO,
} from './types'

export function getMasterPlan(): Promise<MasterPlanResponse> {
  return apiGet<MasterPlanResponse>('/api/plans/master')
}

export function getPlanDetail(planId: string): Promise<PlanDetailDTO> {
  return apiGet<PlanDetailDTO>(`/api/plans/${planId}`)
}

export function validatePlans(): Promise<{ status: string }> {
  return apiPost<{ status: string }>('/api/plans/validate')
}

export function renamePlan(planId: string, name: string): Promise<{ status: string }> {
  return apiPatch<{ status: string }>(`/api/plans/${planId}/rename`, { name })
}

export function createChildPlan(
  parentId: string,
  body: CreateChildBody,
): Promise<unknown> {
  return apiPost(`/api/plans/${parentId}/children`, body)
}

export function movePlan(
  planId: string,
  position: number,
  isCritical?: boolean,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/api/plans/${planId}/move`, {
    position,
    is_critical: isCritical,
  })
}

export function addPrerequisite(
  planId: string,
  prerequisitePlanId: string,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/api/plans/${planId}/prerequisites`, {
    prerequisite_plan_id: prerequisitePlanId,
  })
}

export function removePrerequisite(
  planId: string,
  prerequisitePlanId: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(
    `/api/plans/${planId}/prerequisites/${prerequisitePlanId}`,
  )
}

export function deletePlan(planId: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`/api/plans/${planId}`)
}

export function completeTask(planId: string): Promise<unknown> {
  return apiPost(`/api/plans/${planId}/task/complete`)
}

export function reopenTask(planId: string): Promise<unknown> {
  return apiPost(`/api/plans/${planId}/task/reopen`)
}

export function completeBlock(planId: string): Promise<unknown> {
  return apiPost(`/api/plans/${planId}/block/complete`)
}

export function reopenBlock(planId: string): Promise<unknown> {
  return apiPost(`/api/plans/${planId}/block/reopen`)
}

export async function applyDraftEdits(edits: DraftEdit[]): Promise<void> {
  for (const edit of edits) {
    switch (edit.type) {
      case 'rename':
        await renamePlan(edit.planId, edit.name)
        break
      case 'createChild':
        await createChildPlan(edit.parentId, edit.body)
        break
      case 'move':
        await movePlan(edit.planId, edit.position, edit.isCritical)
        break
      case 'addPrerequisite':
        await addPrerequisite(edit.planId, edit.prerequisitePlanId)
        break
      case 'removePrerequisite':
        await removePrerequisite(edit.planId, edit.prerequisitePlanId)
        break
      case 'delete':
        await deletePlan(edit.planId)
        break
      case 'taskComplete':
        await completeTask(edit.planId)
        break
      case 'taskReopen':
        await reopenTask(edit.planId)
        break
      case 'blockComplete':
        await completeBlock(edit.planId)
        break
      case 'blockReopen':
        await reopenBlock(edit.planId)
        break
    }
  }
}
