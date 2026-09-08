import type { BlockSchedulingBody, TaskSchedulingBody } from "../../api/types";
import { parseNumericInput } from "../../utils/input";
import LabeledField from "../LabeledField";

export interface SchedulingForm {
  duration: string;
  divisible: boolean;
  minChunk: string;
  blockFamily: string;
  families: string;
}

export function schedulingForm(
  body: BlockSchedulingBody = {},
  families: string[] = [],
): SchedulingForm {
  return {
    duration: String(body.duration_minutes ?? 30),
    divisible: body.divisible ?? false,
    minChunk:
      body.minimum_chunk_size_minutes == null
        ? ""
        : String(body.minimum_chunk_size_minutes),
    blockFamily: body.block_family ?? "default",
    families: families.join(", "),
  };
}

export function parseScheduling(form: SchedulingForm): TaskSchedulingBody {
  const duration = parseNumericInput(form.duration, "Duration", { min: 1 });
  const minChunk =
    form.divisible && form.minChunk.trim()
      ? parseNumericInput(form.minChunk, "Min chunk", { min: 1, max: duration })
      : null;
  return {
    duration_minutes: duration,
    divisible: form.divisible,
    minimum_chunk_size_minutes: minChunk,
  };
}

export default function SchedulingFields({
  value,
  onChange,
  kind,
  showFamilies = true,
}: {
  value: SchedulingForm;
  onChange: (value: SchedulingForm) => void;
  kind: "TASK" | "BLOCK";
  showFamilies?: boolean;
}) {
  return (
    <>
      <LabeledField label="Duration">
        <input
          type="text"
          inputMode="numeric"
          value={value.duration}
          onChange={(e) => onChange({ ...value, duration: e.target.value })}
        />
      </LabeledField>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.divisible}
          onChange={(e) => onChange({ ...value, divisible: e.target.checked })}
        />
        Divisible
      </label>
      <LabeledField label="Min chunk">
        <input
          type="text"
          inputMode="numeric"
          value={value.minChunk}
          disabled={!value.divisible}
          onChange={(e) => onChange({ ...value, minChunk: e.target.value })}
        />
      </LabeledField>
      {kind === "TASK" ? (
        showFamilies && (
          <LabeledField label="Block families">
            <input
              value={value.families}
              placeholder="Comma-separated"
              onChange={(e) => onChange({ ...value, families: e.target.value })}
            />
          </LabeledField>
        )
      ) : (
        <LabeledField label="Block family">
          <input
            value={value.blockFamily}
            onChange={(e) =>
              onChange({ ...value, blockFamily: e.target.value })
            }
          />
        </LabeledField>
      )}
    </>
  );
}
