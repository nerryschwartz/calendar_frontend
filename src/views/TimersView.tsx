import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { completeTimer, getActiveTimers } from "../api/timers";
import {
  isApiError,
  type ActiveTimerDTO,
  type ApiErrorDetail,
} from "../api/types";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import StatusBanner from "../components/StatusBanner";
import {
  formatCountdown,
  formatDateTime,
  formatDurationMinutes,
  isPast,
} from "../utils/format";

const POLL_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 1_000;

export default function TimersView() {
  const [timers, setTimers] = useState<ActiveTimerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    }
  }, []);

  const showCompletionNotification = useCallback((label: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Timer complete", { body: label });
      return true;
    }
    return false;
  }, []);

  const loadTimers = useCallback(async () => {
    setError(null);
    try {
      const data = await getActiveTimers();
      setTimers(data.timers);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleComplete = useCallback(
    async (timer: ActiveTimerDTO) => {
      if (completingKeys.has(timer.timer_key)) return;
      setCompletingKeys((prev) => new Set(prev).add(timer.timer_key));
      setSuccessMessage(null);
      try {
        const result = await completeTimer(timer.timer_key);
        const usedBrowserNotification = showCompletionNotification(
          timer.display_label,
        );
        if (result.notification) {
          if (!usedBrowserNotification) {
            setSuccessMessage(
              `Completed "${timer.display_label}" — notification queued`,
            );
          }
        } else {
          setSuccessMessage(
            `Completed free-time timer "${timer.display_label}"`,
          );
        }
        await loadTimers();
      } catch (err) {
        if (isApiError(err)) {
          setError(err.detail);
        }
      } finally {
        setCompletingKeys((prev) => {
          const next = new Set(prev);
          next.delete(timer.timer_key);
          return next;
        });
      }
    },
    [completingKeys, loadTimers, showCompletionNotification],
  );

  useEffect(() => {
    void requestNotificationPermission();
    void loadTimers();
    const pollId = window.setInterval(
      () => void loadTimers(),
      POLL_INTERVAL_MS,
    );
    const tickId = window.setInterval(
      () => setNow(Date.now()),
      TICK_INTERVAL_MS,
    );
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [loadTimers, requestNotificationPermission]);

  useEffect(() => {
    for (const timer of timers) {
      if (isPast(timer.window_end_at, now)) {
        void handleComplete(timer);
      }
    }
  }, [timers, now, handleComplete]);

  return (
    <section className="view">
      <div className="view-header">
        <div>
          <h2>Active Timers</h2>
          {notificationPermission !== "unsupported" &&
            notificationPermission !== "granted" && (
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => void requestNotificationPermission()}
              >
                Enable browser notifications
              </button>
            )}
        </div>
        <LoadingButton
          loading={loading}
          loadingLabel="Reloading…"
          variant="secondary"
          onClick={() => void loadTimers()}
        >
          Reload
        </LoadingButton>
      </div>

      <StatusBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading && timers.length === 0 ? (
        <p className="muted">Loading timers…</p>
      ) : timers.length === 0 ? (
        <p className="muted">No active timers.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Kind</th>
              <th>Started</th>
              <th>Ends</th>
              <th>Duration</th>
              <th>Countdown</th>
              <th>Plan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {timers.map((timer) => {
              const overdue = isPast(timer.window_end_at, now);
              return (
                <tr
                  key={timer.timer_key}
                  className={overdue ? "row-overdue" : undefined}
                >
                  <td>{timer.display_label}</td>
                  <td>
                    <code>{timer.source_kind}</code>
                  </td>
                  <td>{formatDateTime(timer.window_start_at)}</td>
                  <td>{formatDateTime(timer.window_end_at)}</td>
                  <td>
                    {formatDurationMinutes(
                      timer.window_start_at,
                      timer.window_end_at,
                    )}
                  </td>
                  <td>
                    {overdue
                      ? "Overdue"
                      : formatCountdown(timer.window_end_at, now)}
                  </td>
                  <td>
                    {timer.plan_id ? (
                      <Link to={`/plan-tree/${timer.plan_id}`}>View plan</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <LoadingButton
                      variant="secondary"
                      loading={completingKeys.has(timer.timer_key)}
                      loadingLabel="Completing…"
                      onClick={() => void handleComplete(timer)}
                    >
                      Complete
                    </LoadingButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
