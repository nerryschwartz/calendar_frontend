import { useCallback, useEffect, useState } from "react";
import { getScheduleState } from "../api/schedule";
import type { ScheduleStateDTO } from "../api/types";
import {
  formatDateTime,
  formatRelativeTime,
  truncateId,
} from "../utils/format";

const POLL_MS = 30_000;

export default function ScheduleStatusBar() {
  const [state, setState] = useState<ScheduleStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getScheduleState();
      setState(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load schedule state",
      );
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (error) {
    return (
      <div className="schedule-status-bar schedule-status-warning">
        Schedule state unavailable: {error}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="schedule-status-bar muted">Loading schedule state…</div>
    );
  }

  const statusClass = state.last_refresh_failed
    ? "schedule-status-warning"
    : "schedule-status-ok";

  return (
    <div className={`schedule-status-bar ${statusClass}`}>
      <span>
        Active run:{" "}
        {state.active_calendar_run_id ? (
          <code title={state.active_calendar_run_id}>
            {truncateId(state.active_calendar_run_id, 12)}
          </code>
        ) : (
          "none"
        )}
      </span>
      <span>Updated {formatRelativeTime(state.updated_at)}</span>
      {state.last_refresh_failed && (
        <span>
          Last refresh failed
          {state.last_failure_at && (
            <> at {formatDateTime(state.last_failure_at)}</>
          )}
          {state.last_failure_reason && <> ({state.last_failure_reason})</>}
        </span>
      )}
    </div>
  );
}
