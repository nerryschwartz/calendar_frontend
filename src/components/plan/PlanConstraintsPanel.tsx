import { useState } from "react";
import {
  addUserConstraintGroup,
  addUserWindow,
  removeUserConstraintGroup,
  removeUserWindow,
  updateUserConstraintGroup,
} from "../../api/constraints";
import type { PlanDetailDTO, TimeConstraintGroupDTO } from "../../api/types";
import LoadingButton from "../LoadingButton";
import StatusBanner from "../StatusBanner";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatDateTime, datetimeLocalToIso } from "../../utils/format";

interface PlanConstraintsPanelProps {
  plan: PlanDetailDTO;
  editMode: boolean;
  onUpdated: () => void;
}

export default function PlanConstraintsPanel({
  plan,
  editMode,
  onUpdated,
}: PlanConstraintsPanelProps) {
  const { run, error, successMessage, clearFeedback } = useAsyncAction();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const userGroups = plan.time_constraint_groups.filter(
    (g) => g.constraint_kind === "USER",
  );

  const handleAddGroup = async () => {
    if (!startTime || !endTime) return;
    await run(
      () =>
        addUserConstraintGroup(plan.plan_id, {
          windows: [
            {
              start_time: datetimeLocalToIso(startTime),
              end_time: datetimeLocalToIso(endTime),
            },
          ],
        }),
      "Constraint group added",
    );
    onUpdated();
  };

  const handleRemoveGroup = async (group: TimeConstraintGroupDTO) => {
    await run(
      () => removeUserConstraintGroup(group.constraint_group_id),
      "Constraint group removed",
    );
    onUpdated();
  };

  const handleAddWindow = async (group: TimeConstraintGroupDTO) => {
    if (!startTime || !endTime) return;
    await run(
      () =>
        addUserWindow(group.constraint_group_id, {
          start_time: datetimeLocalToIso(startTime),
          end_time: datetimeLocalToIso(endTime),
        }),
      "Window added",
    );
    onUpdated();
  };

  const handleReplaceWindows = async (group: TimeConstraintGroupDTO) => {
    if (!startTime || !endTime) return;
    await run(
      () =>
        updateUserConstraintGroup(group.constraint_group_id, {
          windows: [
            {
              start_time: datetimeLocalToIso(startTime),
              end_time: datetimeLocalToIso(endTime),
            },
          ],
        }),
      "Windows updated",
    );
    onUpdated();
  };

  return (
    <div className="detail-panel">
      <h3>Time constraints</h3>
      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      {error && (
        <p className="error-text">
          {error.errors.map((e) => e.message).join("; ")}
        </p>
      )}

      {plan.time_constraint_groups.length === 0 ? (
        <p className="muted">No constraint groups.</p>
      ) : (
        plan.time_constraint_groups.map((group) => (
          <div key={group.constraint_group_id} className="constraint-group">
            <p>
              <code>{group.constraint_kind}</code> · Group{" "}
              {group.constraint_group_id}
            </p>
            <ul>
              {group.windows.map((window) => (
                <li key={window.time_window_id}>
                  {formatDateTime(window.start_time)} →{" "}
                  {formatDateTime(window.end_time)}
                  {editMode && group.constraint_kind === "USER" && (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() =>
                        void run(
                          () =>
                            removeUserWindow(
                              group.constraint_group_id,
                              window.time_window_id,
                            ),
                          "Window removed",
                        ).then(onUpdated)
                      }
                    >
                      Remove window
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editMode && group.constraint_kind === "USER" && (
              <div className="button-row">
                <LoadingButton
                  variant="secondary"
                  onClick={() => void handleAddWindow(group)}
                >
                  Add window
                </LoadingButton>
                <LoadingButton
                  variant="secondary"
                  onClick={() => void handleReplaceWindows(group)}
                >
                  Replace windows
                </LoadingButton>
                <LoadingButton
                  variant="danger"
                  onClick={() => void handleRemoveGroup(group)}
                >
                  Remove group
                </LoadingButton>
              </div>
            )}
          </div>
        ))
      )}

      {editMode && (
        <fieldset>
          <legend>Add USER constraint group</legend>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <LoadingButton
            variant="secondary"
            onClick={() => void handleAddGroup()}
          >
            Add group
          </LoadingButton>
        </fieldset>
      )}

      {userGroups.length === 0 && !editMode && (
        <p className="muted">
          No user-editable constraints. Enter edit mode to add.
        </p>
      )}
    </div>
  );
}
