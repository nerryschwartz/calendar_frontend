import {
  draftPlanRef,
  planRefKey,
  type DraftEdit,
  type PlanRef,
} from "../api/types";
import { editReferences } from "./repetitionDrafts";
import { allPendingPlans } from "./generatedPlans";

export function orderSaveEdits(edits: DraftEdit[]): DraftEdit[] {
  const producers = new Map<string, DraftEdit>();
  for (const edit of edits) {
    if (edit.type === "createChild")
      producers.set(planRefKey(draftPlanRef(edit.draftId)), edit);
    if (edit.type === "generateInstances")
      for (const instance of edit.preview.instances)
        for (const node of instance.nodes)
          producers.set(planRefKey(draftPlanRef(node.ref)), edit);
  }
  const dependency = (ref: PlanRef): DraftEdit | undefined =>
    ref.kind === "template"
      ? dependency(ref.repetitionRef)
      : producers.get(planRefKey(ref));
  const ordered: DraftEdit[] = [],
    visiting = new Set<DraftEdit>(),
    done = new Set<DraftEdit>();
  const visit = (edit: DraftEdit) => {
    if (done.has(edit)) return;
    if (visiting.has(edit))
      throw new Error("Queued plan dependencies contain a cycle");
    visiting.add(edit);
    for (const ref of editReferences(edit)) {
      const producer = dependency(ref);
      if (producer && producer !== edit) visit(producer);
    }
    if (edit.type === "generateInstances") {
      const inputRefs = new Set(Object.values(edit.sourceRefs).map(planRefKey));
      for (const candidate of edits) {
        if (candidate === edit || candidate.type === "generateInstances")
          continue;
        const ref =
          candidate.type === "createChild"
            ? draftPlanRef(candidate.draftId)
            : candidate.planRef;
        if (
          inputRefs.has(planRefKey(ref)) ||
          (ref.kind === "template" &&
            inputRefs.has(planRefKey(ref.repetitionRef)))
        )
          visit(candidate);
      }
      for (const ref of Object.values(edit.sourceRefs)) {
        const producer = dependency(ref);
        if (producer && producer !== edit) visit(producer);
      }
    }
    visiting.delete(edit);
    done.add(edit);
    ordered.push(edit);
  };
  edits.forEach(visit);
  return ordered;
}

export function omittedInstanceIndices(
  batch: Extract<DraftEdit, { type: "generateInstances" }>,
  edits: DraftEdit[],
): number[] {
  const pending = allPendingPlans(edits);
  const deleted = new Set(
    edits
      .filter((edit) => edit.type === "delete")
      .map((edit) => planRefKey(edit.planRef)),
  );
  const removed = (ref: PlanRef, seen = new Set<string>()): boolean => {
    const key = planRefKey(ref);
    if (deleted.has(key)) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    const item = pending.find((item) => key === "draft:" + item.draftId);
    return item ? removed(item.parentRef, seen) : false;
  };
  return [
    ...new Set([
      ...(batch.omittedIndices ?? []),
      ...batch.preview.instances
        .filter((instance) => removed(draftPlanRef(instance.root_ref)))
        .map((instance) => instance.instance_index),
    ]),
  ].sort((a, b) => a - b);
}
