import { apiGet, apiPost } from "./client";
import type {
  AssignmentConflict,
  DeletionCandidateDTO,
  DeletionPreviewDTO,
} from "./types";

export function getDeletionPreview(
  planId: string,
): Promise<DeletionPreviewDTO> {
  return apiGet<DeletionPreviewDTO>(`/api/deletion/plans/${planId}/preview`);
}

export function getPlanDeletePreview(
  planId: string,
): Promise<DeletionPreviewDTO> {
  return apiGet<DeletionPreviewDTO>(`/api/plans/${planId}/delete-preview`);
}

export function getConflictSuggestions(
  conflict: AssignmentConflict,
): Promise<{ suggestions: DeletionCandidateDTO[] }> {
  return apiPost<{ suggestions: DeletionCandidateDTO[] }>(
    "/api/deletion/conflict-suggestions",
    { conflict },
  );
}
