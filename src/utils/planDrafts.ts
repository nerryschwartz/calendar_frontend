import {
  persistedPlanRef,
  planRefKey,
  templatePlanRef,
  type DraftEdit,
  type PlanRef,
} from "../api/types";

export function resolvePlanRefDrafts(
  ref: PlanRef,
  resolved: Map<string, string>,
): PlanRef {
  const known = resolved.get(planRefKey(ref));
  if (known) return persistedPlanRef(known);
  if (ref.kind === "template")
    return templatePlanRef(resolvePlanRefDrafts(ref.repetitionRef, resolved));
  return ref.kind === "draft" && resolved.has(ref.draftId)
    ? persistedPlanRef(resolved.get(ref.draftId)!)
    : ref;
}

export function resolveDraftEditRefs(
  edit: DraftEdit,
  resolved: Map<string, string>,
): DraftEdit {
  const resolve = (ref: PlanRef): PlanRef =>
    resolvePlanRefDrafts(ref, resolved);
  if (edit.type === "reorderChildren")
    return {
      ...edit,
      planRef: resolve(edit.planRef),
      criticalRefs: edit.criticalRefs.map(resolve),
      nonCriticalRefs: edit.nonCriticalRefs.map(resolve),
      previousChildRefs: edit.previousChildRefs.map(resolve),
    };
  if (edit.type === "generateInstances")
    return {
      ...edit,
      planRef: resolve(edit.planRef),
      sourceRefs: Object.fromEntries(
        Object.entries(edit.sourceRefs).map(([key, ref]) => [
          key,
          resolve(ref),
        ]),
      ),
      resolvedRefs: { ...edit.resolvedRefs, ...Object.fromEntries(resolved) },
    };
  if ("groupId" in edit) {
    return {
      ...edit,
      planRef: resolve(edit.planRef),
      groupId: edit.groupId
        ? (resolved.get(edit.groupId) ?? edit.groupId)
        : undefined,
      ...("windowId" in edit
        ? { windowId: resolved.get(edit.windowId) ?? edit.windowId }
        : {}),
    } as DraftEdit;
  }
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
  const excluded = new Set([index]);
  const referencesRemoved = (ref: PlanRef): boolean =>
    ref.kind === "template"
      ? referencesRemoved(ref.repetitionRef)
      : ref.kind === "draft" && removed.has(ref.draftId);
  let changed = true;
  while (changed) {
    changed = false;
    edits.forEach((edit, currentIndex) => {
      const depends =
        edit.type === "createChild"
          ? referencesRemoved(edit.parentRef)
          : referencesRemoved(edit.planRef) ||
            ((edit.type === "addPrerequisite" ||
              edit.type === "removePrerequisite") &&
              referencesRemoved(edit.prerequisitePlanRef));
      if (!excluded.has(currentIndex) && !depends) return;
      if (!excluded.has(currentIndex)) {
        excluded.add(currentIndex);
        changed = true;
      }
      const add = (id: string) => {
        if (!removed.has(id)) {
          removed.add(id);
          changed = true;
        }
      };
      if (edit.type === "createChild") add(edit.draftId);
      if (edit.type === "generateInstances")
        edit.preview.instances.forEach((instance) =>
          instance.nodes.forEach((node) => add(node.ref)),
        );
    });
  }
  return edits
    .filter((_, currentIndex) => !excluded.has(currentIndex))
    .map((edit) =>
      edit.type === "reorderChildren"
        ? {
            ...edit,
            criticalRefs: edit.criticalRefs.filter(
              (ref) => !referencesRemoved(ref),
            ),
            nonCriticalRefs: edit.nonCriticalRefs.filter(
              (ref) => !referencesRemoved(ref),
            ),
            previousChildRefs: edit.previousChildRefs.filter(
              (ref) => !referencesRemoved(ref),
            ),
          }
        : edit,
    );
}
