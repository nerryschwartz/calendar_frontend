import { apiGet, apiPost } from "./client";
import type { ActiveTimersResponse, NotificationQueueItemDTO } from "./types";

export function getActiveTimers(): Promise<ActiveTimersResponse> {
  return apiGet<ActiveTimersResponse>("/api/timers/active");
}

export function completeTimer(
  timerKey: string,
): Promise<{ notification: NotificationQueueItemDTO | null }> {
  return apiPost<{ notification: NotificationQueueItemDTO | null }>(
    `/api/timers/${encodeURIComponent(timerKey)}/complete`,
  );
}
