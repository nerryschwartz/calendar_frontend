import type { CalendarDuration } from "../api/types";
import { parseNumericInput } from "./input";

export const durationUnits = [
  "years",
  "months",
  "days",
  "hours",
  "minutes",
] as const;
export type DurationParts = Record<(typeof durationUnits)[number], string>;
const multipliers = [525600, 43200, 1440, 60, 1];

export function durationForm(value: CalendarDuration): DurationParts {
  return Object.fromEntries(
    durationUnits.map((unit) => [unit, String(value[unit])]),
  ) as DurationParts;
}

export function splitDuration(minutes: number): DurationParts {
  let remaining = minutes;
  return Object.fromEntries(
    durationUnits.map((unit, index) => {
      const value = Math.floor(remaining / multipliers[index]);
      remaining -= value * multipliers[index];
      return [unit, String(value)];
    }),
  ) as DurationParts;
}

export function parseDuration(parts: DurationParts): CalendarDuration {
  const result = Object.fromEntries(
    durationUnits.map((unit) => [
      unit,
      parseNumericInput(parts[unit], unit[0].toUpperCase() + unit.slice(1)),
    ]),
  ) as unknown as CalendarDuration;
  if (!durationUnits.some((unit) => result[unit] > 0))
    throw new Error("Duration must be greater than zero");
  return result;
}

export function durationMinutes(parts: DurationParts): number {
  const value = parseDuration(parts);
  const minutes = durationUnits.reduce(
    (sum, unit, index) => sum + value[unit] * multipliers[index],
    0,
  );
  if (!Number.isSafeInteger(minutes))
    throw new Error("Duration is outside the allowed range");
  return minutes;
}
