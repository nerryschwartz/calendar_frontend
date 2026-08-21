import { Link } from "react-router-dom";
import type { PlanDetailDTO, RepetitionPlanDTO } from "../../api/types";
import {
  generateRepetitionInstances,
  refreshRepetition,
  updateRepetitionSettings,
} from "../../api/repetitions";
import DetailGrid from "../DetailGrid";
import LoadingButton from "../LoadingButton";
import StatusBanner from "../StatusBanner";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatDateTime } from "../../utils/format";

interface PlanRepetitionPanelProps {
  detail: RepetitionPlanDTO;
  editMode: boolean;
  onUpdated: () => void;
}

export default function PlanRepetitionPanel({
  detail,
  editMode,
  onUpdated,
}: PlanRepetitionPanelProps) {
  const { run, successMessage, clearFeedback } = useAsyncAction();

  return (
    <div className="detail-panel">
      <h3>Repetition</h3>
      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      <DetailGrid
        items={[
          { label: "Repeat mode", value: detail.repeat_mode },
          { label: "Start", value: formatDateTime(detail.start_time) },
          { label: "Interval (min)", value: detail.repeat_interval_minutes },
          { label: "Manual count", value: detail.manual_count ?? "—" },
          {
            label: "End",
            value: detail.end_time ? formatDateTime(detail.end_time) : "—",
          },
          {
            label: "Template root",
            value: (
              <Link to={`/plan-tree/${detail.template_root_id}`}>
                {detail.template_root_id}
              </Link>
            ),
          },
          {
            label: "Default critical",
            value: detail.default_instance_critical ? "Yes" : "No",
          },
          {
            label: "Generated at",
            value: detail.generated_at
              ? formatDateTime(detail.generated_at)
              : "—",
          },
        ]}
      />
      {editMode && (
        <div className="button-row">
          <LoadingButton
            variant="secondary"
            onClick={() =>
              void run(
                () =>
                  updateRepetitionSettings(detail.plan_id, {
                    repeat_interval_minutes: detail.repeat_interval_minutes,
                  }),
                "Repetition settings saved",
              ).then(onUpdated)
            }
          >
            Save settings
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            onClick={() =>
              void run(
                () => generateRepetitionInstances(detail.plan_id),
                "Instances generated",
              ).then(onUpdated)
            }
          >
            Generate instances
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            onClick={() =>
              void run(
                () => refreshRepetition(detail.plan_id),
                "Repetition refreshed",
              ).then(onUpdated)
            }
          >
            Refresh repetition
          </LoadingButton>
        </div>
      )}
    </div>
  );
}

export function PlanDetailSections({ plan }: { plan: PlanDetailDTO }) {
  const items = [
    { label: "Plan ID", value: <code>{plan.plan_id}</code> },
    { label: "Kind", value: plan.plan_kind },
    { label: "Master", value: plan.is_master ? "Yes" : "No" },
    {
      label: "Parent",
      value: plan.parent_id ? (
        <Link to={`/plan-tree/${plan.parent_id}`}>{plan.parent_id}</Link>
      ) : (
        "—"
      ),
    },
    {
      label: "Critical",
      value:
        plan.goal_is_critical == null
          ? "—"
          : plan.goal_is_critical
            ? "Yes"
            : "No",
    },
    { label: "Sort order", value: plan.goal_sort_order ?? "—" },
    { label: "Created", value: formatDateTime(plan.created_at) },
    { label: "Updated", value: formatDateTime(plan.updated_at) },
  ];

  return (
    <div className="detail-panel">
      <h3>Overview</h3>
      <DetailGrid items={items} />
      {plan.task_detail && (
        <>
          <h4>Task details</h4>
          <DetailGrid
            items={[
              {
                label: "Duration (min)",
                value: plan.task_detail.duration_minutes,
              },
              {
                label: "Divisible",
                value: plan.task_detail.divisible ? "Yes" : "No",
              },
              {
                label: "Min chunk (min)",
                value: plan.task_detail.minimum_chunk_size_minutes ?? "—",
              },
              {
                label: "Completed",
                value: plan.task_detail.user_completed ? "Yes" : "No",
              },
              {
                label: "Completed at",
                value: plan.task_detail.completed_at
                  ? formatDateTime(plan.task_detail.completed_at)
                  : "—",
              },
              {
                label: "Block families",
                value:
                  plan.task_detail.allowed_block_families.join(", ") || "none",
              },
            ]}
          />
        </>
      )}
      {plan.block_detail && (
        <>
          <h4>Block details</h4>
          <DetailGrid
            items={[
              {
                label: "Duration (min)",
                value: plan.block_detail.duration_minutes,
              },
              {
                label: "Divisible",
                value: plan.block_detail.divisible ? "Yes" : "No",
              },
              {
                label: "Min chunk (min)",
                value: plan.block_detail.minimum_chunk_size_minutes ?? "—",
              },
              { label: "Block family", value: plan.block_detail.block_family },
              {
                label: "Completed",
                value: plan.block_detail.user_completed ? "Yes" : "No",
              },
              {
                label: "Completed at",
                value: plan.block_detail.completed_at
                  ? formatDateTime(plan.block_detail.completed_at)
                  : "—",
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
