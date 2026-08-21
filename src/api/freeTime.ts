import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type { FreeTimeActivityDTO } from "./types";

export function listFreeTimeActivities(): Promise<{
  activities: FreeTimeActivityDTO[];
}> {
  return apiGet<{ activities: FreeTimeActivityDTO[] }>(
    "/api/free-time/activities",
  );
}

export function getFreeTimeActivity(
  activityId: string,
): Promise<FreeTimeActivityDTO> {
  return apiGet<FreeTimeActivityDTO>(`/api/free-time/activities/${activityId}`);
}

export function createFreeTimeActivity(body: {
  name: string;
  real_fraction: number;
  minimum_block_size_minutes: number;
  enabled?: boolean;
}): Promise<FreeTimeActivityDTO> {
  return apiPost<FreeTimeActivityDTO>("/api/free-time/activities", body);
}

export function updateFreeTimeActivity(
  activityId: string,
  body: {
    name?: string;
    real_fraction?: number;
    minimum_block_size_minutes?: number;
  },
): Promise<FreeTimeActivityDTO> {
  return apiPatch<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}`,
    body,
  );
}

export function setFreeTimeActivityEnabled(
  activityId: string,
  enabled: boolean,
): Promise<FreeTimeActivityDTO> {
  return apiPost<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}/enabled`,
    {
      enabled,
    },
  );
}

export function addFreeTimePrerequisite(
  activityId: string,
  prerequisitePlanId: string,
): Promise<FreeTimeActivityDTO> {
  return apiPost<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}/prerequisites`,
    { prerequisite_plan_id: prerequisitePlanId },
  );
}

export function removeFreeTimePrerequisite(
  activityId: string,
  prerequisiteId: string,
): Promise<FreeTimeActivityDTO> {
  return apiDelete<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}/prerequisites/${prerequisiteId}`,
  );
}

export function setFreeTimeBlockFamilies(
  activityId: string,
  families: string[],
): Promise<FreeTimeActivityDTO> {
  return apiPut<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}/block-families`,
    { families },
  );
}

export function clearFreeTimeBlockFamilies(
  activityId: string,
): Promise<FreeTimeActivityDTO> {
  return apiDelete<FreeTimeActivityDTO>(
    `/api/free-time/activities/${activityId}/block-families`,
  );
}
