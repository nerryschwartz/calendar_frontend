import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRightLeft, ArrowUp, GripVertical } from "lucide-react";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { goalChildren, type GoalChild } from "../../utils/goalChildren";
import { generatedPlanRef } from "../../utils/generatedPlans";
import {
  persistedPlanRef,
  planRefKey,
  type DraftEdit,
  type PlanDetailDTO,
  type PlanRef,
} from "../../api/types";

type Groups = { critical: string[]; noncritical: string[] };
type GroupId = keyof Groups;
type KeyboardMove = "up" | "down" | "toggle";

function ChildRow({
  child,
  index,
  group,
  disabled,
  itemCount,
  canChangeCritical,
  onKeyboardMove,
}: {
  child: GoalChild;
  index: number;
  group: GroupId;
  disabled: boolean;
  itemCount: number;
  canChangeCritical: boolean;
  onKeyboardMove: (key: string, move: KeyboardMove) => void;
}) {
  const key = planRefKey(child.ref);
  const { ref, handleRef, isDragging } = useSortable({
    id: key,
    index,
    group,
    type: "goal-child",
    accept: "goal-child",
    disabled,
  });
  return (
    <li
      ref={ref}
      className={"goal-child-row" + (isDragging ? " dragging" : "")}
    >
      {!disabled && (
        <button
          type="button"
          ref={handleRef}
          className="drag-handle"
          aria-label={"Move " + child.name}
          title={"Move " + child.name}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      )}
      <span className="goal-child-name">
        {child.ref.kind === "persisted" ? (
          <Link to={"/plan-tree/" + child.ref.planId}>
            {child.name} ({child.kind})
          </Link>
        ) : (
          <>
            {child.name} ({child.kind}) <span className="muted">pending</span>
          </>
        )}
      </span>
      {!disabled && (
        <span className="goal-child-actions">
          <button
            type="button"
            className="child-order-button"
            aria-label={"Move " + child.name + " up"}
            title={"Move " + child.name + " up"}
            disabled={index === 0}
            onClick={() => onKeyboardMove(key, "up")}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="child-order-button"
            aria-label={"Move " + child.name + " down"}
            title={"Move " + child.name + " down"}
            disabled={index === itemCount - 1}
            onClick={() => onKeyboardMove(key, "down")}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          {canChangeCritical && (
            <button
              type="button"
              className="child-order-button"
              aria-label={
                "Move " +
                child.name +
                (group === "critical"
                  ? " to non-critical children"
                  : " to critical children")
              }
              title={
                "Move " +
                child.name +
                (group === "critical"
                  ? " to non-critical children"
                  : " to critical children")
              }
              onClick={() => onKeyboardMove(key, "toggle")}
            >
              <ArrowRightLeft size={16} aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </li>
  );
}

function ChildGroup({
  id,
  items,
  children,
  disabled,
  canChangeCritical,
  onKeyboardMove,
}: {
  id: GroupId;
  items: string[];
  children: GoalChild[];
  disabled: boolean;
  canChangeCritical: boolean;
  onKeyboardMove: (key: string, move: KeyboardMove) => void;
}) {
  const title =
    id === "critical" ? "Critical children" : "Non-critical children";
  const { ref, isDropTarget } = useDroppable({
    id,
    type: "child-group",
    accept: "goal-child",
    collisionPriority: -1,
    disabled,
  });
  return (
    <section
      ref={ref}
      aria-label={title}
      className={"child-priority-group" + (isDropTarget ? " drop-target" : "")}
    >
      <h4>{title}</h4>
      <ol>
        {items.map((key, index) => {
          const child = children.find((item) => planRefKey(item.ref) === key);
          return child ? (
            <ChildRow
              key={key}
              child={child}
              index={index}
              group={id}
              disabled={disabled}
              itemCount={items.length}
              canChangeCritical={canChangeCritical}
              onKeyboardMove={onKeyboardMove}
            />
          ) : null;
        })}
      </ol>
      {!items.length && <p className="muted empty-child-group">No children.</p>}
    </section>
  );
}

export default function GoalChildren({
  plan,
  parentRef = persistedPlanRef(plan.plan_id),
  edits,
  editMode,
  queueEdit,
}: {
  plan: PlanDetailDTO;
  parentRef?: PlanRef;
  edits: DraftEdit[];
  editMode: boolean;
  queueEdit: (edit: DraftEdit) => void;
}) {
  const children = goalChildren(plan, parentRef, edits);
  const projected: Groups = {
    critical: children
      .filter((child) => child.critical)
      .map((child) => planRefKey(child.ref)),
    noncritical: children
      .filter((child) => !child.critical)
      .map((child) => planRefKey(child.ref)),
  };
  const signature = JSON.stringify(projected);
  const [items, setItems] = useState(projected);
  const current = useRef(items);
  const previous = useRef(items);
  useEffect(() => {
    const next = JSON.parse(signature) as Groups;
    setItems(next);
    current.current = next;
  }, [signature]);
  const emitOrder = (next: Groups) => {
    current.current = next;
    setItems(next);
    const toRef = (key: string) => generatedPlanRef(key, edits);
    queueEdit({
      type: "reorderChildren",
      planRef: parentRef,
      criticalRefs: next.critical.map(toRef),
      nonCriticalRefs: next.noncritical.map(toRef),
      previousChildRefs: [
        ...plan.children.map((child) => generatedPlanRef(child.plan_id, edits)),
        ...children.map((child) => child.ref),
      ],
    });
  };
  const keyboardMove = (key: string, moveKind: KeyboardMove) => {
    const source: GroupId = current.current.critical.includes(key)
      ? "critical"
      : "noncritical";
    const sourceItems = [...current.current[source]];
    const index = sourceItems.indexOf(key);
    if (index < 0) return;
    if (moveKind === "toggle") {
      const target: GroupId =
        source === "critical" ? "noncritical" : "critical";
      sourceItems.splice(index, 1);
      emitOrder({
        ...current.current,
        [source]: sourceItems,
        [target]: [...current.current[target], key],
      });
      return;
    }
    const nextIndex = moveKind === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= sourceItems.length) return;
    sourceItems.splice(index, 1);
    sourceItems.splice(nextIndex, 0, key);
    emitOrder({ ...current.current, [source]: sourceItems });
  };
  return (
    <section className="detail-panel" aria-label="Children">
      <h3>Children</h3>
      <DragDropProvider
        onDragStart={() => {
          previous.current = current.current;
        }}
        onDragOver={(event) => {
          const next = move(current.current, event);
          current.current = next;
          setItems(next);
        }}
        onDragEnd={(event) => {
          if (event.canceled) {
            current.current = previous.current;
            setItems(previous.current);
            return;
          }
          if (
            !event.operation.target ||
            JSON.stringify(current.current) === JSON.stringify(previous.current)
          )
            return;
          emitOrder(current.current);
        }}
      >
        {!plan.is_master && (
          <ChildGroup
            id="critical"
            items={items.critical}
            children={children}
            disabled={!editMode}
            canChangeCritical
            onKeyboardMove={keyboardMove}
          />
        )}
        <ChildGroup
          id="noncritical"
          items={items.noncritical}
          children={children}
          disabled={!editMode}
          canChangeCritical={!plan.is_master}
          onKeyboardMove={keyboardMove}
        />
      </DragDropProvider>
    </section>
  );
}
