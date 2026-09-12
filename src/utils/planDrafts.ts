import { persistedPlanRef, templatePlanRef, type DraftEdit, type PlanRef } from "../api/types";

export function resolvePlanRefDrafts(ref: PlanRef, resolved: Map<string, string>): PlanRef {
  if (ref.kind === "template") return templatePlanRef(resolvePlanRefDrafts(ref.repetitionRef, resolved));
  return ref.kind === "draft" && resolved.has(ref.draftId) ? persistedPlanRef(resolved.get(ref.draftId)!) : ref;
}

export function resolveDraftEditRefs(
  edit: DraftEdit,
  resolved: Map<string, string>,
): DraftEdit {
  const resolve = (ref: PlanRef): PlanRef => resolvePlanRefDrafts(ref, resolved);
  if (edit.type === "createChild")
    return { ...edit, parentRef: resolve(edit.parentRef) };
  if (edit.type === "addPrerequisite" || edit.type === "removePrerequisite")
    return {
      ...edit,
      planRef: resolve(edit.planRef),
      prerequisitePlanRef: resolve(edit.prerequisitePlanRef),
    };
  return { ...edit, planRef: resolve(edit.planRef) };
}

export function removeDraftWithDependents(
  edits: DraftEdit[],
  index: number,
): DraftEdit[] {
  const removed = new Set<string>();
  const referencesRemoved = (ref: PlanRef): boolean =>
    ref.kind === "template" ? referencesRemoved(ref.repetitionRef) : ref.kind === "draft" && removed.has(ref.draftId);
  return edits.filter((edit, currentIndex) => {
    const depends =
      edit.type === "createChild"
        ? referencesRemoved(edit.parentRef)
        : referencesRemoved(edit.planRef) ||
          ((edit.type === "addPrerequisite" ||
            edit.type === "removePrerequisite") &&
            referencesRemoved(edit.prerequisitePlanRef));
    if (currentIndex !== index && !depends) return true;
    if (edit.type === "createChild") removed.add(edit.draftId);
    return false;
  });
}
