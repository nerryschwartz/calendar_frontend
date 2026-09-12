import { useState } from "react";
import {
  persistedPlanRef,
  templatePlanRef,
  planRefsEqual,
  type PlanRef,
  type DraftEdit,
  type PlanDetailDTO,
  type UserWindowBody,
} from "../../api/types";
import LabeledField from "../LabeledField";
import { datetimeLocalToIso, formatDateTime } from "../../utils/format";

interface PlanConstraintsPanelProps {
  plan: PlanDetailDTO;
  editMode: boolean;
  draftEdits: DraftEdit[];
  queueEdit: (edit: DraftEdit) => void;
  targetRef?: PlanRef;
  title?: string;
}

export default function PlanConstraintsPanel({
  plan,
  editMode,
  draftEdits,
  queueEdit,
  targetRef,
  title,
}: PlanConstraintsPanelProps) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canEdit = editMode && !plan.is_master;
  const planRef = targetRef ?? persistedPlanRef(plan.plan_id);
  const queued = draftEdits.filter(
    (edit) =>
      "planRef" in edit &&
      (planRefsEqual(edit.planRef, planRef) || planRefsEqual(edit.planRef, persistedPlanRef(plan.plan_id))),
  );
  const removedGroups = new Set(
    queued
      .filter((edit) => edit.type === "removeConstraintGroup")
      .map((edit) => edit.groupId),
  );

  const withWindow = (build: (window: UserWindowBody) => DraftEdit) => {
    setError(null);
    if (
      !Number.isFinite(Date.parse(startTime)) ||
      !Number.isFinite(Date.parse(endTime)) ||
      Date.parse(endTime) <= Date.parse(startTime)
    ) {
      setError("End must be after a valid start time.");
      return;
    }
    const start = datetimeLocalToIso(startTime);
    const end = datetimeLocalToIso(endTime);
    queueEdit(build({ start_time: start, end_time: end }));
    setStartTime("");
    setEndTime("");
  };

  return (
    <div className="detail-panel">
      <h3>{title ?? (plan.repetition_detail ? "Whole-series time constraints" : "Time constraints")}</h3>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {plan.time_constraint_groups.length === 0 && (
        <p className="muted">No constraint groups.</p>
      )}
      {plan.time_constraint_groups
        .filter((group) => !removedGroups.has(group.constraint_group_id))
        .map((group) => {
          const groupEdits = queued.filter(
            (edit) =>
              "groupId" in edit && edit.groupId === group.constraint_group_id,
          );
          let windows = group.windows.map((window) => ({
            ...window,
            pending: false,
          }));
          for (const edit of groupEdits) {
            if (edit.type === "removeConstraintWindow")
              windows = windows.filter(
                (window) => window.time_window_id !== edit.windowId,
              );
            if (edit.type === "replaceConstraintWindows")
              windows = edit.body.windows.map((window, index) => ({
                ...window,
                time_window_id: "pending-" + index,
                pending: true,
              }));
            if (edit.type === "addConstraintWindow")
              windows.push({
                ...edit.body,
                time_window_id: "pending-" + windows.length,
                pending: true,
              });
          }
          return (
            <div key={group.constraint_group_id} className="constraint-group">
              <p>
                <code>{group.constraint_kind}</code> · Group{" "}
                {group.constraint_group_id}
              </p>
              <ul>
                {windows.map((window) => (
                  <li key={window.time_window_id}>
                    {formatDateTime(window.start_time)} →{" "}
                    {formatDateTime(window.end_time)}
                    {window.pending && " (pending)"}
                    {canEdit &&
                      group.constraint_kind === "USER" &&
                      !window.pending && (
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() =>
                            queueEdit(
                              windows.length === 1
                                ? {
                                    type: "removeConstraintGroup",
                                    planRef,
                                    groupId: group.constraint_group_id,
                                  }
                                : {
                                    type: "removeConstraintWindow",
                                    planRef,
                                    groupId: group.constraint_group_id,
                                    windowId: window.time_window_id,
                                  },
                            )
                          }
                        >
                          Queue remove window
                        </button>
                      )}
                  </li>
                ))}
              </ul>
              {canEdit && group.constraint_kind === "USER" && (
                <div className="button-row">
                  {plan.repetition_detail && <button type="button" className="btn-secondary" onClick={() => {
                    queueEdit({ type: "addConstraintGroup", planRef: templatePlanRef(planRef), body: { windows: windows.map(({ start_time, end_time }) => ({ start_time, end_time })) } });
                    queueEdit({ type: "removeConstraintGroup", planRef, groupId: group.constraint_group_id });
                  }}>Move to first-instance template</button>}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      withWindow((body) => ({
                        type: "addConstraintWindow",
                        planRef,
                        groupId: group.constraint_group_id,
                        body,
                      }))
                    }
                  >
                    Queue add window
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      withWindow((window) => ({
                        type: "replaceConstraintWindows",
                        planRef,
                        groupId: group.constraint_group_id,
                        body: { windows: [window] },
                      }))
                    }
                  >
                    Queue replace windows
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() =>
                      queueEdit({
                        type: "removeConstraintGroup",
                        planRef,
                        groupId: group.constraint_group_id,
                      })
                    }
                  >
                    Queue remove group
                  </button>
                </div>
              )}
            </div>
          );
        })}
      {queued
        .filter((edit) => edit.type === "addConstraintGroup")
        .map((edit, index) => (
          <div className="constraint-group" key={index}>
            <p>Pending USER group</p>
            <ul>
              {edit.body.windows.map((window, i) => (
                <li key={i}>
                  {formatDateTime(window.start_time)} →{" "}
                  {formatDateTime(window.end_time)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      {canEdit && (
        <fieldset className="settings-fieldset">
          <legend>User time window</legend>
          <LabeledField label="Start">
            <input
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="End">
            <input
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </LabeledField>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              withWindow((window) => ({
                type: "addConstraintGroup",
                planRef,
                body: { windows: [window] },
              }))
            }
          >
            Queue add group
          </button>
        </fieldset>
      )}
    </div>
  );
}
