import type {
  GenerationPreview,
  PreviewInput,
} from "../api/repetitionGeneration";
import { persistedPlanRef, type DraftEdit } from "../api/types";

export const repetitionCreate: Extract<DraftEdit, { type: "createChild" }> = {
  type: "createChild",
  draftId: "repeat",
  parentRef: persistedPlanRef("master"),
  body: {
    kind: "REPETITION",
    name: "Lunch",
    is_critical: false,
    repeat_mode: "MANUAL_COUNT",
    start_time: "2026-09-12T05:00:00Z",
    repeat_interval_minutes: 1440,
    manual_count: 2,
    template_type: "TASK",
    template_name: "Lunch template",
    template_duration_minutes: 30,
    template_divisible: false,
  },
};
export function mockGenerationPreview(
  input: PreviewInput,
  key = "generation",
): GenerationPreview {
  return {
    generation_key: key,
    input_fingerprint: "fingerprint",
    input: structuredClone(input),
    frozen_horizon: {
      run_started_at: "2026-09-12T05:00:00Z",
      master_horizon_end: null,
    },
    instances: Array.from(
      { length: input.settings.manual_count ?? 2 },
      (_, index) => {
        const map = new Map(
          input.template.nodes.map((node) => [
            node.ref,
            `${key}-${index}-${node.ref}`,
          ]),
        );
        return {
          instance_index: index,
          instance_start_time: new Date(
            Date.parse(input.settings.start_time) + index * 86400000,
          ).toISOString(),
          root_ref: map.get(input.template.root_ref)!,
          nodes: input.template.nodes.map((node) => ({
            ...structuredClone(node),
            ref: map.get(node.ref)!,
            parent_ref: map.get(node.parent_ref ?? "") ?? input.repetition_ref,
            template_root_ref: node.template_root_ref
              ? map.get(node.template_root_ref)!
              : null,
            constraint_groups: node.constraint_groups.map((group) => ({
              ...group,
              ref: `${key}-${index}-${group.ref}`,
              windows: group.windows.map((window) => ({
                ...window,
                ref: `${key}-${index}-${window.ref}`,
                start_time: new Date(
                  Date.parse(window.start_time) + index * 86400000,
                ).toISOString(),
                end_time: new Date(
                  Date.parse(window.end_time) + index * 86400000,
                ).toISOString(),
              })),
            })),
          })),
        };
      },
    ),
  };
}
