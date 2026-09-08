import { useCallback, useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import type { AppSettingsDTO, FreeTimeWeekStartDay } from "../api/types";
import DetailGrid from "../components/DetailGrid";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import StatusBanner from "../components/StatusBanner";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { formatDateTime } from "../utils/format";
import { parseNumericInput } from "../utils/input";
import {
  normalizeTimezone,
  timezoneLabel,
  timezoneOptions,
} from "../utils/timezones";

const WEEK_DAYS: FreeTimeWeekStartDay[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_MONTH = 30 * MINUTES_PER_DAY;
const MINUTES_PER_YEAR = 365 * MINUTES_PER_DAY;

interface HorizonParts {
  years: string;
  months: string;
  days: string;
  hours: string;
  minutes: string;
}

function splitHorizonDuration(totalMinutes: number): HorizonParts {
  let remaining = Math.max(0, Math.floor(totalMinutes));
  const years = Math.floor(remaining / MINUTES_PER_YEAR);
  remaining -= years * MINUTES_PER_YEAR;
  const months = Math.floor(remaining / MINUTES_PER_MONTH);
  remaining -= months * MINUTES_PER_MONTH;
  const days = Math.floor(remaining / MINUTES_PER_DAY);
  remaining -= days * MINUTES_PER_DAY;
  const hours = Math.floor(remaining / MINUTES_PER_HOUR);
  remaining -= hours * MINUTES_PER_HOUR;
  return {
    years: String(years),
    months: String(months),
    days: String(days),
    hours: String(hours),
    minutes: String(remaining),
  };
}

function combineHorizonParts(parts: HorizonParts): number {
  return (
    parseNumericInput(parts.years, "Years") * MINUTES_PER_YEAR +
    parseNumericInput(parts.months, "Months") * MINUTES_PER_MONTH +
    parseNumericInput(parts.days, "Days") * MINUTES_PER_DAY +
    parseNumericInput(parts.hours, "Hours") * MINUTES_PER_HOUR +
    parseNumericInput(parts.minutes, "Minutes")
  );
}

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [form, setForm] = useState<Partial<AppSettingsDTO>>({});
  const [timeLimit, setTimeLimit] = useState("");
  const [sizeLimit, setSizeLimit] = useState("");
  const [horizonParts, setHorizonParts] = useState<HorizonParts>(
    splitHorizonDuration(0),
  );
  const { run, loading, error, successMessage, clearFeedback } =
    useAsyncAction();

  const load = useCallback(async () => {
    const data = await run(getSettings);
    if (!data) return;
    setSettings(data);
    setForm({
      ...data,
      local_timezone: normalizeTimezone(data.local_timezone),
    });
    setTimeLimit(String(data.exact_solver_time_limit_seconds));
    setSizeLimit(String(data.exact_solver_model_size_limit));
    setHorizonParts(splitHorizonDuration(data.master_horizon_duration_minutes));
  }, [run]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateHorizonPart = (part: keyof HorizonParts, value: string) => {
    setHorizonParts((current) => ({
      ...current,
      [part]: value,
    }));
  };

  const handleSave = async () => {
    const updated = await run(async () => {
      const masterHorizonDurationMinutes = combineHorizonParts(horizonParts);
      if (
        !Number.isSafeInteger(masterHorizonDurationMinutes) ||
        masterHorizonDurationMinutes <= 0
      ) {
        throw new Error("Master horizon must be greater than zero minutes");
      }
      return await updateSettings({
        local_timezone: form.local_timezone,
        master_horizon_duration_minutes: masterHorizonDurationMinutes,
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
      });
    }, "Settings saved");
    if (updated) {
      setSettings(updated);
      setForm({
        ...updated,
        local_timezone: normalizeTimezone(updated.local_timezone),
      });
      setTimeLimit(String(updated.exact_solver_time_limit_seconds));
      setSizeLimit(String(updated.exact_solver_model_size_limit));
      setHorizonParts(
        splitHorizonDuration(updated.master_horizon_duration_minutes),
      );
    }
  };

  if (!settings) {
    return (
      <section className="view">
        <ErrorBanner detail={error} />
        <p className="muted">
          {loading ? "Loading settings…" : "Settings unavailable."}
        </p>
        <LoadingButton loading={loading} onClick={() => void load()}>
          Reload settings
        </LoadingButton>
      </section>
    );
  }

  return (
    <section className="view">
      <div className="view-header">
        <h2>App Settings</h2>
        <LoadingButton
          loading={loading}
          loadingLabel="Saving…"
          onClick={() => void handleSave()}
        >
          Save settings
        </LoadingButton>
      </div>

      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      <ErrorBanner detail={error} onDismiss={clearFeedback} />

      <div className="detail-panel">
        <DetailGrid
          items={[
            {
              label: "Last updated",
              value: formatDateTime(settings.updated_at),
            },
          ]}
        />
        <div className="settings-form">
          <label className="labeled-field">
            Local timezone
            <select
              value={form.local_timezone ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, local_timezone: e.target.value }))
              }
            >
              {timezoneOptions(form.local_timezone ?? "UTC").map((zone) => (
                <option key={zone} value={zone}>
                  {timezoneLabel(zone)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="settings-fieldset">
            <legend>Master horizon</legend>
            <label className="labeled-field">
              <span>Years</span>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                value={horizonParts.years}
                onChange={(e) => updateHorizonPart("years", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Months</span>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                value={horizonParts.months}
                onChange={(e) => updateHorizonPart("months", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Days</span>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                value={horizonParts.days}
                onChange={(e) => updateHorizonPart("days", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Hours</span>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                value={horizonParts.hours}
                onChange={(e) => updateHorizonPart("hours", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Minutes</span>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                value={horizonParts.minutes}
                onChange={(e) => updateHorizonPart("minutes", e.target.value)}
              />
            </label>
          </fieldset>
          <label className="labeled-field">
            Exact solver time limit (seconds)
            <input
              type="text"
              inputMode="decimal"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
            />
          </label>
          <label className="labeled-field">
            Exact solver model size limit
            <input
              type="text"
              inputMode="numeric"
              value={sizeLimit}
              onChange={(e) => setSizeLimit(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.heuristic_enabled ?? false}
              onChange={(e) =>
                setForm((f) => ({ ...f, heuristic_enabled: e.target.checked }))
              }
            />
            Heuristic enabled
          </label>
          <label className="labeled-field">
            Free-time week start day
            <select
              value={form.free_time_week_start_day ?? "MONDAY"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  free_time_week_start_day: e.target
                    .value as FreeTimeWeekStartDay,
                }))
              }
            >
              {WEEK_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
