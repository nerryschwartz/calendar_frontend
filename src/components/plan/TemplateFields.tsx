import type { PlanKind, TemplateCreateBody } from "../../api/types";
import LabeledField from "../LabeledField";
import RepetitionFields, {
  repetitionForm,
  parseRepetition,
  type RepetitionForm,
} from "./RepetitionFields";
import SchedulingFields, {
  schedulingForm,
  parseScheduling,
  type SchedulingForm,
} from "./SchedulingFields";

export interface TemplateForm {
  kind: PlanKind;
  name: string;
  scheduling: SchedulingForm;
  repetition: RepetitionForm;
  template?: TemplateForm;
}

export const templateForm = (): TemplateForm => ({
  kind: "TASK",
  name: "",
  scheduling: schedulingForm(),
  repetition: repetitionForm(),
});

export function parseTemplate(
  value: TemplateForm,
  ownerName: string,
): TemplateCreateBody {
  const body: TemplateCreateBody = {
    kind: value.kind,
    name: value.name.trim() || ownerName + " template",
  };
  if (value.kind === "TASK" || value.kind === "BLOCK")
    Object.assign(body, parseScheduling(value.scheduling));
  if (value.kind === "BLOCK") {
    if (!value.scheduling.blockFamily.trim())
      throw new Error("Template block family is required");
    body.block_family = value.scheduling.blockFamily.trim();
  }
  if (value.kind === "REPETITION") {
    Object.assign(body, parseRepetition(value.repetition));
    body.template = parseTemplate(value.template ?? templateForm(), body.name);
  }
  return body;
}

export default function TemplateFields({
  value,
  onChange,
}: {
  value: TemplateForm;
  onChange: (value: TemplateForm) => void;
}) {
  return (
    <fieldset>
      <legend>First instance template</legend>
      <LabeledField label="Template kind">
        <select
          value={value.kind}
          onChange={(event) =>
            onChange({
              ...value,
              kind: event.target.value as PlanKind,
              template: value.template ?? templateForm(),
            })
          }
        >
          {(["TASK", "BLOCK", "GOAL", "REPETITION"] as const).map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
      </LabeledField>
      <LabeledField label="Template name">
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </LabeledField>
      {(value.kind === "TASK" || value.kind === "BLOCK") && (
        <SchedulingFields
          minimal
          kind={value.kind}
          value={value.scheduling}
          onChange={(scheduling) => onChange({ ...value, scheduling })}
        />
      )}
      {value.kind === "REPETITION" && (
        <>
          <RepetitionFields
            value={value.repetition}
            onChange={(repetition) => onChange({ ...value, repetition })}
          />
          <TemplateFields
            value={value.template ?? templateForm()}
            onChange={(template) => onChange({ ...value, template })}
          />
        </>
      )}
    </fieldset>
  );
}
