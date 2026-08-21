import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addFreeTimePrerequisite,
  createFreeTimeActivity,
  listFreeTimeActivities,
  setFreeTimeActivityEnabled,
  setFreeTimeBlockFamilies,
  updateFreeTimeActivity,
} from "../api/freeTime";
import type { FreeTimeActivityDTO } from "../api/types";
import ErrorBanner from "../components/ErrorBanner";
import LoadingButton from "../components/LoadingButton";
import PlanSearchInput from "../components/PlanSearchInput";
import StatusBanner from "../components/StatusBanner";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { formatDateTime } from "../utils/format";

export default function FreeTimeView() {
  const [activities, setActivities] = useState<FreeTimeActivityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const { run, error, successMessage, clearFeedback } = useAsyncAction();
  const [newName, setNewName] = useState("");
  const [newFraction, setNewFraction] = useState("0.25");
  const [newMinBlock, setNewMinBlock] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFreeTimeActivities();
      setActivities(data.activities);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const created = await run(
      () =>
        createFreeTimeActivity({
          name: newName.trim(),
          real_fraction: Number(newFraction),
          minimum_block_size_minutes: newMinBlock,
          enabled: true,
        }),
      `Created activity "${newName.trim()}"`,
    );
    if (created) {
      setNewName("");
      await load();
    }
  };

  const toggleEnabled = async (activity: FreeTimeActivityDTO) => {
    await run(
      () =>
        setFreeTimeActivityEnabled(
          activity.free_time_activity_id,
          !activity.enabled,
        ),
      activity.enabled ? "Activity disabled" : "Activity enabled",
    );
    await load();
  };

  const updateFamilies = async (
    activity: FreeTimeActivityDTO,
    familiesText: string,
  ) => {
    const families = familiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await run(
      () => setFreeTimeBlockFamilies(activity.free_time_activity_id, families),
      "Block families updated",
    );
    await load();
  };

  return (
    <section className="view">
      <div className="view-header">
        <h2>Free-Time Activities</h2>
      </div>

      <StatusBanner message={successMessage} onDismiss={clearFeedback} />
      <ErrorBanner detail={error} onDismiss={clearFeedback} />

      <div className="detail-panel">
        <h3>Create activity</h3>
        <div className="settings-form">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="Real fraction"
            value={newFraction}
            onChange={(e) => setNewFraction(e.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Min block (min)"
            value={newMinBlock}
            onChange={(e) => setNewMinBlock(Number(e.target.value))}
          />
          <LoadingButton
            disabled={!newName.trim()}
            onClick={() => void handleCreate()}
          >
            Create
          </LoadingButton>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading activities…</p>
      ) : activities.length === 0 ? (
        <p className="muted">No free-time activities configured.</p>
      ) : (
        activities.map((activity) => (
          <ActivityCard
            key={activity.free_time_activity_id}
            activity={activity}
            onToggle={() => void toggleEnabled(activity)}
            onUpdateFamilies={(text) => void updateFamilies(activity, text)}
            onUpdated={() => void load()}
            run={run}
          />
        ))
      )}
    </section>
  );
}

function ActivityCard({
  activity,
  onToggle,
  onUpdateFamilies,
  onUpdated,
  run,
}: {
  activity: FreeTimeActivityDTO;
  onToggle: () => void;
  onUpdateFamilies: (text: string) => void;
  onUpdated: () => void;
  run: ReturnType<typeof useAsyncAction>["run"];
}) {
  const [name, setName] = useState(activity.name);
  const [families, setFamilies] = useState(
    activity.allowed_block_families.join(", "),
  );

  const saveName = async () => {
    await run(
      () =>
        updateFreeTimeActivity(activity.free_time_activity_id, {
          name: name.trim(),
        }),
      "Activity updated",
    );
    onUpdated();
  };

  return (
    <div className="detail-panel">
      <div className="view-header">
        <h3>{activity.name}</h3>
        <span className={activity.enabled ? "badge-ok" : "badge-muted"}>
          {activity.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <p className="muted">
        Fraction: {activity.real_fraction} · Min block:{" "}
        {activity.minimum_block_size_minutes} min · Updated{" "}
        {formatDateTime(activity.updated_at)}
      </p>
      <p>
        Prerequisites:{" "}
        {activity.prerequisite_plan_ids.length === 0
          ? "none"
          : activity.prerequisite_plan_ids.map((id) => (
              <Link key={id} to={`/plan-tree/${id}`}>
                {" "}
                {id}{" "}
              </Link>
            ))}
      </p>
      <p>
        Block families: {activity.allowed_block_families.join(", ") || "none"}
      </p>
      <div className="settings-form">
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <LoadingButton variant="secondary" onClick={() => void saveName()}>
          Rename
        </LoadingButton>
        <LoadingButton variant="secondary" onClick={onToggle}>
          {activity.enabled ? "Disable" : "Enable"}
        </LoadingButton>
        <input
          value={families}
          onChange={(e) => setFamilies(e.target.value)}
          placeholder="Block families (comma-separated)"
        />
        <LoadingButton
          variant="secondary"
          onClick={() => onUpdateFamilies(families)}
        >
          Save families
        </LoadingButton>
      </div>
      <div className="detail-panel nested">
        <h4>Add prerequisite</h4>
        <PlanSearchInput
          placeholder="Search plan prerequisite…"
          onSelect={(result) => {
            void run(
              () =>
                addFreeTimePrerequisite(
                  activity.free_time_activity_id,
                  result.plan_id,
                ),
              "Prerequisite added",
            ).then(() => onUpdated());
          }}
        />
      </div>
    </div>
  );
}
