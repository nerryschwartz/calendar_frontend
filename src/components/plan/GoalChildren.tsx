import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GripVertical } from "lucide-react";
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

function ChildRow({
  child,
  index,
  group,
  disabled,
}: {
  child: GoalChild;
  index: number;
  group: string;
  disabled: boolean;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: planRefKey(child.ref),
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
    </li>
  );
}

function ChildGroup({
  id,
  items,
  children,
  disabled,
}: {
  id: keyof Groups;
  items: string[];
  children: GoalChild[];
  disabled: boolean;
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
          const toRef = (key: string) => generatedPlanRef(key, edits);
          queueEdit({
            type: "reorderChildren",
            planRef: parentRef,
            criticalRefs: current.current.critical.map(toRef),
            nonCriticalRefs: current.current.noncritical.map(toRef),
            previousChildRefs: [
              ...plan.children.map((child) =>
                generatedPlanRef(child.plan_id, edits),
              ),
              ...children.map((child) => child.ref),
            ],
          });
        }}
      >
        {!plan.is_master && (
          <ChildGroup
            id="critical"
            items={items.critical}
            children={children}
            disabled={!editMode}
          />
        )}
        <ChildGroup
          id="noncritical"
          items={items.noncritical}
          children={children}
          disabled={!editMode}
        />
      </DragDropProvider>
    </section>
  );
}
