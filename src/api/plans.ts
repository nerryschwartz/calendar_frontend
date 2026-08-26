import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type {
  BlockPlanDTO,
  CreateChildBody,
  DeletionPreviewDTO,
  DraftEdit,
  MasterPlanResponse,
  PlanDetailDTO,
  PlanSearchResultDTO,
  TaskPlanDTO,
} from "./types";

export function getMasterPlan(): Promise<MasterPlanResponse> {
  return apiGet<MasterPlanResponse>("/api/plans/master");
}

export function getPlanDetail(planId: string): Promise<PlanDetailDTO> {
  return apiGet<PlanDetailDTO>(`/api/plans/${planId}`);
}

export function searchPlans(
  query: string,
): Promise<{ results: PlanSearchResultDTO[] }> {
  return apiGet<{ results: PlanSearchResultDTO[] }>(
    `/api/plans/search?q=${encodeURIComponent(query)}`,
  );
}

export function validatePlans(): Promise<{ status: string }> {
  return apiPost<{ status: string }>("/api/plans/validate");
}

export function renamePlan(
  planId: string,
  name: string,
): Promise<{ status: string }> {
  return apiPatch<{ status: string }>(`/api/plans/${planId}/rename`, { name });
}

export function createChildPlan(
  parentId: string,
  body: CreateChildBody,
): Promise<unknown> {
  return apiPost(`/api/plans/${parentId}/children`, body);
}

export function movePlan(
  planId: string,
  position: number,
  isCritical?: boolean,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/api/plans/${planId}/move`, {
    position,
    is_critical: isCritical,
  });
}

export function addPrerequisite(
  planId: string,
  prerequisitePlanId: string,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/api/plans/${planId}/prerequisites`, {
    prerequisite_plan_id: prerequisitePlanId,
  });
}

export function removePrerequisite(
  planId: string,
  prerequisitePlanId: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(
    `/api/plans/${planId}/prerequisites/${prerequisitePlanId}`,
  );
}

export function deletePlan(planId: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`/api/plans/${planId}`);
}

export class DraftEditApplyError extends Error {
  appliedCount: number;
  cause: unknown;

  constructor(cause: unknown, appliedCount: number) {
    super(cause instanceof Error ? cause.message : "Draft edit failed");
    this.name = "DraftEditApplyError";
    this.appliedCount = appliedCount;
    this.cause = cause;
  }
}

export function isDraftEditApplyError(
  error: unknown,
): error is DraftEditApplyError {
  return error instanceof DraftEditApplyError;
}

export function getPlanDeletePreview(
  planId: string,
): Promise<DeletionPreviewDTO> {
  return apiGet<DeletionPreviewDTO>(`/api/plans/${planId}/delete-preview`);
}

export function updateTaskScheduling(
  planId: string,
  body: {
    duration_minutes?: number | null;
    divisible?: boolean | null;
    minimum_chunk_size_minutes?: number | null;
  },
): Promise<TaskPlanDTO> {
  return apiPatch<TaskPlanDTO>(`/api/plans/${planId}/task/scheduling`, body);
}

export function updateBlockScheduling(
  planId: string,
  body: {
    duration_minutes?: number | null;
    divisible?: boolean | null;
    minimum_chunk_size_minutes?: number | null;
    block_family?: string | null;
  },
): Promise<BlockPlanDTO> {
  return apiPatch<BlockPlanDTO>(`/api/plans/${planId}/block/scheduling`, body);
}

export function setTaskBlockFamilies(
  planId: string,
  families: string[],
): Promise<TaskPlanDTO> {
  return apiPut<TaskPlanDTO>(`/api/plans/${planId}/task/block-families`, {
    families,
  });
}

export function clearTaskBlockFamilies(planId: string): Promise<TaskPlanDTO> {
  return apiDelete<TaskPlanDTO>(`/api/plans/${planId}/task/block-families`);
}

export function completeTask(planId: string): Promise<TaskPlanDTO> {
  return apiPost<TaskPlanDTO>(`/api/plans/${planId}/task/complete`);
}

export function reopenTask(planId: string): Promise<TaskPlanDTO> {
  return apiPost<TaskPlanDTO>(`/api/plans/${planId}/task/reopen`);
}

export function completeBlock(planId: string): Promise<BlockPlanDTO> {
  return apiPost<BlockPlanDTO>(`/api/plans/${planId}/block/complete`);
}

export function reopenBlock(planId: string): Promise<BlockPlanDTO> {
  return apiPost<BlockPlanDTO>(`/api/plans/${planId}/block/reopen`);
}

export async function applyDraftEdits(edits: DraftEdit[]): Promise<number> {
  let appliedCount = 0;

  for (const edit of edits) {
    try {
      switch (edit.type) {
        case "rename":
          await renamePlan(edit.planId, edit.name);
          break;
        case "createChild":
          await createChildPlan(edit.parentId, edit.body);
          break;
        case "move":
          await movePlan(edit.planId, edit.position, edit.isCritical);
          break;
        case "addPrerequisite":
          await addPrerequisite(edit.planId, edit.prerequisitePlanId);
          break;
        case "removePrerequisite":
          await removePrerequisite(edit.planId, edit.prerequisitePlanId);
          break;
        case "delete":
          await deletePlan(edit.planId);
          break;
        case "taskComplete":
          await completeTask(edit.planId);
          break;
        case "taskReopen":
          await reopenTask(edit.planId);
          break;
        case "blockComplete":
          await completeBlock(edit.planId);
          break;
        case "blockReopen":
          await reopenBlock(edit.planId);
          break;
        case "taskScheduling":
          await updateTaskScheduling(edit.planId, edit.body);
          break;
        case "blockScheduling":
          await updateBlockScheduling(edit.planId, edit.body);
          break;
        case "taskBlockFamilies":
          if (edit.families.length === 0) {
            await clearTaskBlockFamilies(edit.planId);
          } else {
            await setTaskBlockFamilies(edit.planId, edit.families);
          }
          break;
      }
      appliedCount += 1;
    } catch (err) {
      throw new DraftEditApplyError(err, appliedCount);
    }
  }

  return appliedCount;
}
