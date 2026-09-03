import { useCallback, useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import type { AppSettingsDTO, FreeTimeWeekStartDay } from "../api/types";
import DetailGrid from "../components/DetailGrid";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import StatusBanner from "../components/StatusBanner";
import { useAsyncAction } from "../hooks/useAsyncAction";
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

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_MONTH = 30 * MINUTES_PER_DAY;
const MINUTES_PER_YEAR = 365 * MINUTES_PER_DAY;

interface HorizonParts {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
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
  return { years, months, days, hours, minutes: remaining };
}

function combineHorizonParts(parts: HorizonParts): number {
  return (
    parts.years * MINUTES_PER_YEAR +
    parts.months * MINUTES_PER_MONTH +
    parts.days * MINUTES_PER_DAY +
    parts.hours * MINUTES_PER_HOUR +
    parts.minutes
  );
}

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [form, setForm] = useState<Partial<AppSettingsDTO>>({});
  const [horizonParts, setHorizonParts] = useState<HorizonParts>(
    splitHorizonDuration(0),
  );
  const { run, loading, error, successMessage, clearFeedback } =
    useAsyncAction();

  const load = useCallback(async () => {
    const data = await getSettings();
    setSettings(data);
    setForm(data);
    setHorizonParts(splitHorizonDuration(data.master_horizon_duration_minutes));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateHorizonPart = (part: keyof HorizonParts, value: string) => {
    setHorizonParts((current) => ({
      ...current,
      [part]: Math.max(0, Number(value) || 0),
    }));
  };

  const handleSave = async () => {
    const masterHorizonDurationMinutes = combineHorizonParts(horizonParts);
    const updated = await run(async () => {
      if (masterHorizonDurationMinutes <= 0) {
        throw new Error("Master horizon must be greater than zero minutes");
      }
      return await updateSettings({
        local_timezone: form.local_timezone,
        master_horizon_duration_minutes: masterHorizonDurationMinutes,
        exact_solver_time_limit_seconds: form.exact_solver_time_limit_seconds,
        exact_solver_model_size_limit: form.exact_solver_model_size_limit,
        heuristic_enabled: form.heuristic_enabled,
        free_time_week_start_day: form.free_time_week_start_day,
      });
    }, "Settings saved");
    if (updated) {
      setSettings(updated);
      setForm(updated);
      setHorizonParts(
        splitHorizonDuration(updated.master_horizon_duration_minutes),
      );
    }
  };

  if (!settings) {
    return <p className="muted">Loading settings…</p>;
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
            <input
              type="text"
              value={form.local_timezone ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, local_timezone: e.target.value }))
              }
            />
          </label>
          <fieldset className="settings-fieldset">
            <legend>Master horizon</legend>
            <label className="labeled-field">
              <span>Years</span>
              <input
                type="number"
                min={0}
                value={horizonParts.years}
                onChange={(e) => updateHorizonPart("years", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Months</span>
              <input
                type="number"
                min={0}
                value={horizonParts.months}
                onChange={(e) => updateHorizonPart("months", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Days</span>
              <input
                type="number"
                min={0}
                value={horizonParts.days}
                onChange={(e) => updateHorizonPart("days", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Hours</span>
              <input
                type="number"
                min={0}
                value={horizonParts.hours}
                onChange={(e) => updateHorizonPart("hours", e.target.value)}
              />
            </label>
            <label className="labeled-field">
              <span>Minutes</span>
              <input
                type="number"
                min={0}
                value={horizonParts.minutes}
                onChange={(e) => updateHorizonPart("minutes", e.target.value)}
              />
            </label>
          </fieldset>
          <label className="labeled-field">
            Exact solver time limit (seconds)
            <input
              type="number"
              value={form.exact_solver_time_limit_seconds ?? 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  exact_solver_time_limit_seconds: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="labeled-field">
            Exact solver model size limit
            <input
              type="number"
              value={form.exact_solver_model_size_limit ?? 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  exact_solver_model_size_limit: Number(e.target.value),
                }))
              }
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
