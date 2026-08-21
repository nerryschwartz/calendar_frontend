import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dismissNotification, getNotifications } from "../api/notifications";
import {
  isApiError,
  type ApiErrorDetail,
  type NotificationQueueItemDTO,
} from "../api/types";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import StatusBanner from "../components/StatusBanner";
import { formatDateTime, formatRelativeTime } from "../utils/format";

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<
    NotificationQueueItemDTO[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleDismiss = async (item: NotificationQueueItemDTO) => {
    setDismissingIds((prev) => new Set(prev).add(item.notification_id));
    setError(null);
    try {
      await dismissNotification(item.notification_id);
      setNotifications((prev) =>
        prev.filter((n) => n.notification_id !== item.notification_id),
      );
      setSuccessMessage(`Dismissed "${item.display_label}"`);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail);
      }
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.notification_id);
        return next;
      });
    }
  };

  return (
    <section className="view">
      <div className="view-header">
        <h2>Notifications</h2>
        <LoadingButton
          variant="secondary"
          loading={loading}
          loadingLabel="Reloading…"
          onClick={() => void loadNotifications(true)}
        >
          Reload
        </LoadingButton>
      </div>

      <StatusBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading && notifications.length === 0 ? (
        <p className="muted">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <p className="muted">No pending notifications.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Kind</th>
              <th>Window ended</th>
              <th>Queued</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item.notification_id}>
                <td>
                  <Link to={`/plan-tree/${item.plan_id}`}>
                    {item.display_label}
                  </Link>
                </td>
                <td>
                  <code>{item.source_kind}</code>
                </td>
                <td>{formatDateTime(item.window_end_at)}</td>
                <td>{formatRelativeTime(item.created_at)}</td>
                <td className="button-row">
                  <Link
                    to={`/plan-tree/${item.plan_id}?edit=1`}
                    className="btn-link"
                  >
                    Edit plan
                  </Link>
                  <LoadingButton
                    variant="secondary"
                    loading={dismissingIds.has(item.notification_id)}
                    loadingLabel="Discarding…"
                    onClick={() => void handleDismiss(item)}
                  >
                    Discard
                  </LoadingButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
