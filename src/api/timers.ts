import { apiGet, apiPost } from "./client";
import type { ActiveTimerDTO, NotificationQueueItemDTO } from "./types";

export function getActiveTimers(): Promise<{ timers: ActiveTimerDTO[] }> {
  return apiGet<{ timers: ActiveTimerDTO[] }>("/api/timers/active");
}

export function completeTimer(
  timerKey: string,
): Promise<{ notification: NotificationQueueItemDTO | null }> {
  return apiPost<{ notification: NotificationQueueItemDTO | null }>(
    `/api/timers/${encodeURIComponent(timerKey)}/complete`,
  );
}
