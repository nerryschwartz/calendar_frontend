import { useCallback, useState } from 'react'
import { applyDraftEdits, validatePlans } from '../api/plans'
import { refreshSchedule } from '../api/schedule'
import { isApiError, type ApiErrorDetail, type DraftEdit } from '../api/types'

interface UsePlanEditModeOptions {
  onSaved?: () => void
}

export function usePlanEditMode({ onSaved }: UsePlanEditModeOptions = {}) {
  const [editMode, setEditMode] = useState(false)
  const [draftEdits, setDraftEdits] = useState<DraftEdit[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiErrorDetail | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  const queueEdit = useCallback((edit: DraftEdit) => {
    setDraftEdits((prev) => [...prev, edit])
  }, [])

  const clearDrafts = useCallback(() => {
    setDraftEdits([])
    setError(null)
  }, [])

  const enterEditMode = useCallback(() => {
    setEditMode(true)
    setError(null)
  }, [])

  const requestExitEditMode = useCallback(() => {
    if (draftEdits.length > 0) {
      setConfirmExit(true)
      return
    }
    setEditMode(false)
    setError(null)
  }, [draftEdits.length])

  const discardAndExit = useCallback(() => {
    clearDrafts()
    setEditMode(false)
    setConfirmExit(false)
  }, [clearDrafts])

  const saveEdits = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      if (draftEdits.length > 0) {
        await applyDraftEdits(draftEdits)
      }
      await validatePlans()
      await refreshSchedule()
      clearDrafts()
      setEditMode(false)
      setConfirmExit(false)
      onSaved?.()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      } else {
        setError({
          errors: [
            {
              code: 'UNKNOWN',
              message: err instanceof Error ? err.message : 'Save failed',
              details: {},
            },
          ],
        })
      }
    } finally {
      setSaving(false)
    }
  }, [clearDrafts, draftEdits, onSaved])

  const cancelExit = useCallback(() => {
    setConfirmExit(false)
  }, [])

  return {
    editMode,
    draftEdits,
    saving,
    error,
    confirmExit,
    queueEdit,
    enterEditMode,
    requestExitEditMode,
    discardAndExit,
    saveEdits,
    cancelExit,
    setError,
  }
}
