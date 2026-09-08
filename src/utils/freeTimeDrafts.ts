import type { FreeTimeActivityDTO, FreeTimeDraftEdit } from "../api/types";
import { parseFamilies, parseNumericInput } from "./input";

export interface FreeTimeDraftRow {
  ref: string;
  name: string;
  enabled: boolean;
  fraction: string;
  minBlock: string;
  families: string;
  prerequisites: string[];
  prerequisiteNames: Record<string, string>;
  deleted: boolean;
}

export function activityDraft(activity: FreeTimeActivityDTO): FreeTimeDraftRow {
  return {
    ref: activity.free_time_activity_id,
    name: activity.name,
    enabled: activity.enabled,
    fraction: activity.real_fraction,
    minBlock: String(activity.minimum_block_size_minutes),
    families: activity.allowed_block_families.join(", "),
    prerequisites: [...activity.prerequisite_plan_ids],
    prerequisiteNames: {},
    deleted: false,
  };
}

export function buildFreeTimeEdits(
  rows: FreeTimeDraftRow[],
  originals: FreeTimeActivityDTO[],
): FreeTimeDraftEdit[] {
  const edits: FreeTimeDraftEdit[] = [];
  for (const row of rows) {
    const original = originals.find(
      (activity) => activity.free_time_activity_id === row.ref,
    );
    const activity_ref = row.ref;
    if (row.deleted) {
      if (original) edits.push({ op: "delete", activity_ref });
      continue;
    }
    if (!row.name.trim()) throw new Error("Every activity needs a name");
    parseNumericInput(row.fraction, row.name + " fraction", {
      integer: false,
      min: row.enabled ? Number.MIN_VALUE : 0,
      max: 1,
    });
    const fields = {
      name: row.name.trim(),
      real_fraction: row.fraction.trim(),
      minimum_block_size_minutes: parseNumericInput(
        row.minBlock,
        row.name + " minimum block",
      ),
    };
    if (!original)
      edits.push({
        op: "create",
        draft_ref: row.ref,
        ...fields,
        enabled: row.enabled,
      });
    else {
      if (
        fields.name !== original.name ||
        fields.real_fraction !== original.real_fraction ||
        fields.minimum_block_size_minutes !==
          original.minimum_block_size_minutes
      )
        edits.push({ op: "update", activity_ref, ...fields });
      if (row.enabled !== original.enabled)
        edits.push({ op: "set_enabled", activity_ref, enabled: row.enabled });
    }
    const families = parseFamilies(row.families);
    if (
      families.join("\n") !==
      (original?.allowed_block_families ?? []).join("\n")
    )
      edits.push(
        families.length
          ? { op: "set_block_families", activity_ref, families }
          : { op: "clear_block_families", activity_ref },
      );
    for (const id of original?.prerequisite_plan_ids ?? []) {
      if (!row.prerequisites.includes(id))
        edits.push({
          op: "remove_prerequisite",
          activity_ref,
          prerequisite_plan_id: id,
        });
    }
    for (const id of row.prerequisites) {
      if (!original?.prerequisite_plan_ids.includes(id))
        edits.push({
          op: "add_prerequisite",
          activity_ref,
          prerequisite_plan_id: id,
        });
    }
  }
  return edits;
}

export function enabledFraction(rows: FreeTimeDraftRow[]): number | null {
  try {
    return rows
      .filter((row) => row.enabled && !row.deleted)
      .reduce(
        (total, row) =>
          total +
          parseNumericInput(row.fraction, "Fraction", {
            integer: false,
            max: 1,
          }),
        0,
      );
  } catch {
    return null;
  }
}
