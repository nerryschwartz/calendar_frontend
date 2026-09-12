import { useCallback, useState } from "react";
import { useSharedPlanDrafts } from "../components/PlanDraftProvider";
import { removeDraftWithDependents } from "../utils/planDrafts";
import { resolveDraftEditRefs, resolvePlanRefDrafts } from "../utils/planDrafts";
import { generationEdits } from "../utils/repetitionDrafts";
import { generateRepetitionInstances, getRepetitionGenerationStatus } from "../api/repetitions";
import {
  applyDraftEdits,
  isDraftEditApplyError,
  validatePlans,
  getPlanDetail,
} from "../api/plans";
import { refreshSchedule } from "../api/schedule";
import {
  isApiError,
  type ApiErrorDetail,
  type DraftEdit,
  type RefreshScheduleResult,
  type PlanRef,
  planRefKey,
} from "../api/types";

interface UsePlanEditModeOptions {
  onSaved?: (result: {
    editCount: number;
    refreshResult?: RefreshScheduleResult;
  }) => void;
}

export function usePlanEditMode({ onSaved }: UsePlanEditModeOptions = {}) {
  const {
    editMode,
    setEditMode,
    draftEdits,
    setDraftEdits,
    saving,
    setSaving,
    actionLock,
    generationForms,
  } = useSharedPlanDrafts();
  const [refreshingSchedule, setRefreshingSchedule] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] =
    useState<RefreshScheduleResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const queueEdit = useCallback((edit: DraftEdit) => {
    setDraftEdits((prev) => [...prev, edit]);
    setSuccessMessage(null);
  }, []);

  const removeDraft = useCallback((index: number) => {
    setDraftEdits((prev) => removeDraftWithDependents(prev, index));
  }, []);

  const clearDrafts = useCallback(() => {
    setDraftEdits([]);
    setError(null);
    setSuccessMessage(null);
    setRefreshResult(null);
  }, []);

  const enterEditMode = useCallback(() => {
    setEditMode(true);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const requestExitEditMode = useCallback(() => {
    if (draftEdits.length > 0) {
      setConfirmExit(true);
      return;
    }
    setEditMode(false);
    setError(null);
  }, [draftEdits.length]);

  const discardAndExit = useCallback(() => {
    clearDrafts();
    setEditMode(false);
    setConfirmExit(false);
  }, [clearDrafts]);

  const saveEdits = useCallback(async () => {
    if (draftEdits.length === 0 || actionLock.current) return;
    actionLock.current = true;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setRefreshResult(null);
    const toSave = draftEdits;
    try {
      const editCount = await applyDraftEdits(toSave);
      clearDrafts();
      setEditMode(false);
      setConfirmExit(false);
      onSaved?.({ editCount });
      await validatePlans();
      setEditMode(false);
      setConfirmExit(false);
      setSuccessMessage(`Saved ${editCount} edit(s); refreshing schedule`);

      setRefreshingSchedule(true);
      void refreshSchedule()
        .then((result) => {
          setRefreshResult(result);
          setSuccessMessage(
            `Saved ${editCount} edit(s), validated, and refreshed schedule`,
          );
        })
        .catch((err: unknown) => {
          setError(
            isApiError(err)
              ? err.detail
              : {
                  errors: [
                    {
                      code: "UNKNOWN",
                      message:
                        err instanceof Error
                          ? err.message
                          : "Schedule refresh failed",
                      details: {},
                    },
                  ],
                },
          );
          setSuccessMessage(
            `Saved ${editCount} edit(s), but schedule refresh failed`,
          );
        })
        .finally(() => {
          setRefreshingSchedule(false);
        });
    } catch (err) {
      const failedEditError =
        isDraftEditApplyError(err) && err.cause ? err.cause : err;

      if (isDraftEditApplyError(err)) {
        setDraftEdits(err.remainingEdits ?? toSave.slice(err.appliedCount));
      }

      if (isApiError(failedEditError)) {
        setError(failedEditError.detail);
      } else {
        setError({
          errors: [
            {
              code: "UNKNOWN",
              message:
                failedEditError instanceof Error
                  ? failedEditError.message
                  : "Save failed",
              details: {},
            },
          ],
        });
      }
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  }, [clearDrafts, draftEdits, onSaved, saving]);

  const generateInstances = async (ref: PlanRef, additions: DraftEdit[] = []): Promise<string | undefined> => {
    if (actionLock.current) return;
    actionLock.current = true;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    let appliedCount = 0;
    let selectedId: string | undefined;
    try {
      const templateIds: string[] = [];
      if (ref.kind === "persisted") {
        const repetition = (await getPlanDetail(ref.planId)).repetition_detail;
        if (!repetition) throw new Error("Selected plan is not a repetition");
        const visit = async (id: string): Promise<void> => {
          templateIds.push(id);
          const detail = await getPlanDetail(id);
          for (const child of detail.children) await visit(child.plan_id);
        };
        await visit(repetition.template_root_id);
      }
      const forms = [...generationForms.current.values()].filter((form) =>
        planRefKey(form.ref) === planRefKey(ref) ||
        (form.ref.kind === "template" && planRefKey(form.ref.repetitionRef) === planRefKey(ref)) ||
        (form.ref.kind === "persisted" && templateIds.includes(form.ref.planId))
      );
      const current = forms.flatMap((form) => form.edits());
      const all = [...draftEdits, ...additions, ...current];
      const selected = generationEdits(all, ref, templateIds);
      setDraftEdits(all);
      forms.forEach((form) => form.clear());
      let resolved = new Map<string, string>();
      const completed = new Set<DraftEdit>();
      await applyDraftEdits(selected, (edit, ids) => {
        appliedCount += 1;
        completed.add(edit);
        resolved = new Map(ids);
        setDraftEdits(all.filter((entry) => !completed.has(entry)).map((entry) => resolveDraftEditRefs(entry, resolved)));
      });
      const persisted = resolvePlanRefDrafts(ref, resolved);
      if (persisted.kind !== "persisted") throw new Error("Repetition was not created");
      selectedId = persisted.planId;
      const before = await getPlanDetail(selectedId);
      if (!before.repetition_detail?.generated_at) {
        try { await generateRepetitionInstances(selectedId); }
        catch (err) {
          const observed = await getPlanDetail(selectedId);
          if (!observed.repetition_detail?.generated_at) throw err;
        }
      }
      const status = await getRepetitionGenerationStatus();
      const generated = status.repetitions.find((item) => item.plan_id === selectedId);
      setSuccessMessage(`Generated ${generated?.instance_count ?? 0} instance(s); applied ${appliedCount} edit(s)`);
      onSaved?.({ editCount: appliedCount });
      return selectedId;
    } catch (err) {
      const cause = isDraftEditApplyError(err) ? err.cause : err;
      setError(isApiError(cause) ? cause.detail : { errors: [{ code: "GENERATION_FAILED", message: cause instanceof Error ? cause.message : "Generation failed", details: {} }] });
      if (appliedCount) {
        setSuccessMessage(`Applied ${appliedCount} edit(s); remaining edits are queued`);
        onSaved?.({ editCount: appliedCount });
      }
      return selectedId;
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  };

  const cancelExit = useCallback(() => {
    setConfirmExit(false);
  }, []);

  return {
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
    generateInstances,
    cancelExit,
    setError,
    setSuccessMessage,
  };
}
