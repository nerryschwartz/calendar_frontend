import { createContext, useContext, useState, type ReactNode } from "react";
import type { DraftEdit } from "../api/types";

function useDraftState() {
  const [editMode, setEditMode] = useState(false);
  const [draftEdits, setDraftEdits] = useState<DraftEdit[]>([]);
  const [saving, setSaving] = useState(false);
  return {
    editMode,
    setEditMode,
    draftEdits,
    setDraftEdits,
    saving,
    setSaving,
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
