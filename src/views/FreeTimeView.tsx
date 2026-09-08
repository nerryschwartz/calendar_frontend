import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applyFreeTimeDraft, listFreeTimeActivities } from "../api/freeTime";
import type { FreeTimeActivityDTO } from "../api/types";
import LabeledField from "../components/LabeledField";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import PlanSearchInput from "../components/PlanSearchInput";
import StatusBanner from "../components/StatusBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useCalendarRefresh } from "../hooks/useCalendarRefresh";
import {
  activityDraft,
  buildFreeTimeEdits,
  enabledFraction,
  type FreeTimeDraftRow,
} from "../utils/freeTimeDrafts";

export default function FreeTimeView() {
  const refresh = useCalendarRefresh();
  const [activities, setActivities] = useState<FreeTimeActivityDTO[]>([]);
  const [rows, setRows] = useState<FreeTimeDraftRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const {
    run,
    loading,
    error,
    successMessage,
    clearFeedback,
    setSuccessMessage,
  } = useAsyncAction();
  const load = useCallback(async () => {
    const data = await run(listFreeTimeActivities);
    if (data) {
      setActivities(data.activities);
      setLoaded(true);
    }
  }, [run]);
  useEffect(() => {
    void load();
  }, [load]);

  const beginEdit = () => {
    clearFeedback();
    refresh.clearFeedback();
    setRows(activities.map(activityDraft));
    setDirty(false);
    setEditing(true);
  };
  const update = (ref: string, patch: Partial<FreeTimeDraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.ref === ref ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const remove = (row: FreeTimeDraftRow) => {
    if (row.ref.startsWith("draft:"))
      setRows((current) => current.filter((item) => item.ref !== row.ref));
    else
      setRows((current) =>
        current.map((item) =>
          item.ref === row.ref ? { ...item, deleted: true } : item,
        ),
      );
    setDirty(true);
  };
  const discard = () => {
    setEditing(false);
    setRows([]);
    setDirty(false);
    setConfirmDiscard(false);
    clearFeedback();
  };
  const save = async () => {
    if (loading) return;
    const data = await run(async () => {
      const edits = buildFreeTimeEdits(rows, activities);
      if (!edits.length) return { activities, applied_count: 0 };
      return applyFreeTimeDraft(edits);
    }, "Free-time activities saved");
    if (data) {
      setActivities(data.activities);
      setRows([]);
      setDirty(false);
      setEditing(false);
      setConfirmDiscard(false);
      if (data.applied_count > 0) void refresh.runRefresh();
    }
  };
  const total = enabledFraction(rows);
  const totalValid = total != null && Math.abs(total - 1) < 1e-9;

  return (
    <section className="view">
      <div className="view-header">
        <h2>Free-Time Activities</h2>
        <div className="button-row">
          {editing ? (
            <>
              <LoadingButton
                loading={loading}
                loadingLabel="Saving..."
                disabled={!dirty}
                onClick={() => void save()}
              >
                Save activities
              </LoadingButton>
              <button
                type="button"
                className="btn-secondary"
                disabled={loading}
                onClick={() => (dirty ? setConfirmDiscard(true) : discard())}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <LoadingButton
                variant="secondary"
                loading={loading}
                onClick={() => void load()}
              >
                Reload
              </LoadingButton>
              <button
                type="button"
                className="btn-primary"
                disabled={!loaded || loading}
                onClick={beginEdit}
              >
                Edit activities
              </button>
            </>
          )}
        </div>
      </div>
      <StatusBanner
        message={
          successMessage && refresh.refreshing
            ? `${successMessage}; refreshing schedule`
            : successMessage && refresh.error
              ? `${successMessage}; schedule refresh failed`
              : successMessage
        }
        onDismiss={() => setSuccessMessage(null)}
      />
      <ErrorBanner detail={error} onDismiss={clearFeedback} />
      <ErrorBanner detail={refresh.error} onDismiss={refresh.clearFeedback} />
      {editing ? (
        <>
          <div className="free-time-total">
            <span>Total enabled fraction</span>
            <output aria-label="Total enabled fraction">
              {total == null ? "Invalid" : Number(total.toFixed(10))}
            </output>
          </div>
          {!totalValid && (
            <p className="error-text" role="status">
              Total enabled fraction is not 1.
            </p>
          )}
          <fieldset className="plan-edit-surface" disabled={loading}>
            {rows.map((row, index) => (
              <div className="activity-row" key={row.ref}>
                <div className="view-header">
                  <h3>{row.name.trim() || "New activity " + (index + 1)}</h3>
                  {row.deleted ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => update(row.ref, { deleted: false })}
                    >
                      Undo delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => remove(row)}
                    >
                      Delete activity
                    </button>
                  )}
                </div>
                {row.deleted ? (
                  <p className="muted">Pending deletion</p>
                ) : (
                  <div className="activity-fields">
                    <LabeledField label="Name">
                      <input
                        value={row.name}
                        onChange={(event) =>
                          update(row.ref, { name: event.target.value })
                        }
                      />
                    </LabeledField>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) =>
                          update(row.ref, { enabled: event.target.checked })
                        }
                      />
                      Enabled
                    </label>
                    <LabeledField label="Real fraction">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.fraction}
                        onChange={(event) =>
                          update(row.ref, { fraction: event.target.value })
                        }
                      />
                    </LabeledField>
                    <LabeledField label="Minimum block (min)">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.minBlock}
                        onChange={(event) =>
                          update(row.ref, { minBlock: event.target.value })
                        }
                      />
                    </LabeledField>
                    <LabeledField label="Block families">
                      <input
                        value={row.families}
                        placeholder="Comma-separated"
                        onChange={(event) =>
                          update(row.ref, { families: event.target.value })
                        }
                      />
                    </LabeledField>
                    <div className="activity-prerequisites">
                      <PlanSearchInput
                        label="Prerequisite plan"
                        onSelect={(result) => {
                          if (!row.prerequisites.includes(result.plan_id))
                            update(row.ref, {
                              prerequisites: [
                                ...row.prerequisites,
                                result.plan_id,
                              ],
                              prerequisiteNames: {
                                ...row.prerequisiteNames,
                                [result.plan_id]: result.name,
                              },
                            });
                        }}
                      />
                      <ul>
                        {row.prerequisites.map((id) => (
                          <li key={id}>
                            <span>{row.prerequisiteNames[id] ?? id}</span>
                            <button
                              type="button"
                              className="btn-text"
                              onClick={() =>
                                update(row.ref, {
                                  prerequisites: row.prerequisites.filter(
                                    (value) => value !== id,
                                  ),
                                })
                              }
                            >
                              Remove prerequisite
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setRows((current) => [
                  ...current,
                  {
                    ref: "draft:" + crypto.randomUUID(),
                    name: "",
                    enabled: true,
                    fraction: current.some((row) => row.enabled && !row.deleted)
                      ? "0.25"
                      : "1",
                    minBlock: "15",
                    families: "",
                    prerequisites: [],
                    prerequisiteNames: {},
                    deleted: false,
                  },
                ]);
                setDirty(true);
              }}
            >
              Add free-time activity
            </button>
          </fieldset>
        </>
      ) : !loaded ? (
        <p className="muted">
          {loading ? "Loading activities..." : "Activities unavailable."}
        </p>
      ) : activities.length === 0 ? (
        <p className="muted">No free-time activities configured.</p>
      ) : (
        activities.map((activity) => (
          <div className="activity-row" key={activity.free_time_activity_id}>
            <div className="view-header">
              <h3>{activity.name}</h3>
              <span className={activity.enabled ? "badge-ok" : "badge-muted"}>
                {activity.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p>
              Fraction: {activity.real_fraction} · Minimum block:{" "}
              {activity.minimum_block_size_minutes} min
            </p>
            <p>
              Block families:{" "}
              {activity.allowed_block_families.join(", ") || "none"}
            </p>
            <p>
              Prerequisites:{" "}
              {activity.prerequisite_plan_ids.length === 0
                ? "none"
                : activity.prerequisite_plan_ids.map((id) => (
                    <Link key={id} to={"/plan-tree/" + id}>
                      {id}{" "}
                    </Link>
                  ))}
            </p>
          </div>
        ))
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="Unsaved activities"
        message="Discard the pending activity changes?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </section>
  );
}
