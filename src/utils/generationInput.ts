import { getPlanDetail } from "../api/plans";
import type {
  PreviewInput,
  ProjectionNode,
  ProjectionSettings,
} from "../api/repetitionGeneration";
import {
  planRefKey,
  templatePlanRef,
  persistedPlanRef,
  draftPlanRef,
  type PlanDetailDTO,
  type PlanRef,
  type DraftEdit,
  type CreateChildBody,
} from "../api/types";
import { allPendingPlans, type GenerationEdit } from "./generatedPlans";
import { projectConstraintGroups } from "./constraintDrafts";

function settings(
  body: CreateChildBody | Partial<ProjectionSettings>,
): ProjectionSettings {
  return {
    repeat_mode: body.repeat_mode ?? "MANUAL_COUNT",
    start_time: body.start_time ?? "",
    repeat_interval_minutes: body.repeat_interval_minutes ?? 1440,
    manual_count: body.manual_count ?? null,
    end_time: body.end_time ?? null,
    default_instance_critical: body.default_instance_critical ?? false,
  };
}
function newNode(
  ref: string,
  parent: string | null,
  body: CreateChildBody,
): ProjectionNode {
  return {
    ref,
    parent_ref: parent,
    kind: body.kind,
    name: body.name,
    is_critical: body.is_critical,
    sort_order: null,
    duration_minutes: body.duration_minutes ?? null,
    divisible: body.divisible ?? false,
    minimum_chunk_size_minutes: body.minimum_chunk_size_minutes ?? null,
    block_family: body.block_family ?? "default",
    allowed_block_families: ["default"],
    prerequisite_refs: [],
    immediate_prerequisite_ref: null,
    repetition: body.kind === "REPETITION" ? settings(body) : null,
    template_root_ref: body.kind === "REPETITION" ? "template:" + ref : null,
    constraint_groups: [],
  };
}
function firstTemplate(
  ref: string,
  owner: string,
  body: CreateChildBody,
): ProjectionNode {
  return newNode(ref, owner, {
    kind: body.template_type ?? "TASK",
    name: body.template_name ?? body.name + " template",
    is_critical: false,
    duration_minutes: body.template_duration_minutes ?? 30,
    divisible: body.template_divisible ?? false,
    minimum_chunk_size_minutes:
      body.template_minimum_chunk_size_minutes ?? null,
    block_family: body.template_block_family,
  });
}
function fromDetail(detail: PlanDetailDTO): ProjectionNode {
  const node = newNode(
    planRefKey(persistedPlanRef(detail.plan_id)),
    detail.parent_id ? planRefKey(persistedPlanRef(detail.parent_id)) : null,
    {
      kind: detail.plan_kind,
      name: detail.name,
      is_critical: detail.goal_is_critical ?? false,
      ...detail.task_detail,
      ...detail.block_detail,
    },
  );
  node.sort_order = detail.goal_sort_order;
  node.allowed_block_families = detail.task_detail?.allowed_block_families ?? [
    "default",
  ];
  node.prerequisite_refs = detail.prerequisite_plan_ids.map(
    (id) => "persisted:" + id,
  );
  node.constraint_groups = detail.time_constraint_groups
    .filter((group) => group.constraint_kind === "USER")
    .map((group) => ({
      ref: group.constraint_group_id,
      constraint_kind: group.constraint_kind,
      windows: group.windows.map((window) => ({
        ref: window.time_window_id,
        start_time: window.start_time,
        end_time: window.end_time,
      })),
    }));
  if (detail.repetition_detail) {
    node.repetition = settings(detail.repetition_detail);
    node.template_root_ref =
      "persisted:" + detail.repetition_detail.template_root_id;
  }
  return node;
}

export async function generationBaseline(
  ref: PlanRef,
  edits: DraftEdit[],
): Promise<{ baseline: PreviewInput; sourceRefs: Record<string, PlanRef> }> {
  const sourceRefs: Record<string, PlanRef> = {};
  const repetitionRef = planRefKey(ref);
  sourceRefs[repetitionRef] = ref;
  const nodes: ProjectionNode[] = [];
  let repeat: ProjectionSettings;
  let root: string;
  if (ref.kind === "persisted") {
    const detail = await getPlanDetail(ref.planId);
    if (!detail.repetition_detail)
      throw new Error("Selected plan is not a repetition");
    if (detail.repetition_detail.generated_at)
      throw new Error("This repetition already has saved instances");
    repeat = settings(detail.repetition_detail);
    root = "persisted:" + detail.repetition_detail.template_root_id;
    const visit = async (id: string): Promise<void> => {
      const detail = await getPlanDetail(id);
      const node = fromDetail(detail);
      nodes.push(node);
      sourceRefs[node.ref] = persistedPlanRef(id);
      for (const child of detail.children) await visit(child.plan_id);
    };
    await visit(detail.repetition_detail.template_root_id);
  } else {
    const pending = allPendingPlans(edits).find(
      (item) => ref.kind === "draft" && item.draftId === ref.draftId,
    );
    if (!pending || pending.body.kind !== "REPETITION")
      throw new Error("Pending repetition is missing");
    repeat = settings(pending.body);
    if (pending.generation) {
      const original = pending.generation.node;
      root = original.template_root_ref!;
      const instance = pending.generation.batch.preview.instances.find(
        (item) => item.instance_index === pending.generation!.index,
      )!;
      const refs = new Set([root]);
      for (let changed = true; changed;) {
        changed = false;
        for (const node of instance.nodes)
          if (
            node.parent_ref &&
            refs.has(node.parent_ref) &&
            !refs.has(node.ref)
          ) {
            refs.add(node.ref);
            changed = true;
          }
      }
      nodes.push(
        ...instance.nodes
          .filter((node) => refs.has(node.ref))
          .map((node) => structuredClone(node)),
      );
      for (const node of nodes) sourceRefs[node.ref] = draftPlanRef(node.ref);
    } else {
      root = planRefKey(templatePlanRef(ref));
      nodes.push(firstTemplate(root, repetitionRef, pending.body));
      sourceRefs[root] = templatePlanRef(ref);
    }
  }
  return {
    baseline: {
      repetition_ref: repetitionRef,
      settings: repeat,
      template: { root_ref: root, nodes },
    },
    sourceRefs,
  };
}

export function generationInput(
  baseline: PreviewInput,
  sourceRefs: Record<string, PlanRef>,
  edits: DraftEdit[],
): PreviewInput {
  const result = structuredClone(baseline);
  const nodes = result.template.nodes;
  const keyFor = (ref: PlanRef): string => {
    if (ref.kind === "template") {
      const owner = keyFor(ref.repetitionRef);
      if (owner === result.repetition_ref) return result.template.root_ref;
      const nested = nodes.find((node) => node.ref === owner);
      if (nested?.template_root_ref) return nested.template_root_ref;
    }
    return (
      Object.entries(sourceRefs).find(
        ([, value]) => planRefKey(value) === planRefKey(ref),
      )?.[0] ?? planRefKey(ref)
    );
  };
  for (const edit of edits) {
    if (edit.type !== "createChild") continue;
    const parent = keyFor(edit.parentRef);
    if (!nodes.some((node) => node.ref === parent)) continue;
    const ref = "draft:" + edit.draftId;
    const child = newNode(ref, parent, edit.body);
    child.sort_order =
      Math.max(
        -1,
        ...nodes
          .filter(
            (node) =>
              node.parent_ref === parent &&
              node.is_critical === child.is_critical,
          )
          .map((node) => node.sort_order ?? -1),
      ) + 1;
    nodes.push(child);
    sourceRefs[ref] = draftPlanRef(edit.draftId);
    if (edit.body.kind === "REPETITION") {
      const root = "template:" + ref;
      nodes.push(firstTemplate(root, ref, edit.body));
      sourceRefs[root] = templatePlanRef(draftPlanRef(edit.draftId));
    }
  }
  for (const edit of edits) {
    if (!("planRef" in edit) || edit.type === "generateInstances") continue;
    const key = keyFor(edit.planRef);
    if (key === result.repetition_ref && edit.type === "repetitionSettings")
      Object.assign(result.settings, edit.body);
    const node = nodes.find((node) => node.ref === key);
    if (!node) continue;
    if (edit.type === "rename") node.name = edit.name;
    if (edit.type === "taskScheduling" || edit.type === "blockScheduling")
      Object.assign(node, edit.body);
    if (edit.type === "taskBlockFamilies")
      node.allowed_block_families = edit.families.length
        ? [...edit.families].sort()
        : ["default"];
    if (edit.type === "repetitionSettings" && node.repetition)
      Object.assign(node.repetition, edit.body);
    if (edit.type === "move") {
      node.sort_order = edit.position;
      if (edit.isCritical !== undefined) node.is_critical = edit.isCritical;
    }
    if (edit.type === "addPrerequisite") {
      const prerequisite = keyFor(edit.prerequisitePlanRef);
      if (!node.prerequisite_refs.includes(prerequisite))
        node.prerequisite_refs.push(prerequisite);
      sourceRefs[prerequisite] ??= edit.prerequisitePlanRef;
    }
    if (edit.type === "removePrerequisite")
      node.prerequisite_refs = node.prerequisite_refs.filter(
        (ref) => ref !== keyFor(edit.prerequisitePlanRef),
      );
  }
  const removed = new Set(
    edits
      .filter((edit) => edit.type === "delete")
      .map((edit) => keyFor(edit.planRef)),
  );
  for (let changed = true; changed;) {
    changed = false;
    for (const node of nodes)
      if (
        node.parent_ref &&
        removed.has(node.parent_ref) &&
        !removed.has(node.ref)
      ) {
        removed.add(node.ref);
        changed = true;
      }
  }
  result.template.nodes = nodes.filter((node) => !removed.has(node.ref));
  for (const node of result.template.nodes) {
    const mappedEdits = edits.map((edit) =>
      "planRef" in edit
        ? { ...edit, planRef: persistedPlanRef(keyFor(edit.planRef)) }
        : edit,
    );
    const groups = projectConstraintGroups(
      node.constraint_groups.map((group) => ({
        constraint_group_id: group.ref,
        plan_id: node.ref,
        constraint_kind: group.constraint_kind,
        windows: group.windows.map((window) => ({
          time_window_id: window.ref,
          start_time: window.start_time,
          end_time: window.end_time,
        })),
      })),
      mappedEdits,
      persistedPlanRef(node.ref),
    );
    node.constraint_groups = groups
      .filter((group) => group.constraint_kind === "USER")
      .map((group) => ({
        ref: group.constraint_group_id,
        constraint_kind: group.constraint_kind,
        windows: group.windows.map((window) => ({
          ref: window.time_window_id,
          start_time: window.start_time,
          end_time: window.end_time,
        })),
      }));
  }
  return result;
}

export function generationIsFresh(
  batch: GenerationEdit,
  edits: DraftEdit[],
): boolean {
  return (
    semanticInput(
      generationInput(batch.baseline, { ...batch.sourceRefs }, edits),
    ) === semanticInput(batch.preview.input)
  );
}
export function semanticInput(input: PreviewInput): string {
  const value = structuredClone(input);
  const time = (text: string) =>
    Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : text;
  value.settings.start_time = time(value.settings.start_time);
  if (value.settings.end_time)
    value.settings.end_time = time(value.settings.end_time);
  for (const node of value.template.nodes) {
    node.prerequisite_refs.sort();
    node.allowed_block_families.sort();
    for (const group of node.constraint_groups)
      for (const window of group.windows) {
        window.start_time = time(window.start_time);
        window.end_time = time(window.end_time);
      }
    if (node.ref === value.template.root_ref) {
      node.parent_ref = null;
      node.is_critical = null;
      node.sort_order = null;
    }
    if (node.repetition) {
      node.repetition.start_time = time(node.repetition.start_time);
      if (node.repetition.end_time)
        node.repetition.end_time = time(node.repetition.end_time);
    }
    node.constraint_groups = node.constraint_groups
      .map((group) => ({
        ...group,
        ref: "",
        windows: group.windows
          .map((window) => ({ ...window, ref: "" }))
          .sort((a, b) =>
            (a.start_time + a.end_time).localeCompare(
              b.start_time + b.end_time,
            ),
          ),
      }))
      .sort((a, b) =>
        JSON.stringify(a.windows).localeCompare(JSON.stringify(b.windows)),
      );
  }
  value.template.nodes.sort((a, b) => a.ref.localeCompare(b.ref));
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, canonical(child)]),
          )
        : value;
  return JSON.stringify(canonical(value));
}
