import {
  persistedPlanRef,
  planRefKey,
  type DraftEdit,
  type PlanDetailDTO,
  type PlanKind,
  type PlanRef,
} from "../api/types";
import { pendingPlanRef, pendingPlans } from "./generatedPlans";

export interface GoalChild {
  ref: PlanRef;
  name: string;
  kind: PlanKind;
  critical: boolean;
}
export type ChildOrderEdit = Extract<DraftEdit, { type: "reorderChildren" }>;

export function goalChildren(
  plan: PlanDetailDTO,
  parentRef: PlanRef,
  edits: DraftEdit[],
): GoalChild[] {
  const pending = pendingPlans(edits);
  const pendingById = new Map(pending.map((item) => [item.draftId, item]));
  const children: GoalChild[] = [...plan.children]
    .sort(
      (a, b) =>
        Number(!!b.goal_is_critical) - Number(!!a.goal_is_critical) ||
        (a.goal_sort_order ?? 0) - (b.goal_sort_order ?? 0),
    )
    .map((item) => ({
      ref: pendingById.has(item.plan_id)
        ? pendingPlanRef(pendingById.get(item.plan_id)!)
        : persistedPlanRef(item.plan_id),
      name: item.name,
      kind: item.plan_kind,
      critical: !!item.goal_is_critical,
    }));
  for (const item of pending) {
    const ref = pendingPlanRef(item);
    if (
      planRefKey(item.parentRef) === planRefKey(parentRef) &&
      !children.some((child) => planRefKey(child.ref) === planRefKey(ref))
    )
      children.push({
        ref,
        name: item.body.name,
        kind: item.body.kind,
        critical: item.body.is_critical,
      });
  }
  const deleted = new Set(
    edits
      .filter((edit) => edit.type === "delete")
      .map((edit) => planRefKey(edit.planRef)),
  );
  for (const edit of edits) {
    if (edit.type === "rename") {
      const child = children.find(
        (item) => planRefKey(item.ref) === planRefKey(edit.planRef),
      );
      if (child) child.name = edit.name;
    }
  }
  const order = [...edits]
    .reverse()
    .find(
      (edit) =>
        edit.type === "reorderChildren" &&
        planRefKey(edit.planRef) === planRefKey(parentRef),
    ) as ChildOrderEdit | undefined;
  const active = children.filter((item) => !deleted.has(planRefKey(item.ref)));
  if (!order)
    return active.sort((a, b) => Number(b.critical) - Number(a.critical));
  const ranks = new Map(
    [...order.criticalRefs, ...order.nonCriticalRefs].map((ref, index) => [
      planRefKey(ref),
      index,
    ]),
  );
  const critical = new Set(order.criticalRefs.map(planRefKey));
  return active
    .map((item) => ({
      ...item,
      critical: ranks.has(planRefKey(item.ref))
        ? critical.has(planRefKey(item.ref))
        : item.critical,
    }))
    .sort(
      (a, b) =>
        Number(b.critical) - Number(a.critical) ||
        (ranks.get(planRefKey(a.ref)) ?? Infinity) -
          (ranks.get(planRefKey(b.ref)) ?? Infinity),
    );
}

export function normalizeChildOrders(edits: DraftEdit[]): DraftEdit[] {
  const pending = pendingPlans(edits);
  const deleted = new Set(
    edits
      .filter((edit) => edit.type === "delete")
      .map((edit) => planRefKey(edit.planRef)),
  );
  return edits
    .filter(
      (edit, index) =>
        edit.type !== "reorderChildren" ||
        !edits
          .slice(index + 1)
          .some(
            (next) =>
              next.type === "reorderChildren" &&
              planRefKey(next.planRef) === planRefKey(edit.planRef),
          ),
    )
    .map((edit) => {
      if (edit.type !== "reorderChildren") return edit;
      const criticalRefs = edit.criticalRefs.filter(
        (ref) => !deleted.has(planRefKey(ref)),
      );
      const nonCriticalRefs = edit.nonCriticalRefs.filter(
        (ref) => !deleted.has(planRefKey(ref)),
      );
      const known = new Set(
        [...criticalRefs, ...nonCriticalRefs].map(planRefKey),
      );
      for (const item of pending) {
        const ref = pendingPlanRef(item);
        if (
          planRefKey(item.parentRef) === planRefKey(edit.planRef) &&
          !known.has(planRefKey(ref))
        ) {
          (item.body.is_critical ? criticalRefs : nonCriticalRefs).push(ref);
          known.add(planRefKey(ref));
        }
      }
      return { ...edit, criticalRefs, nonCriticalRefs };
    });
}
