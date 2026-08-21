import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBlockCalendar, getScheduleState } from "../api/schedule";
import { isApiError, type BlockCalendarEntryDTO } from "../api/types";
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

export default function BlockCalendarView() {
  const [entries, setEntries] = useState<BlockCalendarEntryDTO[]>([]);
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
        getBlockCalendar(),
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
          err instanceof Error ? err.message : "Failed to load block calendar",
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
          <h2>Block Calendar</h2>
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
        <p className="muted">Loading block calendar…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No block entries.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Duration</th>
              <th>Start</th>
              <th>End</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.block_calendar_entry_id}>
                <td>{entry.display_label}</td>
                <td>
                  {formatDurationMinutes(entry.start_time, entry.end_time)}
                </td>
                <td>{formatDateTime(entry.start_time)}</td>
                <td>{formatDateTime(entry.end_time)}</td>
                <td>
                  <Link to={`/plan-tree/${entry.source_plan_id}`}>
                    View plan
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
