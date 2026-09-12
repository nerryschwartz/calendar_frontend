import { draftPlanRef, planRefKey, templatePlanRef, type DraftEdit, type PlanRef } from "../api/types";

export function editReferences(edit: DraftEdit): PlanRef[] {
  if (edit.type === "createChild") return [edit.parentRef];
  return edit.type === "addPrerequisite" || edit.type === "removePrerequisite"
    ? [edit.planRef, edit.prerequisitePlanRef] : [edit.planRef];
}

export function generationEdits(edits: DraftEdit[], repetition: PlanRef, templateIds: string[] = []): DraftEdit[] {
  const blueprint = new Set([planRefKey(templatePlanRef(repetition)), ...templateIds.map((id) => "persisted:" + id)]);
  const needed = new Set([planRefKey(repetition), ...blueprint]);
  const creates = new Map(edits.filter((edit) => edit.type === "createChild").map((edit) => [edit.draftId, edit]));
  const selected = new Set<DraftEdit>();
  const requireDraft = (ref: PlanRef) => {
    if (ref.kind === "template") { requireDraft(ref.repetitionRef); return; }
    if (ref.kind === "draft") {
      if (!creates.has(ref.draftId)) throw new Error("Pending dependency is missing: " + ref.draftId);
      needed.add(planRefKey(ref));
      needed.add(planRefKey(templatePlanRef(ref)));
      blueprint.add(planRefKey(templatePlanRef(ref)));
    }
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const edit of edits) {
      const ref = edit.type === "createChild" ? draftPlanRef(edit.draftId) : edit.planRef;
      const templateChild = edit.type === "createChild" && blueprint.has(planRefKey(edit.parentRef));
      if (!selected.has(edit) && (needed.has(planRefKey(ref)) || templateChild)) {
        if (edit.type === "delete") throw new Error("Remove the queued deletion before generating this repetition");
        selected.add(edit);
        needed.add(planRefKey(ref));
        if (templateChild) blueprint.add(planRefKey(ref));
        editReferences(edit).forEach(requireDraft);
        changed = true;
      }
    }
  }
  const ordered: DraftEdit[] = [];
  const visiting = new Set<DraftEdit>();
  const done = new Set<DraftEdit>();
  const visit = (edit: DraftEdit) => {
    if (done.has(edit)) return;
    if (visiting.has(edit)) throw new Error("Pending plan dependencies contain a cycle");
    visiting.add(edit);
    const visitRef = (ref: PlanRef): void => {
      if (ref.kind === "template") return visitRef(ref.repetitionRef);
      if (ref.kind === "draft") visit(creates.get(ref.draftId)!);
    };
    editReferences(edit).forEach(visitRef);
    visiting.delete(edit);
    done.add(edit);
    ordered.push(edit);
  };
  edits.filter((edit) => selected.has(edit)).forEach(visit);
  return ordered;
}
