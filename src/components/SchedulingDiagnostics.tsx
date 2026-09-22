import { Link } from "react-router-dom";
import type {
  AssignmentConflict,
  SolverStatus,
  UserWindowBody,
} from "../api/types";

export function SolverOutcome({ status }: { status: SolverStatus }) {
  if (status === "UNKNOWN")
    return (
      <p className="warning-text">
        Scheduling stopped without a solution. Infeasibility has not been
        proven; the previous calendar remains unchanged.
      </p>
    );
  if (status === "INFEASIBLE")
    return (
      <p className="warning-text">
        No feasible calendar was found for these constraints. The previous
        calendar remains unchanged.
      </p>
    );
  return null;
}

function Windows({ windows }: { windows: UserWindowBody[] }) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return windows.length ? (
    <ul>
      {windows.map((window, index) => (
        <li key={index}>
          {formatter.format(new Date(window.start_time))} to{" "}
          {formatter.format(new Date(window.end_time))}
        </li>
      ))}
    </ul>
  ) : (
    <p>No available interval.</p>
  );
}

export default function SchedulingDiagnostics({
  conflict,
}: {
  conflict: AssignmentConflict;
}) {
  const diagnostics = conflict.diagnostics;
  const names = new Map(
    [
      ...(diagnostics?.tasks ?? []),
      ...(diagnostics?.blocking_plans ?? []),
      ...(diagnostics?.constraint_sources ?? []),
    ].map((plan) => [plan.plan_id, plan.name]),
  );
  const link = (id: string) => (
    <Link to={"/plan-tree/" + id}>{names.get(id) ?? id}</Link>
  );
  return (
    <div className="scheduling-diagnostics">
      <p>{conflict.explanation || "Scheduling conflict"}</p>
      {conflict.reason_code && (
        <p className="muted">
          Reason: <code>{conflict.reason_code}</code>
          {conflict.is_global && " (global)"}
          {conflict.is_approximate && " (approximate)"}
        </p>
      )}
      {diagnostics ? (
        <>
          <h4>Task requirements</h4>
          <ul>
            {diagnostics.tasks.map((task) => (
              <li key={task.plan_id}>
                {link(task.plan_id)}: {task.duration_minutes} minutes;{" "}
                {task.divisible
                  ? `divisible, minimum chunk ${task.minimum_chunk_size_minutes ?? 1} minute(s)`
                  : "one uninterrupted interval"}
                ; block families:{" "}
                {task.allowed_block_families.join(", ") || "default"}.
              </li>
            ))}
          </ul>
          <h4>Available windows</h4>
          <p className="muted">
            Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
          {diagnostics.effective_windows.map((entry) => (
            <div key={entry.plan_id}>
              <strong>{link(entry.plan_id)}</strong>
              <Windows windows={entry.windows} />
            </div>
          ))}
          {diagnostics.constraint_sources.length > 0 && (
            <>
              <h4>Constraint sources</h4>
              <ul>
                {diagnostics.constraint_sources.map((source) => (
                  <li key={source.constraint_group_id}>
                    {link(source.plan_id)}: {source.constraint_kind}
                    <Windows windows={source.windows} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {diagnostics.blocking_plans.length > 0 && (
            <>
              <h4>Blocking plans</h4>
              <ul>
                {diagnostics.blocking_plans.map((plan) => (
                  <li key={plan.plan_id}>{link(plan.plan_id)}</li>
                ))}
              </ul>
            </>
          )}
          <h4>Solver</h4>
          <p>
            Stage: {diagnostics.solver.stage}.{" "}
            {diagnostics.solver.proof_status === "proven_infeasible"
              ? "Infeasibility proven."
              : "Infeasibility has not been proven."}
          </p>
          {(diagnostics.solver.estimate !== null ||
            diagnostics.solver.limit !== null) && (
            <p>
              Model estimate: {diagnostics.solver.estimate ?? "unavailable"};
              limit: {diagnostics.solver.limit ?? "unavailable"}.
            </p>
          )}
        </>
      ) : (
        <>
          {conflict.conflicting_plan_ids.length > 0 && (
            <p>
              Plans:{" "}
              {conflict.conflicting_plan_ids.map((id, index) => (
                <span key={id}>
                  {index > 0 && ", "}
                  {link(id)}
                </span>
              ))}
            </p>
          )}
          {conflict.task_ids.length > 0 && (
            <p>
              Tasks:{" "}
              {conflict.task_ids.map((id, index) => (
                <span key={id}>
                  {index > 0 && ", "}
                  {link(id)}
                </span>
              ))}
            </p>
          )}
        </>
      )}
      {conflict.affected_priority_by_plan_id.length > 0 && (
        <p className="muted">
          Priorities:{" "}
          {conflict.affected_priority_by_plan_id
            .map(([id, priority]) => `${names.get(id) ?? id}=${priority}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
