import { apiPatch, apiPost } from "./client";
import type { RepetitionPlanDTO, UpdateRepetitionSettingsBody } from "./types";

export function updateRepetitionSettings(
  repetitionId: string,
  body: UpdateRepetitionSettingsBody,
): Promise<RepetitionPlanDTO> {
  return apiPatch<RepetitionPlanDTO>(
    `/api/repetitions/${repetitionId}/settings`,
    body,
  );
}

export function generateRepetitionInstances(
  repetitionId: string,
): Promise<unknown> {
  return apiPost(`/api/repetitions/${repetitionId}/generate-instances`);
}

export function refreshRepetition(
  repetitionId: string,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(
    `/api/repetitions/${repetitionId}/refresh`,
  );
}

export function refreshAllRepetitions(): Promise<{ status: string }> {
  return apiPost<{ status: string }>("/api/repetitions/refresh-all");
}
