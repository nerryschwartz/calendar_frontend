import { useState } from "react";
import type {
  DraftEdit,
  PlanDetailDTO,
  PlanKind,
  RepeatMode,
} from "../../api/types";
import PlanSearchInput from "../PlanSearchInput";

interface PlanEditControlsProps {
  plan: PlanDetailDTO;
  queueEdit: (edit: DraftEdit) => void;
}

export default function PlanEditControls({
  plan,
  queueEdit,
}: PlanEditControlsProps) {
  const [renameValue, setRenameValue] = useState(plan.name);
  const [childKind, setChildKind] = useState<PlanKind>("GOAL");
  const [childName, setChildName] = useState("");
  const [childCritical, setChildCritical] = useState(false);
  const [childDuration, setChildDuration] = useState(30);
  const [childBlockFamily, setChildBlockFamily] = useState("default");
  const [childDivisible, setChildDivisible] = useState(false);
  const [childMinChunk, setChildMinChunk] = useState<number | "">("");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("MANUAL_COUNT");
  const [repeatInterval, setRepeatInterval] = useState(1440);
  const [manualCount, setManualCount] = useState(5);
  const [movePosition, setMovePosition] = useState(0);
  const [moveCritical, setMoveCritical] = useState<boolean | "">("");
  const [taskDuration, setTaskDuration] = useState(
    plan.task_detail?.duration_minutes ?? 30,
  );
  const [taskDivisible, setTaskDivisible] = useState(
    plan.task_detail?.divisible ?? false,
  );
  const [taskMinChunk, setTaskMinChunk] = useState<number | "">(
    plan.task_detail?.minimum_chunk_size_minutes ?? "",
  );
  const [taskFamilies, setTaskFamilies] = useState(
    plan.task_detail?.allowed_block_families.join(", ") ?? "",
  );
  const [blockDuration, setBlockDuration] = useState(
    plan.block_detail?.duration_minutes ?? 30,
  );
  const [blockDivisible, setBlockDivisible] = useState(
    plan.block_detail?.divisible ?? false,
  );
  const [blockMinChunk, setBlockMinChunk] = useState<number | "">(
    plan.block_detail?.minimum_chunk_size_minutes ?? "",
  );
  const [blockFamily, setBlockFamily] = useState(
    plan.block_detail?.block_family ?? "default",
  );

  return (
    <div className="edit-panel">
      <h3>Edit controls</h3>

      <fieldset>
        <legend>Rename</legend>
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            queueEdit({
              type: "rename",
              planId: plan.plan_id,
              name: renameValue,
            })
          }
        >
          Queue rename
        </button>
      </fieldset>

      <fieldset>
        <legend>Create child</legend>
        <select
          value={childKind}
          onChange={(e) => setChildKind(e.target.value as PlanKind)}
        >
          <option value="GOAL">GOAL</option>
          <option value="TASK">TASK</option>
          <option value="BLOCK">BLOCK</option>
          <option value="REPETITION">REPETITION</option>
        </select>
        <input
          type="text"
          placeholder="Name"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={childCritical}
            onChange={(e) => setChildCritical(e.target.checked)}
          />
          Critical
        </label>
        {(childKind === "TASK" || childKind === "BLOCK") && (
          <>
            <input
              type="number"
              min={1}
              value={childDuration}
              onChange={(e) => setChildDuration(Number(e.target.value))}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={childDivisible}
                onChange={(e) => setChildDivisible(e.target.checked)}
              />
              Divisible
            </label>
            <input
              type="number"
              min={1}
              placeholder="Min chunk"
              value={childMinChunk}
              onChange={(e) =>
                setChildMinChunk(e.target.value ? Number(e.target.value) : "")
              }
            />
            {childKind === "BLOCK" && (
              <input
                type="text"
                placeholder="Block family"
                value={childBlockFamily}
                onChange={(e) => setChildBlockFamily(e.target.value)}
              />
            )}
          </>
        )}
        {childKind === "REPETITION" && (
          <>
            <select
              value={repeatMode}
              onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}
            >
              <option value="MANUAL_COUNT">MANUAL_COUNT</option>
              <option value="DATE_RANGE">DATE_RANGE</option>
            </select>
            <input
              type="number"
              min={1}
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(Number(e.target.value))}
            />
            <input
              type="number"
              min={1}
              value={manualCount}
              onChange={(e) => setManualCount(Number(e.target.value))}
            />
          </>
        )}
        <button
          type="button"
          className="btn-secondary"
          disabled={!childName.trim()}
          onClick={() =>
            queueEdit({
              type: "createChild",
              parentId: plan.plan_id,
              body: {
                kind: childKind,
                is_critical: childCritical,
                name: childName.trim(),
                duration_minutes:
                  childKind !== "GOAL" && childKind !== "REPETITION"
                    ? childDuration
                    : undefined,
                divisible:
                  childKind === "TASK" || childKind === "BLOCK"
                    ? childDivisible
                    : undefined,
                minimum_chunk_size_minutes:
                  childKind === "TASK" || childKind === "BLOCK"
                    ? childMinChunk === ""
                      ? null
                      : Number(childMinChunk)
                    : undefined,
                block_family:
                  childKind === "BLOCK" ? childBlockFamily : undefined,
                repeat_mode:
                  childKind === "REPETITION" ? repeatMode : undefined,
                repeat_interval_minutes:
                  childKind === "REPETITION" ? repeatInterval : undefined,
                manual_count:
                  childKind === "REPETITION" ? manualCount : undefined,
                start_time:
                  childKind === "REPETITION"
                    ? new Date().toISOString()
                    : undefined,
                template_type: childKind === "REPETITION" ? "TASK" : undefined,
                template_name:
                  childKind === "REPETITION"
                    ? `${childName.trim()} template`
                    : undefined,
                template_duration_minutes:
                  childKind === "REPETITION" ? 30 : undefined,
              },
            })
          }
        >
          Queue create child
        </button>
      </fieldset>

      <fieldset>
        <legend>Move</legend>
        <input
          type="number"
          min={0}
          value={movePosition}
          onChange={(e) => setMovePosition(Number(e.target.value))}
        />
        <select
          value={moveCritical === "" ? "" : moveCritical ? "true" : "false"}
          onChange={(e) =>
            setMoveCritical(
              e.target.value === "" ? "" : e.target.value === "true",
            )
          }
        >
          <option value="">Keep critical unchanged</option>
          <option value="true">Critical</option>
          <option value="false">Not critical</option>
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            queueEdit({
              type: "move",
              planId: plan.plan_id,
              position: movePosition,
              isCritical: moveCritical === "" ? undefined : moveCritical,
            })
          }
        >
          Queue move
        </button>
      </fieldset>

      <fieldset>
        <legend>Add prerequisite</legend>
        <PlanSearchInput
          placeholder="Search prerequisite plan…"
          onSelect={(result) =>
            queueEdit({
              type: "addPrerequisite",
              planId: plan.plan_id,
              prerequisitePlanId: result.plan_id,
            })
          }
        />
      </fieldset>

      {plan.task_detail && (
        <fieldset>
          <legend>Task scheduling</legend>
          <input
            type="number"
            min={1}
            value={taskDuration}
            onChange={(e) => setTaskDuration(Number(e.target.value))}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={taskDivisible}
              onChange={(e) => setTaskDivisible(e.target.checked)}
            />
            Divisible
          </label>
          <input
            type="number"
            min={1}
            placeholder="Min chunk"
            value={taskMinChunk}
            onChange={(e) =>
              setTaskMinChunk(e.target.value ? Number(e.target.value) : "")
            }
          />
          <input
            type="text"
            placeholder="Block families (comma-separated)"
            value={taskFamilies}
            onChange={(e) => setTaskFamilies(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queueEdit({
                type: "taskScheduling",
                planId: plan.plan_id,
                body: {
                  duration_minutes: taskDuration,
                  divisible: taskDivisible,
                  minimum_chunk_size_minutes:
                    taskMinChunk === "" ? null : Number(taskMinChunk),
                },
              })
            }
          >
            Queue task scheduling
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queueEdit({
                type: "taskBlockFamilies",
                planId: plan.plan_id,
                families: taskFamilies
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Queue block families
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queueEdit({
                type: plan.task_detail!.user_completed
                  ? "taskReopen"
                  : "taskComplete",
                planId: plan.plan_id,
              })
            }
          >
            Queue {plan.task_detail.user_completed ? "reopen" : "complete"} task
          </button>
        </fieldset>
      )}

      {plan.block_detail && (
        <fieldset>
          <legend>Block scheduling</legend>
          <input
            type="number"
            min={1}
            value={blockDuration}
            onChange={(e) => setBlockDuration(Number(e.target.value))}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={blockDivisible}
              onChange={(e) => setBlockDivisible(e.target.checked)}
            />
            Divisible
          </label>
          <input
            type="number"
            min={1}
            placeholder="Min chunk"
            value={blockMinChunk}
            onChange={(e) =>
              setBlockMinChunk(e.target.value ? Number(e.target.value) : "")
            }
          />
          <input
            type="text"
            value={blockFamily}
            onChange={(e) => setBlockFamily(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queueEdit({
                type: "blockScheduling",
                planId: plan.plan_id,
                body: {
                  duration_minutes: blockDuration,
                  divisible: blockDivisible,
                  minimum_chunk_size_minutes:
                    blockMinChunk === "" ? null : Number(blockMinChunk),
                  block_family: blockFamily,
                },
              })
            }
          >
            Queue block scheduling
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queueEdit({
                type: plan.block_detail!.user_completed
                  ? "blockReopen"
                  : "blockComplete",
                planId: plan.plan_id,
              })
            }
          >
            Queue {plan.block_detail.user_completed ? "reopen" : "complete"}{" "}
            block
          </button>
        </fieldset>
      )}
    </div>
  );
}
