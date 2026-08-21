import type { ApiErrorMessage, RefreshScheduleResult } from "../api/types";

interface RefreshResultPanelProps {
  result: RefreshScheduleResult | null;
}

function WarningList({
  warnings,
  title,
}: {
  warnings: ApiErrorMessage[];
  title: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className="refresh-section">
      <strong>{title}</strong>
      <ul>
        {warnings.map((w, i) => (
          <li key={`${w.code}-${i}`}>
            <code>{w.code}</code> — {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RefreshResultPanel({
  result,
}: RefreshResultPanelProps) {
  if (!result) return null;

  const assignment = result.assignment;
  const blockAssignment = result.block_assignment;
  const freeTime = result.free_time;

  return (
    <div className="refresh-result-panel detail-panel">
      <h3>Last refresh result</h3>
      <p className="muted">
        Started {new Date(result.run_started_at).toLocaleString()}
      </p>

      {assignment && (
        <div className="refresh-section">
          <strong>Task assignment</strong>
          <p>
            Status: <code>{assignment.optimization_status}</code> · Runtime:{" "}
            {assignment.runtime_ms} ms
            {assignment.calendar_run_id && (
              <>
                {" "}
                · Run ID: <code>{assignment.calendar_run_id}</code>
              </>
            )}
          </p>
          {assignment.conflicts.length > 0 && (
            <p className="warning-text">
              {assignment.conflicts.length} conflict(s) in result
            </p>
          )}
          <WarningList
            warnings={assignment.warnings}
            title="Assignment warnings"
          />
        </div>
      )}

      {blockAssignment && (
        <div className="refresh-section">
          <strong>Block assignment</strong>
          <p>
            Status: <code>{blockAssignment.optimization_status}</code> ·
            Runtime: {blockAssignment.runtime_ms} ms
          </p>
          <WarningList
            warnings={blockAssignment.warnings}
            title="Block warnings"
          />
        </div>
      )}

      {freeTime && (
        <div className="refresh-section">
          <strong>Free time</strong>
          <p>Runtime: {freeTime.runtime_ms} ms</p>
          <WarningList
            warnings={freeTime.warnings}
            title="Free-time warnings"
          />
        </div>
      )}

      {!assignment && !blockAssignment && !freeTime && (
        <p className="muted">No assignment stages returned details.</p>
      )}
    </div>
  );
}
