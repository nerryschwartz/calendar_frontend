import { persistedPlanRef, type DraftEdit, type PlanRef } from "../api/types";

export function resolveDraftEditRefs(
  edit: DraftEdit,
  resolved: Map<string, string>,
): DraftEdit {
  const resolve = (ref: PlanRef): PlanRef =>
    ref.kind === "draft" && resolved.has(ref.draftId)
      ? persistedPlanRef(resolved.get(ref.draftId)!)
      : ref;
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
  const referencesRemoved = (ref: PlanRef) =>
    ref.kind === "draft" && removed.has(ref.draftId);
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
