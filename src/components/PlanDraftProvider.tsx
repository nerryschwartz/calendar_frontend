import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { planRefKey, type DraftEdit, type PlanRef } from "../api/types";

function useDraftState() {
  const [editMode, setEditMode] = useState(false);
  const [draftEdits, setDraftEdits] = useState<DraftEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const actionLock = useRef(false);
  const generationForms = useRef(new Map<symbol, { ref: PlanRef; edits: () => DraftEdit[]; clear: () => void }>());
  return {
    editMode,
    setEditMode,
    draftEdits,
    setDraftEdits,
    saving,
    setSaving,
    actionLock,
    generationForms,
  };
}
const PlanDraftContext = createContext<ReturnType<typeof useDraftState> | null>(
  null,
);

export default function PlanDraftProvider({
  children,
}: {
  children: ReactNode;
}) {
  const state = useDraftState();
  return (
    <PlanDraftContext.Provider value={state}>
      {children}
    </PlanDraftContext.Provider>
  );
}

export function useSharedPlanDrafts() {
  const shared = useContext(PlanDraftContext);
  const local = useDraftState();
  return shared ?? local;
}

export function useGenerationForm(ref: PlanRef, edits: () => DraftEdit[], clear: () => void = () => {}) {
  const { generationForms } = useSharedPlanDrafts();
  const getEdits = useRef(edits);
  getEdits.current = edits;
  const clearForm = useRef(clear);
  clearForm.current = clear;
  const key = planRefKey(ref);
  useEffect(() => {
    const token = Symbol();
    generationForms.current.set(token, { ref, edits: () => getEdits.current(), clear: () => clearForm.current() });
    return () => { generationForms.current.delete(token); };
  }, [generationForms, key]);
}
