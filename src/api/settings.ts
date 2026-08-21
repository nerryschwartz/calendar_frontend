import { apiGet, apiPatch } from "./client";
import type { AppSettingsDTO, UpdateSettingsBody } from "./types";

export function getSettings(): Promise<AppSettingsDTO> {
  return apiGet<AppSettingsDTO>("/api/settings");
}

export function updateSettings(
  body: UpdateSettingsBody,
): Promise<AppSettingsDTO> {
  return apiPatch<AppSettingsDTO>("/api/settings", body);
}
