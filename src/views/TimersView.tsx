import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { completeTimer, getActiveTimers } from "../api/timers";
import {
  isApiError,
  type ActiveTimerDTO,
  type ApiErrorDetail,
  type CalendarEntryDTO,
  type ScheduleStateDTO,
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
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const [scheduleState, setScheduleState] = useState<ScheduleStateDTO | null>(
    null,
  );
  const [nearbyEntries, setNearbyEntries] = useState<CalendarEntryDTO[]>([]);
  const [now, setNow] = useState(Date.now());
  const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const completed = useRef(new Set<string>());
  const autoAttempted = useRef(new Set<string>());
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
    setNotificationMessage(null);
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotificationMessage("Browser notifications are not supported here.");
      return;
    }
    if (!window.isSecureContext) {
      setNotificationMessage(
        "Browser notifications require HTTPS or localhost.",
      );
      return;
    }
    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      setNotificationMessage("Browser notifications are already enabled.");
      return;
    }
    if (Notification.permission === "denied") {
      setNotificationPermission("denied");
      setNotificationMessage(
        "Browser notifications are blocked in this browser.",
      );
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      setNotificationMessage(
        result === "granted"
          ? "Browser notifications enabled."
          : "Browser notifications were not enabled.",
      );
    } catch {
      setNotificationMessage("Browser notification permission request failed.");
    }
  }, []);

  const showCompletionNotification = useCallback((label: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Timer complete", { body: label });
        return true;
      } catch {
        setNotificationMessage("Browser notification could not be displayed.");
      }
    }
    return false;
  }, []);

  const loadTimers = useCallback(async (clearSuccess = false) => {
    setLoading(true);
    setError(null);
    if (clearSuccess) setSuccessMessage(null);
    try {
      const data = await getActiveTimers();
      setTimers(
        data.timers.filter((timer) => !completed.current.has(timer.timer_key)),
      );
      setScheduleState(data.diagnostics?.schedule_state ?? null);
      setNearbyEntries(data.diagnostics?.nearby_entries ?? []);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail);
      } else {
        setError({
          errors: [
            {
              code: "NETWORK_ERROR",
              message:
                err instanceof Error ? err.message : "Failed to load timers",
              details: {},
            },
          ],
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleComplete = useCallback(
    async (timer: ActiveTimerDTO) => {
      if (
        inFlight.current.has(timer.timer_key) ||
        completed.current.has(timer.timer_key)
      )
        return;
      inFlight.current.add(timer.timer_key);
      setCompletingKeys((prev) => new Set(prev).add(timer.timer_key));
      setSuccessMessage(null);
      setError(null);
      try {
        const result = await completeTimer(timer.timer_key);
        completed.current.add(timer.timer_key);
        setTimers((current) =>
          current.filter((item) => item.timer_key !== timer.timer_key),
        );
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
        } else {
          setError({
            errors: [
              {
                code: "NETWORK_ERROR",
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to complete timer",
                details: {},
              },
            ],
          });
        }
      } finally {
        inFlight.current.delete(timer.timer_key);
        setCompletingKeys((prev) => {
          const next = new Set(prev);
          next.delete(timer.timer_key);
          return next;
        });
      }
    },
    [loadTimers, showCompletionNotification],
  );

  useEffect(() => {
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
      if (
        isPast(timer.window_end_at, now) &&
        !autoAttempted.current.has(timer.timer_key)
      ) {
        autoAttempted.current.add(timer.timer_key);
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
          onClick={() => void loadTimers(true)}
        >
          Reload
        </LoadingButton>
      </div>

      <StatusBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
      <StatusBanner
        message={notificationMessage}
        onDismiss={() => setNotificationMessage(null)}
      />
      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading && timers.length === 0 ? (
        <p className="muted">Loading timers…</p>
      ) : timers.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No active timer right now.</p>
          {scheduleState ? (
            <dl className="detail-grid">
              <div className="detail-grid-row">
                <dt>Active run</dt>
                <dd>{scheduleState.active_calendar_run_id ?? "none"}</dd>
              </div>
              <div className="detail-grid-row">
                <dt>Schedule updated</dt>
                <dd>{formatDateTime(scheduleState.updated_at)}</dd>
              </div>
              {scheduleState.last_refresh_failed && (
                <div className="detail-grid-row">
                  <dt>Last refresh</dt>
                  <dd>
                    Failed
                    {scheduleState.last_failure_reason
                      ? `: ${scheduleState.last_failure_reason}`
                      : ""}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="muted">Schedule state is not available yet.</p>
          )}
          {nearbyEntries.length > 0 ? (
            <>
              <h3>Nearby calendar entries</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  {nearbyEntries.slice(0, 5).map((entry) => (
                    <tr key={entry.calendar_entry_id}>
                      <td>{entry.display_label}</td>
                      <td>
                        <code>{entry.entry_type}</code>
                      </td>
                      <td>{formatDateTime(entry.start_time)}</td>
                      <td>{formatDateTime(entry.end_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : scheduleState ? (
            <p className="muted">No calendar entries are available.</p>
          ) : null}
        </div>
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
