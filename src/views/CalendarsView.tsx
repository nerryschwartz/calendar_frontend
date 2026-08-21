import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getScheduleState, getTaskCalendar } from "../api/schedule";
import { isApiError, type CalendarEntryDTO } from "../api/types";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import RefreshResultPanel from "../components/RefreshResultPanel";
import StatusBanner from "../components/StatusBanner";
import { useCalendarRefresh } from "../hooks/useCalendarRefresh";
import {
  formatDateTime,
  formatDurationMinutes,
  truncateId,
} from "../utils/format";

export default function CalendarsView() {
  const [entries, setEntries] = useState<CalendarEntryDTO[]>([]);
  const [calendarRunId, setCalendarRunId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    refreshing,
    error,
    successMessage,
    refreshResult,
    runRefresh,
    clearFeedback,
  } = useCalendarRefresh();

  const loadCalendar = useCallback(async () => {
    setLoadError(null);
    try {
      const [calendar, scheduleState] = await Promise.all([
        getTaskCalendar(),
        getScheduleState(),
      ]);
      setEntries(calendar.entries);
      setCalendarRunId(calendar.calendar_run_id);
      setActiveRunId(scheduleState.active_calendar_run_id);
    } catch (err) {
      if (isApiError(err)) {
        setLoadError(err.message);
      } else {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load calendar",
        );
      }
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const handleRefresh = async () => {
    const result = await runRefresh();
    if (result) await loadCalendar();
  };

  const isStale =
    calendarRunId != null &&
    activeRunId != null &&
    calendarRunId !== activeRunId;

  return (
    <section className="view">
      <div className="view-header">
        <div>
          <h2>Task &amp; Free-Time Calendar</h2>
          {calendarRunId && (
            <p className="muted">
              Calendar run: <code>{truncateId(calendarRunId, 12)}</code>
              {isStale && (
                <span className="stale-badge">Stale — refresh recommended</span>
              )}
            </p>
          )}
        </div>
        <LoadingButton
          loading={refreshing}
          loadingLabel="Refreshing…"
          onClick={() => void handleRefresh()}
        >
          Refresh schedule
        </LoadingButton>
      </div>

      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      <ErrorBanner detail={error} onDismiss={clearFeedback} />
      {loadError && <p className="error-text">{loadError}</p>}
      <RefreshResultPanel result={refreshResult} />

      {initialLoading ? (
        <p className="muted">Loading calendar…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No calendar entries.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Start</th>
              <th>End</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.calendar_entry_id}
                className={
                  entry.entry_type === "FREE_TIME"
                    ? "row-free-time"
                    : "row-task"
                }
              >
                <td>{entry.display_label}</td>
                <td>
                  <code>{entry.entry_type}</code>
                </td>
                <td>
                  {formatDurationMinutes(entry.start_time, entry.end_time)}
                </td>
                <td>{formatDateTime(entry.start_time)}</td>
                <td>{formatDateTime(entry.end_time)}</td>
                <td>
                  {entry.source_plan_id ? (
                    <Link to={`/plan-tree/${entry.source_plan_id}`}>Plan</Link>
                  ) : entry.source_free_time_activity_id ? (
                    <Link to="/free-time">Free-time activity</Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
