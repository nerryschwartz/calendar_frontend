import { apiGet, apiPatch, apiPost } from "./client";
import type { RepetitionPlanDTO, UpdateRepetitionSettingsBody } from "./types";

export interface RepetitionGenerationStatus {
  plan_id: string;
  name: string;
  parent_id: string | null;
  template_root_id: string;
  generated_at: string | null;
  instance_count: number;
}

export function getRepetitionGenerationStatus(): Promise<{
  repetitions: RepetitionGenerationStatus[];
}> {
  return apiGet("/api/repetitions/generation-status");
}

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
