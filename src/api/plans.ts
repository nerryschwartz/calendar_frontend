import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type {
  BlockPlanDTO,
  CreateChildBody,
  DeletionPreviewDTO,
  DraftEdit,
  MasterPlanResponse,
  PlanRef,
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
): Promise<PlanDetailDTO> {
  return apiPost<PlanDetailDTO>(`/api/plans/${parentId}/children`, body);
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
  const draftPlanIds = new Map<string, string>();

  const resolvePlanRef = (ref: PlanRef): string => {
    if (ref.kind === "persisted") return ref.planId;
    const planId = draftPlanIds.get(ref.draftId);
    if (!planId) {
      throw new Error(
        `Draft plan ${ref.draftId} must be created earlier in the pending edit queue`,
      );
    }
    return planId;
  };

  for (const edit of edits) {
    try {
      switch (edit.type) {
        case "rename":
          await renamePlan(resolvePlanRef(edit.planRef), edit.name);
          break;
        case "createChild":
          draftPlanIds.set(
            edit.draftId,
            (await createChildPlan(resolvePlanRef(edit.parentRef), edit.body))
              .plan_id,
          );
          break;
        case "move":
          await movePlan(
            resolvePlanRef(edit.planRef),
            edit.position,
            edit.isCritical,
          );
          break;
        case "addPrerequisite":
          await addPrerequisite(
            resolvePlanRef(edit.planRef),
            resolvePlanRef(edit.prerequisitePlanRef),
          );
          break;
        case "removePrerequisite":
          await removePrerequisite(
            resolvePlanRef(edit.planRef),
            resolvePlanRef(edit.prerequisitePlanRef),
          );
          break;
        case "delete":
          await deletePlan(resolvePlanRef(edit.planRef));
          break;
        case "taskComplete":
          await completeTask(resolvePlanRef(edit.planRef));
          break;
        case "taskReopen":
          await reopenTask(resolvePlanRef(edit.planRef));
          break;
        case "blockComplete":
          await completeBlock(resolvePlanRef(edit.planRef));
          break;
        case "blockReopen":
          await reopenBlock(resolvePlanRef(edit.planRef));
          break;
        case "taskScheduling":
          await updateTaskScheduling(resolvePlanRef(edit.planRef), edit.body);
          break;
        case "blockScheduling":
          await updateBlockScheduling(resolvePlanRef(edit.planRef), edit.body);
          break;
        case "taskBlockFamilies":
          if (edit.families.length === 0) {
            await clearTaskBlockFamilies(resolvePlanRef(edit.planRef));
          } else {
            await setTaskBlockFamilies(
              resolvePlanRef(edit.planRef),
              edit.families,
            );
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
