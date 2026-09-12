import type { RepeatMode, UpdateRepetitionSettingsBody } from "../../api/types";
import { datetimeLocalToIso } from "../../utils/format";
import { parseNumericInput } from "../../utils/input";
import LabeledField from "../LabeledField";
import DurationFields from "../DurationFields";
import { durationMinutes, splitDuration, type DurationParts } from "../../utils/duration";

export interface RepetitionForm {
  mode: RepeatMode;
  start: string;
  end: string;
  interval: DurationParts;
  count: string;
  critical: boolean;
}

function localDateTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function repetitionForm(
  body: UpdateRepetitionSettingsBody = {},
): RepetitionForm {
  return {
    mode: body.repeat_mode ?? "MANUAL_COUNT",
    start: localDateTime(body.start_time ?? new Date().toISOString()),
    end: body.end_time ? localDateTime(body.end_time) : "",
    interval: splitDuration(body.repeat_interval_minutes ?? 1440),
    count: String(body.manual_count ?? 5),
    critical: body.default_instance_critical ?? false,
  };
}

export function parseRepetition(
  value: RepetitionForm,
): UpdateRepetitionSettingsBody {
  if (!Number.isFinite(Date.parse(value.start)))
    throw new Error("Repetition start time is required");
  if (
    value.mode === "DATE_RANGE" &&
    (!Number.isFinite(Date.parse(value.end)) ||
      Date.parse(value.end) <= Date.parse(value.start))
  )
    throw new Error("Repetition end must be after start");
  return {
    repeat_mode: value.mode,
    start_time: datetimeLocalToIso(value.start),
    repeat_interval_minutes: durationMinutes(value.interval),
    manual_count:
      value.mode === "MANUAL_COUNT"
        ? parseNumericInput(value.count, "Manual count", { min: 1 })
        : null,
    end_time:
      value.mode === "DATE_RANGE" ? datetimeLocalToIso(value.end) : null,
    default_instance_critical: value.critical,
  };
}

export default function RepetitionFields({
  value,
  onChange,
}: {
  value: RepetitionForm;
  onChange: (value: RepetitionForm) => void;
}) {
  return (
    <>
      <LabeledField label="Repeat mode">
        <select
          value={value.mode}
          onChange={(e) =>
            onChange({ ...value, mode: e.target.value as RepeatMode })
          }
        >
          <option value="MANUAL_COUNT">MANUAL_COUNT</option>
          <option value="DATE_RANGE">DATE_RANGE</option>
        </select>
      </LabeledField>
      <LabeledField label="Start">
        <input
          type="datetime-local"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </LabeledField>
      <DurationFields label="Repeat interval" value={value.interval}
        onChange={(interval) => onChange({ ...value, interval })} />
      {value.mode === "MANUAL_COUNT" ? (
        <LabeledField label="Manual count">
          <input
            type="text"
            inputMode="numeric"
            value={value.count}
            onChange={(e) => onChange({ ...value, count: e.target.value })}
          />
        </LabeledField>
      ) : (
        <LabeledField label="End">
          <input
            type="datetime-local"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </LabeledField>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.critical}
          onChange={(e) => onChange({ ...value, critical: e.target.checked })}
        />
        Default instance critical
      </label>
    </>
  );
}
