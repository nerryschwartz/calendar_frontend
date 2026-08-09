import { apiGet, apiPost } from './client'
import type { NotificationQueueItemDTO } from './types'

export function getNotifications(): Promise<{ notifications: NotificationQueueItemDTO[] }> {
  return apiGet<{ notifications: NotificationQueueItemDTO[] }>('/api/notifications')
}

export function dismissNotification(
  notificationId: string,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/api/notifications/${notificationId}/dismiss`)
}
