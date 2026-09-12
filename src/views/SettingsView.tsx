import { useCallback, useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import type { AppSettingsDTO, FreeTimeWeekStartDay } from "../api/types";
import LabeledField from "../components/LabeledField";
import DurationFields from "../components/DurationFields";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import StatusBanner from "../components/StatusBanner";
import { useAsyncAction } from "../hooks/useAsyncAction";
import {
  durationForm,
  parseDuration,
  splitDuration,
  type DurationParts,
} from "../utils/duration";
import { parseNumericInput } from "../utils/input";
import { timezoneLabel } from "../utils/timezones";
import { formatDateTime } from "../utils/format";

const WEEK_DAYS: FreeTimeWeekStartDay[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [form, setForm] = useState<Partial<AppSettingsDTO>>({});
  const [timeLimit, setTimeLimit] = useState("");
  const [sizeLimit, setSizeLimit] = useState("");
  const [horizon, setHorizon] = useState<DurationParts>(splitDuration(0));
  const { run, loading, error, successMessage, clearFeedback } =
    useAsyncAction();
  const populate = useCallback((data: AppSettingsDTO) => {
    setSettings(data);
    setForm(data);
    setTimeLimit(String(data.exact_solver_time_limit_seconds));
    setSizeLimit(String(data.exact_solver_model_size_limit));
    setHorizon(durationForm(data.master_horizon_duration));
  }, []);
  const load = useCallback(async () => {
    const data = await run(getSettings);
    if (data) populate(data);
  }, [run, populate]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    const data = await run(
      () =>
        updateSettings({
          master_horizon_duration: parseDuration(horizon),
          exact_solver_time_limit_seconds: parseNumericInput(
            timeLimit,
            "Exact solver time limit",
            { min: Number.MIN_VALUE, integer: false },
          ),
          exact_solver_model_size_limit: parseNumericInput(
            sizeLimit,
            "Exact solver model size limit",
            { min: 1 },
          ),
          heuristic_enabled: form.heuristic_enabled,
          free_time_week_start_day: form.free_time_week_start_day,
        }),
      "Settings saved",
    );
    if (data) populate(data);
  };
  return (
    <section className="view">
      <div className="view-header">
        <h2>App Settings</h2>
        {settings && (
          <LoadingButton loading={loading} onClick={() => void save()}>
            Save settings
          </LoadingButton>
        )}
      </div>
      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      <ErrorBanner detail={error} onDismiss={clearFeedback} />
      {!settings ? (
        <LoadingButton loading={loading} onClick={() => void load()}>
          Reload settings
        </LoadingButton>
      ) : (
        <div className="settings-form">
          <p className="muted">
            Last updated: {formatDateTime(settings.updated_at)}
          </p>
          <p>
            Local timezone:{" "}
            {timezoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone)}
          </p>
          <DurationFields
            label="Master horizon"
            value={horizon}
            onChange={setHorizon}
          />
          <LabeledField label="Exact solver time limit (seconds)">
            <input
              type="text"
              inputMode="decimal"
              value={timeLimit}
              onChange={(event) => setTimeLimit(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="Exact solver model size limit">
            <input
              type="text"
              inputMode="numeric"
              value={sizeLimit}
              onChange={(event) => setSizeLimit(event.target.value)}
            />
          </LabeledField>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.heuristic_enabled ?? false}
              onChange={(event) =>
                setForm({ ...form, heuristic_enabled: event.target.checked })
              }
            />
            Heuristic enabled
          </label>
          <LabeledField label="Free-time week start day">
            <select
              value={form.free_time_week_start_day ?? "MONDAY"}
              onChange={(event) =>
                setForm({
                  ...form,
                  free_time_week_start_day: event.target
                    .value as FreeTimeWeekStartDay,
                })
              }
            >
              {WEEK_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
      )}
    </section>
  );
}
