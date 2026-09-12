import { durationUnits, type DurationParts } from "../utils/duration";
import LabeledField from "./LabeledField";

export default function DurationFields({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: DurationParts;
  onChange: (value: DurationParts) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="settings-fieldset" disabled={disabled}>
      <legend>{label}</legend>
      {durationUnits.map((unit) => (
        <LabeledField key={unit} label={unit[0].toUpperCase() + unit.slice(1)}>
          <input
            type="text"
            inputMode="numeric"
            value={value[unit]}
            onChange={(event) =>
              onChange({ ...value, [unit]: event.target.value })
            }
          />
        </LabeledField>
      ))}
    </fieldset>
  );
}
