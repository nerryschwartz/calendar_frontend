import { useEffect, useState } from "react";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  planRefKey,
  type DraftEdit,
  type PlanRef,
  type PlanDetailDTO,
  type PlanKind,
  type CreateChildBody,
  type UserWindowBody,
  type BlockSchedulingBody,
  type UpdateRepetitionSettingsBody,
} from "../../api/types";
import { getPlanDetail } from "../../api/plans";
import PlanConstraintsPanel from "./PlanConstraintsPanel";
import { useGenerationForm } from "../PlanDraftProvider";
import { datetimeLocalToIso } from "../../utils/format";
import { parseFamilies, parseNumericInput } from "../../utils/input";
import PlanSearchInput from "../PlanSearchInput";
import LabeledField from "../LabeledField";
import SchedulingFields, {
  schedulingForm,
  parseScheduling,
} from "./SchedulingFields";
import RepetitionFields, {
  repetitionForm,
  parseRepetition,
} from "./RepetitionFields";

type PendingChild = Extract<DraftEdit, { type: "createChild" }>;
interface Props {
  plan: PlanDetailDTO;
  draftEdits: DraftEdit[];
  queueEdit: (edit: DraftEdit) => void;
  onGenerate?: (ref: PlanRef, edits?: DraftEdit[]) => Promise<string | undefined>;
}
interface Prerequisite {
  ref: PlanRef;
  name: string;
}
const keyOf = planRefKey;
const refFromKey = (key: string): PlanRef =>
  key.startsWith("draft:")
    ? draftPlanRef(key.slice(6))
    : persistedPlanRef(key.slice(10));

function parseWindow(start: string, end: string): UserWindowBody {
  if (
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  )
    throw new Error("Constraint end must be after a valid start");
  return {
    start_time: datetimeLocalToIso(start),
    end_time: datetimeLocalToIso(end),
  };
}

function PrerequisitePicker({
  pending,
  onSelect,
}: {
  pending: PendingChild[];
  onSelect: (value: Prerequisite) => void;
}) {
  return (
    <>
      <PlanSearchInput
        label="Prerequisite plan"
        placeholder="Search prerequisite plan..."
        onSelect={(result) =>
          onSelect({ ref: persistedPlanRef(result.plan_id), name: result.name })
        }
      />
      {pending.length > 0 && (
        <LabeledField label="Pending prerequisite">
          <select
            value=""
            onChange={(event) => {
              const child = pending.find(
                (item) => item.draftId === event.target.value,
              );
              if (child)
                onSelect({
                  ref: draftPlanRef(child.draftId),
                  name: child.body.name,
                });
            }}
          >
            <option value="">Select a pending plan</option>
            {pending.map((child) => (
              <option key={child.draftId} value={child.draftId}>
                {child.body.name}
              </option>
            ))}
          </select>
        </LabeledField>
      )}
    </>
  );
}

export default function PlanEditControls({
  plan,
  draftEdits,
  queueEdit,
  onGenerate,
}: Props) {
  const pending = draftEdits.filter((edit) => edit.type === "createChild");
  const [targetKey, setTargetKey] = useState("");
  const target = pending.find((edit) => edit.draftId === targetKey);
  const [kind, setKind] = useState<PlanKind>("GOAL");
  const [name, setName] = useState("");
  const [critical, setCritical] = useState(false);
  const [parentKey, setParentKey] = useState(
    keyOf(persistedPlanRef(plan.plan_id)),
  );
  const [scheduling, setScheduling] = useState(() => schedulingForm());
  const [repetition, setRepetition] = useState(() => repetitionForm());
  const [templateKind, setTemplateKind] = useState<"TASK" | "BLOCK">("TASK");
  const [templateName, setTemplateName] = useState("");
  const [templateStart, setTemplateStart] = useState("");
  const [templateEnd, setTemplateEnd] = useState("");
  const [templateScheduling, setTemplateScheduling] = useState(() =>
    schedulingForm(),
  );
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parentOptions = [
    ...(plan.plan_kind === "GOAL"
      ? [
          {
            key: keyOf(persistedPlanRef(plan.plan_id)),
            name: plan.name + " (current plan)",
          },
        ]
      : []),
    ...pending
      .filter((edit) => edit.body.kind === "GOAL")
      .map((edit) => ({
        key: keyOf(draftPlanRef(edit.draftId)),
        name: edit.body.name + " (pending GOAL)",
      })),
  ];
  const selectedParent = parentOptions.some(
    (option) => option.key === parentKey,
  )
    ? parentKey
    : (parentOptions[0]?.key ?? "");

  const createChild = (generate = false) => {
    setError(null);
    try {
      const additions: DraftEdit[] = [];
      const queueEdit = (edit: DraftEdit) => additions.push(edit);
      if (!selectedParent) throw new Error("A GOAL parent is required");
      if (!name.trim()) throw new Error("Child name is required");
      const body: CreateChildBody = {
        kind,
        name: name.trim(),
        is_critical: critical,
      };
      if (kind === "TASK" || kind === "BLOCK")
        Object.assign(body, parseScheduling(scheduling));
      if (kind === "BLOCK") {
        if (!scheduling.blockFamily.trim())
          throw new Error("Block family is required");
        body.block_family = scheduling.blockFamily.trim();
      }
      if (kind === "REPETITION") {
        Object.assign(body, parseRepetition(repetition));
        const template = parseScheduling(templateScheduling);
        if (templateKind === "BLOCK" && !templateScheduling.blockFamily.trim())
          throw new Error("Template block family is required");
        Object.assign(body, {
          template_type: templateKind,
          template_name: templateName.trim() || name.trim() + " template",
          template_duration_minutes: template.duration_minutes,
          template_divisible: template.divisible,
          template_minimum_chunk_size_minutes:
            template.minimum_chunk_size_minutes,
          template_block_family:
            templateKind === "BLOCK"
              ? templateScheduling.blockFamily.trim()
              : undefined,
        });
      }
      const window = start || end ? parseWindow(start, end) : null;
      const templateWindow = kind === "REPETITION" && (templateStart || templateEnd) ? parseWindow(templateStart, templateEnd) : null;
      const ref = draftPlanRef("draft-" + crypto.randomUUID());
      if (ref.kind !== "draft") return;
      queueEdit({
        type: "createChild",
        draftId: ref.draftId,
        parentRef: refFromKey(selectedParent),
        body,
      });
      if (kind === "TASK" && parseFamilies(scheduling.families).length)
        queueEdit({
          type: "taskBlockFamilies",
          planRef: ref,
          families: parseFamilies(scheduling.families),
        });
      for (const prerequisite of prerequisites)
        queueEdit({
          type: "addPrerequisite",
          planRef: ref,
          prerequisitePlanRef: prerequisite.ref,
        });
      if (window)
        queueEdit({
          type: "addConstraintGroup",
          planRef: ref,
          body: { windows: [window] },
        });
      if (templateWindow) queueEdit({ type: "addConstraintGroup", planRef: templatePlanRef(ref), body: { windows: [templateWindow] } });
      if (kind === "REPETITION" && templateKind === "TASK" && parseFamilies(templateScheduling.families).length) queueEdit({ type: "taskBlockFamilies", planRef: templatePlanRef(ref), families: parseFamilies(templateScheduling.families) });
      if (generate && onGenerate) void onGenerate(ref, additions);
      else additions.forEach((edit) => enqueue(edit));
      setKind("GOAL");
      setName("");
      setCritical(false);
      setParentKey(parentOptions[0]?.key ?? "");
      setScheduling(schedulingForm());
      setRepetition(repetitionForm());
      setTemplateKind("TASK");
      setTemplateName("");
      setTemplateStart("");
      setTemplateEnd("");
      setTemplateScheduling(schedulingForm());
      setPrerequisites([]);
      setStart("");
      setEnd("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid child settings");
    }
  };
  const enqueue = queueEdit;

  return (
    <div className="edit-panel">
      <h3>Edit controls</h3>
      {pending.length > 0 && (
        <LabeledField label="Edit target">
          <select
            value={target?.draftId ?? ""}
            onChange={(event) => setTargetKey(event.target.value)}
          >
            <option value="">{plan.name} (current plan)</option>
            {pending.map((edit) => (
              <option key={edit.draftId} value={edit.draftId}>
                {edit.body.name} (pending {edit.body.kind})
              </option>
            ))}
          </select>
        </LabeledField>
      )}
      <PlanTargetEditor
        key={target?.draftId ?? plan.plan_id}
        plan={plan}
        target={target}
        draftEdits={draftEdits}
        queueEdit={queueEdit}
        onGenerate={onGenerate}
        pending={pending}
      />
      {parentOptions.length > 0 && (
        <fieldset>
          <legend>Create child</legend>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <LabeledField label="Parent">
            <select
              value={selectedParent}
              onChange={(event) => setParentKey(event.target.value)}
            >
              {parentOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Kind">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as PlanKind)}
            >
              {(["GOAL", "TASK", "BLOCK", "REPETITION"] as const).map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </LabeledField>
          <LabeledField label="Name">
            <input
              placeholder="Child name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </LabeledField>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={critical}
              onChange={(event) => setCritical(event.target.checked)}
            />
            Critical
          </label>
          {(kind === "TASK" || kind === "BLOCK") && (
            <SchedulingFields
              kind={kind}
              value={scheduling}
              onChange={setScheduling}
            />
          )}
          {kind === "REPETITION" && (
            <>
              <RepetitionFields value={repetition} onChange={setRepetition} />
              <fieldset>
                <legend>First instance template</legend>
                <LabeledField label="Template kind">
                  <select
                    value={templateKind}
                    onChange={(event) =>
                      setTemplateKind(event.target.value as "TASK" | "BLOCK")
                    }
                  >
                    <option value="TASK">TASK</option>
                    <option value="BLOCK">BLOCK</option>
                  </select>
                </LabeledField>
                <LabeledField label="Template name">
                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                  />
                </LabeledField>
                <SchedulingFields
                  kind={templateKind}
                  value={templateScheduling}
                  onChange={setTemplateScheduling}
                />
                <LabeledField label="First instance constraint start"><input type="datetime-local" value={templateStart} onChange={(event) => setTemplateStart(event.target.value)} /></LabeledField>
                <LabeledField label="First instance constraint end"><input type="datetime-local" value={templateEnd} onChange={(event) => setTemplateEnd(event.target.value)} /></LabeledField>
              </fieldset>
            </>
          )}
          <fieldset>
            <legend>Child prerequisites</legend>
            <PrerequisitePicker
              pending={pending}
              onSelect={(value) =>
                setPrerequisites((current) =>
                  current.some((item) => keyOf(item.ref) === keyOf(value.ref))
                    ? current
                    : [...current, value],
                )
              }
            />
            <ul>
              {prerequisites.map((item) => (
                <li key={keyOf(item.ref)}>
                  {item.name}
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() =>
                      setPrerequisites((current) =>
                        current.filter(
                          (value) => keyOf(value.ref) !== keyOf(item.ref),
                        ),
                      )
                    }
                  >
                    Remove prerequisite
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
          <LabeledField label={kind === "REPETITION" ? "Whole-series constraint start" : "Constraint start"}>
            <input
              type="datetime-local"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </LabeledField>
          <LabeledField label={kind === "REPETITION" ? "Whole-series constraint end" : "Constraint end"}>
            <input
              type="datetime-local"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </LabeledField>
          <button type="button" className="btn-secondary" onClick={() => createChild()}>
            Queue create child
          </button>
          {kind === "REPETITION" && onGenerate && <button type="button" className="btn-primary" onClick={() => createChild(true)}>Generate instances</button>}
        </fieldset>
      )}
    </div>
  );
}

function PlanTargetEditor({
  plan,
  target,
  draftEdits,
  queueEdit,
  pending,
  onGenerate,
}: Props & { target?: PendingChild; pending: PendingChild[] }) {
  const ref = target
    ? draftPlanRef(target.draftId)
    : persistedPlanRef(plan.plan_id);
  const kind = target?.body.kind ?? plan.plan_kind;
  const master = !target && plan.is_master;
  let initialName = target?.body.name ?? plan.name;
  let initialScheduling: BlockSchedulingBody =
    target?.body ?? plan.task_detail ?? plan.block_detail ?? {};
  let initialRepetition: UpdateRepetitionSettingsBody =
    target?.body ?? plan.repetition_detail ?? {};
  let families = target ? [] : (plan.task_detail?.allowed_block_families ?? []);
  for (const edit of draftEdits) {
    if (!("planRef" in edit) || keyOf(edit.planRef) !== keyOf(ref)) continue;
    if (edit.type === "rename") initialName = edit.name;
    if (edit.type === "taskScheduling" || edit.type === "blockScheduling")
      initialScheduling = { ...initialScheduling, ...edit.body };
    if (edit.type === "taskBlockFamilies") families = edit.families;
    if (edit.type === "repetitionSettings")
      initialRepetition = { ...initialRepetition, ...edit.body };
  }
  const [name, setName] = useState(initialName);
  const [scheduling, setScheduling] = useState(() =>
    schedulingForm(initialScheduling, families),
  );
  const [repetition, setRepetition] = useState(() =>
    repetitionForm(initialRepetition),
  );
  const [position, setPosition] = useState(String(plan.goal_sort_order ?? 0));
  const [critical, setCritical] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [repetitionDirty, setRepetitionDirty] = useState(false);
  const repetitionLocked = !target && !!plan.repetition_detail?.generated_at;
  const repetitionBody = () => {
    const body = parseRepetition(repetition);
    if (repetitionLocked) {
      delete body.repeat_mode;
      delete body.start_time;
      delete body.repeat_interval_minutes;
    }
    return body;
  };
  useGenerationForm(ref, () => {
    const edits: DraftEdit[] = [];
    if (kind !== "REPETITION") return edits;
    if (repetitionDirty) edits.push({ type: "repetitionSettings", planRef: ref, body: repetitionBody() });
    if (name.trim() !== initialName) {
      if (!name.trim()) throw new Error("Name is required");
      edits.push({ type: "rename", planRef: ref, name: name.trim() });
    }
    if (target && (start || end)) edits.push({ type: "addConstraintGroup", planRef: ref, body: { windows: [parseWindow(start, end)] } });
    return edits;
  }, () => { setRepetitionDirty(false); setStart(""); setEnd(""); });
  const queue = (build: () => DraftEdit) => {
    setError(null);
    try {
      queueEdit(build());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid edit");
    }
  };
  return (
    <>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <fieldset>
        <legend>Rename</legend>
        <LabeledField label="Name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </LabeledField>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            queue(() => {
              if (!name.trim()) throw new Error("Name is required");
              return { type: "rename", planRef: ref, name: name.trim() };
            })
          }
        >
          Queue rename
        </button>
      </fieldset>
      {!master && (
        <fieldset>
          <legend>Move</legend>
          <LabeledField label="Position">
            <input
              type="text"
              inputMode="numeric"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="Critical">
            <select
              value={critical}
              onChange={(event) => setCritical(event.target.value)}
            >
              <option value="">Unchanged</option>
              <option value="true">Critical</option>
              <option value="false">Non-critical</option>
            </select>
          </LabeledField>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queue(() => ({
                type: "move",
                planRef: ref,
                position: parseNumericInput(position, "Position"),
                isCritical: critical ? critical === "true" : undefined,
              }))
            }
          >
            Queue move
          </button>
        </fieldset>
      )}
      {!master && (
        <fieldset>
          <legend>Add prerequisite</legend>
          <PrerequisitePicker
            pending={pending.filter((item) => item.draftId !== target?.draftId)}
            onSelect={(value) =>
              queueEdit({
                type: "addPrerequisite",
                planRef: ref,
                prerequisitePlanRef: value.ref,
              })
            }
          />
        </fieldset>
      )}
      {(kind === "TASK" || kind === "BLOCK") && (
        <fieldset>
          <legend>
            {kind === "TASK" ? "Task scheduling" : "Block scheduling"}
          </legend>
          <SchedulingFields
            kind={kind}
            value={scheduling}
            onChange={setScheduling}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queue(() => {
                const body = parseScheduling(scheduling);
                if (kind === "BLOCK") {
                  if (!scheduling.blockFamily.trim())
                    throw new Error("Block family is required");
                  return {
                    type: "blockScheduling",
                    planRef: ref,
                    body: {
                      ...body,
                      block_family: scheduling.blockFamily.trim(),
                    },
                  };
                }
                return { type: "taskScheduling", planRef: ref, body };
              })
            }
          >
            {kind === "TASK"
              ? "Queue task scheduling"
              : "Queue block scheduling"}
          </button>
          {kind === "TASK" && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                queueEdit({
                  type: "taskBlockFamilies",
                  planRef: ref,
                  families: parseFamilies(scheduling.families),
                })
              }
            >
              Queue block families
            </button>
          )}
          {!target && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                queueEdit({
                  type:
                    kind === "TASK"
                      ? plan.task_detail?.user_completed
                        ? "taskReopen"
                        : "taskComplete"
                      : plan.block_detail?.user_completed
                        ? "blockReopen"
                        : "blockComplete",
                  planRef: ref,
                })
              }
            >
              Queue{" "}
              {plan.task_detail?.user_completed ||
              plan.block_detail?.user_completed
                ? "reopen"
                : "complete"}{" "}
              {kind.toLowerCase()}
            </button>
          )}
        </fieldset>
      )}
      {kind === "REPETITION" && (
        <><fieldset>
          <legend>Repetition settings</legend>
          <RepetitionFields value={repetition} locked={repetitionLocked} onChange={(value) => { setRepetition(value); setRepetitionDirty(true); }} />
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queue(() => ({
                type: "repetitionSettings",
                planRef: ref,
                body: repetitionBody(),
              }))
            }
          >
            Queue repetition settings
          </button>
        </fieldset>
        <TemplateEditor ownerRef={ref} ownerPlan={plan} pendingOwner={target} draftEdits={draftEdits} queueEdit={queueEdit} />
        {target && onGenerate && <button type="button" className="btn-primary" onClick={() => void onGenerate(ref)}>Generate instances</button>}
        </>
      )}
      {target && (
        <fieldset>
          <legend>{kind === "REPETITION" ? "Whole-series time constraint" : "Pending plan time constraint"}</legend>
          <LabeledField label="Pending constraint start">
            <input
              type="datetime-local"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="Pending constraint end">
            <input
              type="datetime-local"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </LabeledField>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              queue(() => ({
                type: "addConstraintGroup",
                planRef: ref,
                body: { windows: [parseWindow(start, end)] },
              }))
            }
          >
            Queue pending constraint
          </button>
        </fieldset>
      )}
    </>
  );
}

function TemplateEditor({ ownerRef, ownerPlan, pendingOwner, draftEdits, queueEdit }: {
  ownerRef: PlanRef; ownerPlan: PlanDetailDTO; pendingOwner?: PendingChild;
  draftEdits: DraftEdit[]; queueEdit: (edit: DraftEdit) => void;
}) {
  const templateRef = templatePlanRef(ownerRef);
  const [detail, setDetail] = useState<PlanDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const body = pendingOwner?.body;
  const [scheduling, setScheduling] = useState(() => schedulingForm({
    duration_minutes: body?.template_duration_minutes,
    divisible: body?.template_divisible,
    minimum_chunk_size_minutes: body?.template_minimum_chunk_size_minutes,
    block_family: body?.template_block_family,
  }));
  const [reload, setReload] = useState(0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (pendingOwner || !ownerPlan.repetition_detail) return;
    let active = true;
    void getPlanDetail(ownerPlan.repetition_detail.template_root_id).then((plan) => {
      if (!active) return;
      setDetail(plan);
      setScheduling(schedulingForm(plan.task_detail ?? plan.block_detail ?? {}, plan.task_detail?.allowed_block_families));
      setError(null);
    }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Template unavailable"); });
    return () => { active = false; };
  }, [pendingOwner, ownerPlan.repetition_detail?.template_root_id, reload]);
  const kind = pendingOwner?.body.template_type ?? detail?.plan_kind;
  const templateEdits = (): DraftEdit[] => {
    if (kind !== "TASK" && kind !== "BLOCK") return [];
    const parsed = parseScheduling(scheduling);
    if (kind === "BLOCK" && !scheduling.blockFamily.trim()) throw new Error("Block family is required");
    return kind === "TASK" ? [
      { type: "taskScheduling", planRef: templateRef, body: parsed },
      { type: "taskBlockFamilies", planRef: templateRef, families: parseFamilies(scheduling.families) },
    ] : [{ type: "blockScheduling", planRef: templateRef, body: { ...parsed, block_family: scheduling.blockFamily.trim() } }];
  };
  useGenerationForm(templateRef, () => dirty ? templateEdits() : [], () => setDirty(false));
  const templatePlan: PlanDetailDTO = detail ?? {
    ...ownerPlan, plan_id: "pending-template", plan_kind: kind ?? "TASK", is_master: false,
    repetition_detail: null, time_constraint_groups: [],
  };
  return <fieldset><legend>First instance template</legend>
    {error && <p role="alert" className="error-text">{error} <button type="button" onClick={() => setReload((value) => value + 1)}>Reload template</button></p>}
    {(kind === "TASK" || kind === "BLOCK") && <>
      <SchedulingFields kind={kind} value={scheduling} onChange={(value) => { setScheduling(value); setDirty(true); }} />
      <button type="button" className="btn-secondary" onClick={() => {
        try {
          templateEdits().forEach((edit) => queueEdit(edit));
          setDirty(false);
          setError(null);
        } catch (err) { setError(err instanceof Error ? err.message : "Invalid template"); }
      }}>Queue template scheduling</button>
    </>}
    {(pendingOwner || detail) && <PlanConstraintsPanel plan={templatePlan} targetRef={templateRef} title="First instance time constraints" editMode draftEdits={draftEdits} queueEdit={queueEdit} />}
  </fieldset>;
}
