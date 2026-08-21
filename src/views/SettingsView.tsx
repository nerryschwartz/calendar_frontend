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

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [form, setForm] = useState<Partial<AppSettingsDTO>>({});
  const { run, loading, error, successMessage, clearFeedback } =
    useAsyncAction();

  const load = useCallback(async () => {
    const data = await getSettings();
    setSettings(data);
    setForm(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const updated = await run(
      () =>
        updateSettings({
          local_timezone: form.local_timezone,
          master_horizon_duration_minutes: form.master_horizon_duration_minutes,
          exact_solver_time_limit_seconds: form.exact_solver_time_limit_seconds,
          exact_solver_model_size_limit: form.exact_solver_model_size_limit,
          heuristic_enabled: form.heuristic_enabled,
          free_time_week_start_day: form.free_time_week_start_day,
        }),
      "Settings saved",
    );
    if (updated) {
      setSettings(updated);
      setForm(updated);
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
          <label>
            Local timezone
            <input
              type="text"
              value={form.local_timezone ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, local_timezone: e.target.value }))
              }
            />
          </label>
          <label>
            Master horizon (minutes)
            <input
              type="number"
              value={form.master_horizon_duration_minutes ?? 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  master_horizon_duration_minutes: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
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
          <label>
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
          <label>
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
