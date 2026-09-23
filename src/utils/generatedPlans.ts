import type { ProjectionNode } from "../api/repetitionGeneration";
import {
  draftPlanRef,
  persistedPlanRef,
  planRefKey,
  templatePlanRef,
  type CreateChildBody,
  type DraftEdit,
  type PlanDetailDTO,
  type PlanRef,
} from "../api/types";

export type GenerationEdit = Extract<DraftEdit, { type: "generateInstances" }>;
export type PendingPlan = Extract<DraftEdit, { type: "createChild" }> & {
  ref?: PlanRef;
  detail?: PlanDetailDTO;
  generation?: {
    batch: GenerationEdit;
    node: ProjectionNode;
    index: number;
    root: boolean;
    blueprint: boolean;
  };
};

export const pendingPlanRef = (item: PendingPlan): PlanRef =>
  item.ref ?? draftPlanRef(item.draftId);

export function templateBody(body: CreateChildBody): CreateChildBody {
  return body.template
    ? { ...body.template, is_critical: false }
    : {
        kind: body.template_type ?? "TASK",
        name: body.template_name ?? body.name + " template",
        is_critical: false,
        duration_minutes: body.template_duration_minutes ?? 30,
        divisible: body.template_divisible ?? false,
        minimum_chunk_size_minutes:
          body.template_minimum_chunk_size_minutes ?? null,
        block_family: body.template_block_family,
      };
}

function withTemplates(items: PendingPlan[]): PendingPlan[] {
  const result: PendingPlan[] = [];
  const visit = (item: PendingPlan) => {
    result.push(item);
    if (item.generation || item.body.kind !== "REPETITION") return;
    const ref = templatePlanRef(pendingPlanRef(item));
    visit({
      type: "createChild",
      draftId: planRefKey(ref),
      ref,
      parentRef: pendingPlanRef(item),
      body: templateBody(item.body),
    });
  };
  items.forEach(visit);
  return result;
}

export function nodeBody(node: ProjectionNode): CreateChildBody {
  return {
    kind: node.kind,
    name: node.name,
    is_critical: node.is_critical ?? false,
    duration_minutes: node.duration_minutes,
    divisible: node.divisible,
    minimum_chunk_size_minutes: node.minimum_chunk_size_minutes,
    block_family: node.block_family,
    ...node.repetition,
  };
}

export function nodeDetail(
  node: ProjectionNode,
  nodes: ProjectionNode[],
): PlanDetailDTO {
  const common = {
    plan_id: node.ref,
    name: node.name,
    is_master: false,
    parent_id: node.parent_ref,
    created_at: "",
    updated_at: "",
  };
  const scheduling = {
    ...common,
    duration_minutes: node.duration_minutes ?? 1,
    divisible: node.divisible,
    minimum_chunk_size_minutes: node.minimum_chunk_size_minutes,
    user_completed: false,
    completed_at: null,
  };
  return {
    ...common,
    plan_kind: node.kind,
    goal_is_critical: node.is_critical,
    goal_sort_order: node.sort_order,
    ancestry: [],
    children: nodes
      .filter((item) => item.parent_ref === node.ref)
      .map((item) => ({
        plan_id: item.ref,
        name: item.name,
        plan_kind: item.kind,
        goal_is_critical: item.is_critical,
        goal_sort_order: item.sort_order,
      })),
    prerequisite_plan_ids: node.prerequisite_refs,
    prerequisites: node.prerequisite_refs.map((ref) => ({
      prerequisite_plan_id: ref,
      name: nodes.find((item) => item.ref === ref)?.name ?? ref,
      plan_kind: nodes.find((item) => item.ref === ref)?.kind ?? "GOAL",
    })),
    time_constraint_groups: node.constraint_groups.map((group) => ({
      constraint_group_id: group.ref,
      plan_id: node.ref,
      constraint_kind: group.constraint_kind,
      windows: group.windows.map((window) => ({
        time_window_id: window.ref,
        start_time: window.start_time,
        end_time: window.end_time,
      })),
    })),
    goal_detail: node.kind === "GOAL" ? common : null,
    task_detail:
      node.kind === "TASK"
        ? { ...scheduling, allowed_block_families: node.allowed_block_families }
        : null,
    block_detail:
      node.kind === "BLOCK"
        ? { ...scheduling, block_family: node.block_family }
        : null,
    repetition_detail: node.repetition
      ? {
          ...common,
          ...node.repetition,
          template_root_id: node.template_root_ref!,
          generated_at: null,
        }
      : null,
  };
}

export function allPendingPlans(edits: DraftEdit[]): PendingPlan[] {
  const pending: PendingPlan[] = edits.filter(
    (edit) => edit.type === "createChild",
  );
  for (const batch of edits) {
    if (batch.type !== "generateInstances") continue;
    for (const instance of batch.preview.instances) {
      const nodeMap = new Map(instance.nodes.map((node) => [node.ref, node]));
      for (const node of instance.nodes) {
        let ancestor = node;
        let blueprint = false;
        while (ancestor.parent_ref && nodeMap.has(ancestor.parent_ref)) {
          const parent = nodeMap.get(ancestor.parent_ref)!;
          if (parent.template_root_ref === ancestor.ref) blueprint = true;
          ancestor = parent;
        }
        const parentRef =
          node.parent_ref && nodeMap.has(node.parent_ref)
            ? draftPlanRef(node.parent_ref)
            : batch.planRef;
        pending.push({
          type: "createChild",
          draftId: node.ref,
          parentRef,
          body: nodeBody(node),
          detail: nodeDetail(node, instance.nodes),
          generation: {
            batch,
            node,
            index: instance.instance_index,
            root: node.ref === instance.root_ref,
            blueprint,
          },
        });
      }
    }
  }
  return pending;
}

export function pendingPlans(edits: DraftEdit[]): PendingPlan[] {
  const all = withTemplates(allPendingPlans(edits));
  const removed = new Set(
    edits
      .filter((edit) => edit.type === "delete")
      .map((edit) => planRefKey(edit.planRef)),
  );
  for (const edit of edits)
    if (edit.type === "generateInstances")
      for (const instance of edit.preview.instances)
        if (edit.omittedIndices?.includes(instance.instance_index))
          removed.add("draft:" + instance.root_ref);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of all)
      if (
        removed.has(planRefKey(item.parentRef)) &&
        !removed.has(planRefKey(pendingPlanRef(item)))
      ) {
        removed.add(planRefKey(pendingPlanRef(item)));
        changed = true;
      }
  }
  return all.filter((item) => !removed.has(planRefKey(pendingPlanRef(item))));
}

export function generatedPlanRef(key: string, edits: DraftEdit[]): PlanRef {
  if (key.startsWith("template:"))
    return templatePlanRef(generatedPlanRef(key.slice(9), edits));
  if (key.startsWith("persisted:")) return persistedPlanRef(key.slice(10));
  if (key.startsWith("draft:")) return draftPlanRef(key.slice(6));
  return allPendingPlans(edits).some((item) => item.draftId === key)
    ? draftPlanRef(key)
    : persistedPlanRef(key);
}

export function generatedLinkState(
  item: PendingPlan,
  edits: DraftEdit[],
): "Linked" | "Detached" {
  if (!item.generation) return "Linked";
  const instance = item.generation.batch.preview.instances.find(
    (instance) => instance.instance_index === item.generation!.index,
  )!;
  const nodes = new Map(instance.nodes.map((node) => [node.ref, node]));
  const detached = new Set<string>();
  for (const edit of edits) {
    if (edit.type === "generateInstances") continue;
    const target = edit.type === "createChild" ? edit.parentRef : edit.planRef;
    if (target.kind !== "draft" || !nodes.has(target.draftId)) continue;
    detached.add(target.draftId);
    if (edit.type === "delete") {
      const parent = nodes.get(target.draftId)?.parent_ref;
      if (parent && nodes.has(parent)) detached.add(parent);
    }
  }
  let node: ProjectionNode | undefined = item.generation.node;
  while (node) {
    if (detached.has(node.ref)) return "Detached";
    node = node.parent_ref ? nodes.get(node.parent_ref) : undefined;
  }
  return "Linked";
}
