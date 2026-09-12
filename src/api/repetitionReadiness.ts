import { getPlanDeletePreview, getPlanDetail } from "./plans";
import { getRepetitionGenerationStatus } from "./repetitions";
import { draftPlanRef, persistedPlanRef, type DraftEdit, type PlanRef } from "./types";
import { editReferences } from "../utils/repetitionDrafts";

export interface GenerationBlocker { ref: PlanRef; name: string }

export async function repetitionReadiness(edits: DraftEdit[]) {
  const { repetitions } = await getRepetitionGenerationStatus();
  const deleted = new Set<string>();
  for (const edit of edits) {
    if (edit.type === "delete" && edit.planRef.kind === "persisted") {
      const preview = await getPlanDeletePreview(edit.planRef.planId);
      deleted.add(edit.planRef.planId);
      preview.affected_plan_ids.forEach((id) => deleted.add(id));
    }
  }
  const canceled = new Set(edits.filter((edit) => edit.type === "delete" && edit.planRef.kind === "draft").map((edit) => edit.type === "delete" && edit.planRef.kind === "draft" ? edit.planRef.draftId : ""));
  const removed = (ref: PlanRef): boolean => ref.kind === "template" ? removed(ref.repetitionRef)
    : ref.kind === "persisted" ? deleted.has(ref.planId) : canceled.has(ref.draftId);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edit of edits) {
      if (edit.type === "createChild" && removed(edit.parentRef) && !canceled.has(edit.draftId)) {
        canceled.add(edit.draftId); changed = true;
      }
    }
  }
  const effectiveEdits = edits.filter((edit) => {
    if (edit.type === "createChild") return !canceled.has(edit.draftId);
    if (edit.type === "delete" && edit.planRef.kind === "persisted") return true;
    return !editReferences(edit).some(removed);
  });
  const blockers: GenerationBlocker[] = repetitions.filter((item) => !item.generated_at && !deleted.has(item.plan_id))
    .map((item) => ({ ref: persistedPlanRef(item.plan_id), name: item.name }));
  const templateIds = new Set(repetitions.map((item) => item.template_root_id));
  const creates = new Map(edits.filter((edit) => edit.type === "createChild").map((edit) => [edit.draftId, edit]));
  const isBlueprint = async (ref: PlanRef, seen = new Set<string>()): Promise<boolean> => {
    if (ref.kind === "template") return true;
    if (ref.kind === "draft") {
      if (seen.has(ref.draftId)) throw new Error("Pending plan dependencies contain a cycle");
      seen.add(ref.draftId);
      const create = creates.get(ref.draftId);
      return create ? isBlueprint(create.parentRef, seen) : false;
    }
    if (templateIds.has(ref.planId)) return true;
    const plan = await getPlanDetail(ref.planId);
    return plan.ancestry.some((ancestor) => templateIds.has(ancestor.plan_id));
  };
  for (const edit of effectiveEdits) {
    if (edit.type === "createChild" && edit.body.kind === "REPETITION" && !await isBlueprint(edit.parentRef)) {
      blockers.push({ ref: draftPlanRef(edit.draftId), name: edit.body.name });
    }
  }
  return { blockers, effectiveEdits };
}
