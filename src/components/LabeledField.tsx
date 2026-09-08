import type { ReactNode } from "react";

export default function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="labeled-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
