import { apiPost } from "./client";
import type {
  ConstraintKind,
  PlanKind,
  RepeatMode,
  RepetitionPlanDTO,
} from "./types";

export interface ProjectionSettings {
  repeat_mode: RepeatMode;
  start_time: string;
  repeat_interval_minutes: number;
  manual_count: number | null;
  end_time: string | null;
  default_instance_critical: boolean;
}
export interface ProjectionGroup {
  ref: string;
  constraint_kind: ConstraintKind;
  windows: { ref: string; start_time: string; end_time: string }[];
}
export interface ProjectionNode {
  ref: string;
  parent_ref: string | null;
  kind: PlanKind;
  name: string;
  is_critical: boolean | null;
  sort_order: number | null;
  duration_minutes: number | null;
  divisible: boolean;
  minimum_chunk_size_minutes: number | null;
  allowed_block_families: string[];
  block_family: string;
  prerequisite_refs: string[];
  immediate_prerequisite_ref: string | null;
  repetition: ProjectionSettings | null;
  template_root_ref: string | null;
  constraint_groups: ProjectionGroup[];
}
export interface PreviewInput {
  repetition_ref: string;
  settings: ProjectionSettings;
  template: { root_ref: string; nodes: ProjectionNode[] };
}
export interface GenerationPreview {
  generation_key: string;
  input_fingerprint: string;
  frozen_horizon: { run_started_at: string; master_horizon_end: string | null };
  input: PreviewInput;
  instances: {
    instance_index: number;
    instance_start_time: string;
    root_ref: string;
    nodes: ProjectionNode[];
  }[];
}
export interface CommitGenerationInput {
  preview: GenerationPreview;
  resolved_refs: Record<string, string>;
  omitted_instance_indices: number[];
}
export interface CommitGenerationResult {
  repetition: RepetitionPlanDTO;
  resolved_refs: Record<string, string>;
}
export function previewRepetitionInstances(
  input: PreviewInput,
): Promise<GenerationPreview> {
  return apiPost("/api/repetitions/preview-instances", input);
}
export function commitRepetitionGeneration(
  id: string,
  input: CommitGenerationInput,
): Promise<CommitGenerationResult> {
  return apiPost(`/api/repetitions/${id}/commit-generation`, input);
}
