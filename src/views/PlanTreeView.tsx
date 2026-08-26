import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getPlanDeletePreview,
  getMasterPlan,
  getPlanDetail,
} from "../api/plans";
import {
  isApiError,
  type DeletionPreviewDTO,
  type PlanDetailDTO,
} from "../api/types";
import ConfirmDialog from "../components/ConfirmDialog";
import DraftQueuePanel from "../components/DraftQueuePanel";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import PlanConstraintsPanel from "../components/plan/PlanConstraintsPanel";
import PlanEditControls from "../components/plan/PlanEditControls";
import PlanRepetitionPanel, {
  PlanDetailSections,
} from "../components/plan/PlanRepetitionPanel";
import RefreshResultPanel from "../components/RefreshResultPanel";
import StatusBanner from "../components/StatusBanner";
import { usePlanEditMode } from "../hooks/usePlanEditMode";

interface PlanTreeViewProps {
  planId?: string;
}

export default function PlanTreeView({ planId }: PlanTreeViewProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeletionPreviewDTO | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (planId) {
        setPlan(await getPlanDetail(planId));
      } else {
        const master = await getMasterPlan();
        setPlan(master.plan);
      }
    } catch (err) {
      setLoadError(isApiError(err) ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const {
    editMode,
    draftEdits,
    saving,
    refreshingSchedule,
    error,
    successMessage,
    refreshResult,
    confirmExit,
    queueEdit,
    removeDraft,
    enterEditMode,
    requestExitEditMode,
    discardAndExit,
    saveEdits,
    cancelExit,
    setError,
    setSuccessMessage,
  } = usePlanEditMode({
    onSaved: () => {
      if (
        plan &&
        draftEdits.some(
          (edit) => edit.type === "delete" && edit.planId === plan.plan_id,
        )
      ) {
        const parent = plan.ancestry.at(-1);
        navigate(parent ? `/plan-tree/${parent.plan_id}` : "/plan-tree");
        return;
      }

      void loadPlan();
    },
  });

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && plan && !editMode) {
      enterEditMode();
    }
  }, [searchParams, plan, editMode, enterEditMode]);

  const requestDelete = async () => {
    if (!plan) return;
    try {
      const preview = await getPlanDeletePreview(plan.plan_id);
      setDeletePreview(preview);
      setConfirmDelete(true);
    } catch (err) {
      setLoadError(
        isApiError(err) ? err.message : "Failed to load delete preview",
      );
    }
  };

  const confirmQueueDelete = () => {
    if (!plan) return;
    queueEdit({ type: "delete", planId: plan.plan_id });
    setConfirmDelete(false);
    setDeletePreview(null);
    setSuccessMessage("Delete queued — save edits to apply");
  };

  if (loading) return <p className="muted">Loading plan…</p>;
  if (loadError || !plan)
    return <p className="error-text">{loadError ?? "Plan not found"}</p>;

  const statusMessage =
    successMessage ?? (refreshingSchedule ? "Refreshing schedule…" : null);

  return (
    <section className="view">
      <div className="view-header">
        <div>
          <h2>{plan.name}</h2>
          <p className="muted">
            {plan.plan_kind}
            {plan.is_master && " · master"}
          </p>
        </div>
        <div className="button-row">
          {editMode ? (
            <>
              <LoadingButton
                loading={saving}
                loadingLabel="Saving…"
                disabled={draftEdits.length === 0}
                onClick={() => void saveEdits()}
              >
                Save edits
              </LoadingButton>
              <button
                type="button"
                className="btn-secondary"
                onClick={requestExitEditMode}
              >
                Exit edit mode
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={enterEditMode}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <StatusBanner
        message={statusMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
      <ErrorBanner detail={error} onDismiss={() => setError(null)} />
      <RefreshResultPanel result={refreshResult} />
      <DraftQueuePanel edits={draftEdits} onRemove={removeDraft} />

      <nav className="breadcrumb">
        {plan.ancestry.map((item) => (
          <span key={item.plan_id}>
            <Link to={`/plan-tree/${item.plan_id}`}>{item.name}</Link>
            <span className="sep"> / </span>
          </span>
        ))}
        <span>{plan.name}</span>
      </nav>

      <PlanDetailSections plan={plan} />

      {plan.repetition_detail && (
        <PlanRepetitionPanel
          detail={plan.repetition_detail}
          editMode={editMode}
          onUpdated={() => void loadPlan()}
        />
      )}

      <PlanConstraintsPanel
        plan={plan}
        editMode={editMode}
        onUpdated={() => void loadPlan()}
      />

      {editMode && <PlanEditControls plan={plan} queueEdit={queueEdit} />}

      <div className="detail-panel">
        <h3>Children</h3>
        {plan.children.length === 0 ? (
          <p className="muted">No children.</p>
        ) : (
          <ul className="link-list">
            {plan.children.map((child) => (
              <li key={child.plan_id}>
                <Link to={`/plan-tree/${child.plan_id}`}>
                  {child.name} ({child.plan_kind})
                </Link>
                <span className="muted">
                  {child.goal_is_critical != null &&
                    (child.goal_is_critical
                      ? " · critical"
                      : " · non-critical")}
                  {child.goal_sort_order != null &&
                    ` · order ${child.goal_sort_order}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="detail-panel">
        <h3>Prerequisites</h3>
        {plan.prerequisites.length === 0 ? (
          <p className="muted">No prerequisites.</p>
        ) : (
          <ul className="link-list">
            {plan.prerequisites.map((prereq) => (
              <li key={prereq.prerequisite_plan_id}>
                <Link to={`/plan-tree/${prereq.prerequisite_plan_id}`}>
                  {prereq.name} ({prereq.plan_kind})
                </Link>
                {editMode && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() =>
                      queueEdit({
                        type: "removePrerequisite",
                        planId: plan.plan_id,
                        prerequisitePlanId: prereq.prerequisite_plan_id,
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editMode && (
        <LoadingButton variant="danger" onClick={() => void requestDelete()}>
          Delete plan…
        </LoadingButton>
      )}

      <ConfirmDialog
        open={confirmExit}
        title="Unsaved edits"
        message="You have unsaved changes. Save before exiting, keep editing, or discard them?"
        confirmLabel="Save"
        cancelLabel="Discard"
        tertiaryLabel="Keep editing"
        confirmDisabled={saving || draftEdits.length === 0}
        onConfirm={() => void saveEdits()}
        onCancel={discardAndExit}
        onTertiary={cancelExit}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete plan"
        message={
          deletePreview
            ? formatDeletePreview(deletePreview)
            : "Loading preview…"
        }
        confirmLabel="Queue delete"
        cancelLabel="Cancel"
        onConfirm={confirmQueueDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeletePreview(null);
        }}
      />
    </section>
  );
}

function formatDeletePreview(preview: DeletionPreviewDTO): string {
  return [
    `Affected plans: ${preview.affected_plan_ids.length}`,
    `Affected tasks: ${preview.affected_task_ids.length}`,
    `Affected blocks: ${preview.affected_block_ids.length}`,
    `Calendar entries: ${preview.affected_calendar_entry_ids.length}`,
    preview.warnings.length > 0
      ? `Warnings: ${preview.warnings.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
