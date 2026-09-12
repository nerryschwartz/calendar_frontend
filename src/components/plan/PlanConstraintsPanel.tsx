import { useEffect, useId, useState } from "react";
import {
  persistedPlanRef,
  templatePlanRef,
  type PlanRef,
  type DraftEdit,
  type PlanDetailDTO,
  type TimeConstraintGroupDTO,
  type UserWindowBody,
} from "../../api/types";
import LabeledField from "../LabeledField";
import { useGenerationForm } from "../PlanDraftProvider";
import { datetimeLocalToIso, formatDateTime } from "../../utils/format";
import { projectConstraintGroups } from "../../utils/constraintDrafts";

interface Props {
  plan: PlanDetailDTO;
  editMode: boolean;
  draftEdits: DraftEdit[];
  queueEdit: (edit: DraftEdit) => void;
  targetRef?: PlanRef;
  title?: string;
}
interface WindowForm {
  start: string;
  end: string;
}
function localTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function formWindow(window: UserWindowBody): WindowForm {
  return {
    start: localTime(window.start_time),
    end: localTime(window.end_time),
  };
}
function windowErrors(window: WindowForm) {
  return {
    start:
      !window.start || !Number.isFinite(Date.parse(window.start))
        ? "Enter a valid start time."
        : "",
    end:
      !window.end || !Number.isFinite(Date.parse(window.end))
        ? "Enter a valid end time."
        : window.start && Date.parse(window.end) <= Date.parse(window.start)
          ? "End must be after Start for this window."
          : "",
  };
}
function parseWindow(window: WindowForm): UserWindowBody {
  const errors = windowErrors(window);
  if (errors.start || errors.end) throw new Error(errors.start || errors.end);
  return {
    start_time: datetimeLocalToIso(window.start),
    end_time: datetimeLocalToIso(window.end),
  };
}
function WindowFields({
  value,
  onChange,
  submitted,
}: {
  value: WindowForm;
  onChange: (value: WindowForm) => void;
  submitted: boolean;
}) {
  const id = useId();
  const errors = submitted ? windowErrors(value) : { start: "", end: "" };
  return (
    <div className="constraint-window-fields">
      <div>
        <LabeledField label="Start">
          <input
            type="datetime-local"
            value={value.start}
            aria-invalid={!!errors.start}
            aria-describedby={errors.start ? id + "-start" : undefined}
            onChange={(event) =>
              onChange({ ...value, start: event.target.value })
            }
          />
        </LabeledField>
        {errors.start && (
          <p id={id + "-start"} className="error-text" role="alert">
            {errors.start}
          </p>
        )}
      </div>
      <div>
        <LabeledField label="End">
          <input
            type="datetime-local"
            value={value.end}
            aria-invalid={!!errors.end}
            aria-describedby={errors.end ? id + "-end" : undefined}
            onChange={(event) =>
              onChange({ ...value, end: event.target.value })
            }
          />
        </LabeledField>
        {errors.end && (
          <p id={id + "-end"} className="error-text" role="alert">
            {errors.end}
          </p>
        )}
      </div>
    </div>
  );
}
function GroupEditor({
  group,
  planRef,
  queueEdit,
  wholeSeries,
}: {
  group: TimeConstraintGroupDTO;
  planRef: PlanRef;
  queueEdit: Props["queueEdit"];
  wholeSeries: boolean;
}) {
  const [windows, setWindows] = useState(() => group.windows.map(formWindow));
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const signature = JSON.stringify(group.windows);
  useEffect(() => {
    if (!dirty) setWindows(group.windows.map(formWindow));
  }, [signature, dirty]);
  const build = (values = windows): DraftEdit =>
    values.length
      ? {
          type: "replaceConstraintWindows",
          planRef,
          groupId: group.constraint_group_id,
          body: { windows: values.map(parseWindow) },
        }
      : {
          type: "removeConstraintGroup",
          planRef,
          groupId: group.constraint_group_id,
        };
  const clear = () => {
    setDirty(false);
    setSubmitted(false);
  };
  useGenerationForm(
    planRef,
    () => {
      if (!dirty) return [];
      setSubmitted(true);
      return [build()];
    },
    clear,
  );
  const queue = (values = windows) => {
    setSubmitted(true);
    try {
      queueEdit(build(values));
      clear();
    } catch {
      /* Field errors are rendered beside their inputs. */
    }
  };
  return (
    <fieldset
      className="constraint-group"
      aria-label={`Time constraint group ${group.constraint_group_id}`}
    >
      <legend>USER time windows</legend>
      {(group.constraint_group_id.startsWith("draft-group:") ||
        group.constraint_group_id.startsWith("queued-group-")) && (
        <p className="muted">Pending USER group</p>
      )}
      {windows.map((window, index) => (
        <div className="constraint-window" key={index}>
          <WindowFields
            value={window}
            submitted={submitted}
            onChange={(value) => {
              setWindows((previous) =>
                previous.map((item, i) => (i === index ? value : item)),
              );
              setDirty(true);
            }}
          />
          <button
            type="button"
            className="btn-text"
            onClick={() => queue(windows.filter((_, i) => i !== index))}
          >
            Queue remove window
          </button>
        </div>
      ))}
      <div className="button-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setWindows((previous) => [...previous, { start: "", end: "" }]);
            setDirty(true);
            setSubmitted(false);
          }}
        >
          Add window
        </button>
        <button type="button" className="btn-secondary" onClick={() => queue()}>
          Queue window changes
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
        {wholeSeries && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSubmitted(true);
              try {
                const values = windows.map(parseWindow);
                queueEdit({
                  type: "addConstraintGroup",
                  planRef: templatePlanRef(planRef),
                  groupId: "draft-group:" + crypto.randomUUID(),
                  body: { windows: values },
                });
                queueEdit({
                  type: "removeConstraintGroup",
                  planRef,
                  groupId: group.constraint_group_id,
                });
                clear();
              } catch {
                /* Keep invalid fields available for correction. */
              }
            }}
          >
            Move to first-instance template
          </button>
        )}
      </div>
    </fieldset>
  );
}

export default function PlanConstraintsPanel({
  plan,
  editMode,
  draftEdits,
  queueEdit,
  targetRef,
  title,
}: Props) {
  const [newWindow, setNewWindow] = useState<WindowForm>({
    start: "",
    end: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const planRef = targetRef ?? persistedPlanRef(plan.plan_id);
  const canEdit = editMode && !plan.is_master;
  const groups = projectConstraintGroups(
    plan.time_constraint_groups,
    draftEdits,
    planRef,
    persistedPlanRef(plan.plan_id),
  );
  const buildNew = (): DraftEdit => ({
    type: "addConstraintGroup",
    planRef,
    groupId: "draft-group:" + crypto.randomUUID(),
    body: { windows: [parseWindow(newWindow)] },
  });
  const clear = () => {
    setNewWindow({ start: "", end: "" });
    setSubmitted(false);
  };
  useGenerationForm(
    planRef,
    () => {
      if (!canEdit || (!newWindow.start && !newWindow.end)) return [];
      setSubmitted(true);
      return [buildNew()];
    },
    clear,
  );
  return (
    <div className={targetRef ? "template-constraints" : "detail-panel"}>
      <h3>
        {title ??
          (plan.repetition_detail
            ? "Whole-series time constraints"
            : "Time constraints")}
      </h3>
      {!groups.length && <p className="muted">No constraint groups.</p>}
      {groups.map((group) =>
        canEdit && group.constraint_kind === "USER" ? (
          <GroupEditor
            key={group.constraint_group_id}
            group={group}
            planRef={planRef}
            queueEdit={queueEdit}
            wholeSeries={!!plan.repetition_detail}
          />
        ) : (
          <div key={group.constraint_group_id} className="constraint-group">
            <p>{group.constraint_kind}</p>
            <ul>
              {group.windows.map((window) => (
                <li key={window.time_window_id}>
                  {formatDateTime(window.start_time)} to{" "}
                  {formatDateTime(window.end_time)}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
      {canEdit && (
        <fieldset className="settings-fieldset">
          <legend>New time window</legend>
          <WindowFields
            value={newWindow}
            submitted={submitted}
            onChange={setNewWindow}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSubmitted(true);
              try {
                queueEdit(buildNew());
                clear();
              } catch {
                /* Field-level errors identify the invalid new window. */
              }
            }}
          >
            Queue add group
          </button>
        </fieldset>
      )}
    </div>
  );
}
