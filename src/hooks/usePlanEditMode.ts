import { useCallback, useState } from "react";
import { applyDraftEdits, validatePlans } from "../api/plans";
import { refreshSchedule } from "../api/schedule";
import {
  isApiError,
  type ApiErrorDetail,
  type DraftEdit,
  type RefreshScheduleResult,
} from "../api/types";

interface UsePlanEditModeOptions {
  onSaved?: (result: {
    editCount: number;
    refreshResult: RefreshScheduleResult;
  }) => void;
}

export function usePlanEditMode({ onSaved }: UsePlanEditModeOptions = {}) {
  const [editMode, setEditMode] = useState(false);
  const [draftEdits, setDraftEdits] = useState<DraftEdit[]>([]);
  const [saving, setSaving] = useState(false);
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
    setDraftEdits((prev) => prev.filter((_, i) => i !== index));
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
    if (draftEdits.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const editCount = draftEdits.length;
      await applyDraftEdits(draftEdits);
      await validatePlans();
      const result = await refreshSchedule();
      setRefreshResult(result);
      clearDrafts();
      setEditMode(false);
      setConfirmExit(false);
      setSuccessMessage(
        `Saved ${editCount} edit(s), validated, and refreshed schedule`,
      );
      onSaved?.({ editCount, refreshResult: result });
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail);
      } else {
        setError({
          errors: [
            {
              code: "UNKNOWN",
              message: err instanceof Error ? err.message : "Save failed",
              details: {},
            },
          ],
        });
      }
    } finally {
      setSaving(false);
    }
  }, [clearDrafts, draftEdits, onSaved]);

  const cancelExit = useCallback(() => {
    setConfirmExit(false);
  }, []);

  return {
    editMode,
    draftEdits,
    saving,
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
  };
}
