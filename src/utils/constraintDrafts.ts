import {
  planRefsEqual,
  type DraftEdit,
  type PlanRef,
  type TimeConstraintGroupDTO,
} from "../api/types";

export function projectConstraintGroups(
  groups: TimeConstraintGroupDTO[],
  edits: DraftEdit[],
  ref: PlanRef,
  alias?: PlanRef,
): TimeConstraintGroupDTO[] {
  let result = groups.map((group) => ({
    ...group,
    windows: [...group.windows],
  }));
  for (const edit of edits) {
    if (
      !("planRef" in edit) ||
      !(
        planRefsEqual(edit.planRef, ref) ||
        (alias && planRefsEqual(edit.planRef, alias))
      )
    )
      continue;
    if (edit.type === "addConstraintGroup") {
      const id = edit.groupId ?? `queued-group-${edits.indexOf(edit)}`;
      result.push({
        constraint_group_id: id,
        plan_id: "",
        constraint_kind: "USER",
        windows: edit.body.windows.map((window, index) => ({
          ...window,
          time_window_id: `${id}:window:${index}`,
        })),
      });
    }
    if (edit.type === "removeConstraintGroup")
      result = result.filter(
        (group) => group.constraint_group_id !== edit.groupId,
      );
    if (!("groupId" in edit)) continue;
    const group = result.find(
      (item) => item.constraint_group_id === edit.groupId,
    );
    if (!group) continue;
    if (edit.type === "replaceConstraintWindows")
      group.windows = edit.body.windows.map((window, index) => ({
        ...window,
        time_window_id: `${edit.groupId}:replacement:${edits.indexOf(edit)}:${index}`,
      }));
    if (edit.type === "addConstraintWindow")
      group.windows.push({
        ...edit.body,
        time_window_id: `${edit.groupId}:added:${edits.indexOf(edit)}`,
      });
    if (edit.type === "removeConstraintWindow")
      group.windows = group.windows.filter(
        (window) => window.time_window_id !== edit.windowId,
      );
  }
  return result;
}
