import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dismissNotification, getNotifications } from '../api/notifications'
import { isApiError, type ApiErrorDetail, type NotificationQueueItemDTO } from '../api/types'
import ErrorBanner from '../components/ErrorBanner'
import { formatDateTime } from '../utils/format'

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<NotificationQueueItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiErrorDetail | null>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getNotifications()
      setNotifications(data.notifications)
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const handleDismiss = async (notificationId: string) => {
    setError(null)
    try {
      await dismissNotification(notificationId)
      await loadNotifications()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      }
    }
  }

  return (
    <section className="view">
      <div className="view-header">
        <h2>Notifications</h2>
        <button type="button" className="btn-secondary" onClick={() => void loadNotifications()}>
          Reload
        </button>
      </div>

      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading ? (
        <p className="muted">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <p className="muted">No pending notifications.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Kind</th>
              <th>Ended</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item.notification_id}>
                <td>{item.display_label}</td>
                <td>{item.source_kind}</td>
                <td>{formatDateTime(item.window_end_at)}</td>
                <td className="button-row">
                  <Link
                    to={`/plan-tree/${item.plan_id}?edit=1`}
                    className="btn-link"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void handleDismiss(item.notification_id)}
                  >
                    Discard
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
