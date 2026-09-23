import { useCallback, useEffect, useState } from "react";
import { useSharedPlanDrafts } from "../components/PlanDraftProvider";
import { removeDraftWithDependents } from "../utils/planDrafts";
import {
  generationBaseline,
  generationInput,
  generationIsFresh,
} from "../utils/generationInput";
import { previewRepetitionInstances } from "../api/repetitionGeneration";
import {
  repetitionReadiness,
  type GenerationBlocker,
} from "../api/repetitionReadiness";
import {
  applyDraftEdits,
  isDraftEditApplyError,
  validatePlans,
} from "../api/plans";
import { refreshSchedule } from "../api/schedule";
import {
  isApiError,
  type DraftEdit,
  type RefreshScheduleResult,
  type PlanRef,
  planRefKey,
} from "../api/types";

interface UsePlanEditModeOptions {
  onGenerated?: () => void;
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
    refreshingSchedule,
    setRefreshingSchedule,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    refreshResult,
    setRefreshResult,
  } = useSharedPlanDrafts();
  const [confirmExit, setConfirmExit] = useState(false);
  const [generationBlockers, setGenerationBlockers] = useState<
    GenerationBlocker[]
  >([]);
  useEffect(() => {
    if (!editMode || saving) return;
    let active = true;
    void repetitionReadiness(draftEdits)
      .then(({ blockers }) => {
        if (active) setGenerationBlockers(blockers);
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            isApiError(err)
              ? err.detail
              : {
                  errors: [
                    {
                      code: "READINESS_FAILED",
                      message:
                        err instanceof Error
                          ? err.message
                          : "Could not check repetition readiness",
                      details: {},
                    },
                  ],
                },
          );
      });
    return () => {
      active = false;
    };
  }, [draftEdits, editMode, saving]);

  const queueEdit = useCallback((edit: DraftEdit) => {
    if (actionLock.current) return;
    setDraftEdits((prev) => [
      ...prev.filter(
        (current) =>
          edit.type !== "reorderChildren" ||
          current.type !== "reorderChildren" ||
          planRefKey(current.planRef) !== planRefKey(edit.planRef),
      ),
      edit.type === "addConstraintGroup"
        ? {
            ...edit,
            groupId: edit.groupId ?? "draft-group:" + crypto.randomUUID(),
          }
        : edit,
    ]);
    setSuccessMessage(null);
  }, []);

  const removeDraft = useCallback((index: number) => {
    if (actionLock.current) return;
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
    if (actionLock.current) return;
    if (draftEdits.length > 0) {
      setConfirmExit(true);
      return;
    }
    setEditMode(false);
    setError(null);
  }, [draftEdits.length]);

  const discardAndExit = useCallback(() => {
    if (actionLock.current) return;
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
    let savedCount: number | null = null;
    try {
      const readiness = await repetitionReadiness(toSave);
      setGenerationBlockers(readiness.blockers);
      if (readiness.blockers.length) {
        setConfirmExit(false);
        throw new Error(
          "Generate instances before saving: " +
            readiness.blockers.map((item) => item.name).join(", "),
        );
      }
      const editCount = await applyDraftEdits(readiness.effectiveEdits);
      savedCount = editCount;
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
          const status =
            result.assignment?.optimization_status ??
            result.block_assignment?.optimization_status;
          setSuccessMessage(
            status === "UNKNOWN"
              ? `Saved ${editCount} edit(s), but scheduling stopped without proving feasibility or infeasibility`
              : status === "INFEASIBLE"
                ? `Saved ${editCount} edit(s), but scheduling found no feasible calendar`
                : `Saved ${editCount} edit(s), validated, and refreshed schedule`,
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
      if (savedCount !== null)
        setSuccessMessage(
          `Saved ${savedCount} edit(s), but validation failed; the saved edits will not be replayed`,
        );
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

  const generateInstances = async (
    ref: PlanRef,
    additions: DraftEdit[] = [],
  ): Promise<string | undefined> => {
    if (actionLock.current) return;
    actionLock.current = true;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { baseline, sourceRefs } = await generationBaseline(ref, [
        ...draftEdits,
        ...additions,
      ]);
      const templateRefs = new Set(Object.values(sourceRefs).map(planRefKey));
      const forms = [...generationForms.current.values()].filter(
        (form) =>
          planRefKey(form.ref) === planRefKey(ref) ||
          (form.ref.kind === "template" &&
            planRefKey(form.ref.repetitionRef) === planRefKey(ref)) ||
          templateRefs.has(planRefKey(form.ref)),
      );
      const current = forms.flatMap((form) => form.edits());
      const all = [...draftEdits, ...additions, ...current].map(
        (edit): DraftEdit =>
          edit.type === "addConstraintGroup"
            ? {
                ...edit,
                groupId: edit.groupId ?? "draft-group:" + crypto.randomUUID(),
              }
            : edit,
      );
      setDraftEdits(all);
      forms.forEach((form) => form.clear());
      const existingIndex = all.findIndex(
        (edit) =>
          edit.type === "generateInstances" &&
          planRefKey(edit.planRef) === planRefKey(ref),
      );
      const existing = all[existingIndex];
      let remaining = all;
      if (existing?.type === "generateInstances") {
        const replacement = removeDraftWithDependents(all, existingIndex);
        const customized =
          replacement.length < all.length - 1 ||
          !!existing.omittedIndices?.length;
        if (generationIsFresh(existing, all) && !customized) {
          setSuccessMessage(
            `Already queued ${existing.preview.instances.length} instance(s); nothing saved`,
          );
          return undefined;
        }
        if (
          customized &&
          !window.confirm(
            "Regenerate instances? This replaces customized instances, omissions, and edits depending on them. Other queued work stays unchanged.",
          )
        )
          return undefined;
        remaining = replacement;
      }
      const input = generationInput(baseline, sourceRefs, remaining);
      const preview = await previewRepetitionInstances(input);
      setDraftEdits([
        ...remaining,
        {
          type: "generateInstances",
          planRef: ref,
          preview,
          baseline,
          sourceRefs,
        },
      ]);
      setSuccessMessage(
        `Queued ${preview.instances.length} instance(s); nothing saved`,
      );
      return undefined;
    } catch (err) {
      const cause = isDraftEditApplyError(err) ? err.cause : err;
      setError(
        isApiError(cause)
          ? cause.detail
          : {
              errors: [
                {
                  code: "GENERATION_FAILED",
                  message:
                    cause instanceof Error
                      ? cause.message
                      : "Generation failed",
                  details: {},
                },
              ],
            },
      );
      return undefined;
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
    generationBlockers,
    cancelExit,
    setError,
    setSuccessMessage,
  };
}
