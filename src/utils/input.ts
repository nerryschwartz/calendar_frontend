export function parseNumericInput(
  value: string,
  label: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const text = value.trim();
  const integer = options.integer ?? true;
  if (!(integer ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/).test(text)) {
    throw new Error(
      `${label} must be a valid ${integer ? "whole number" : "number"}`,
    );
  }
  const result = Number(text);
  if (
    !Number.isFinite(result) ||
    (integer && !Number.isSafeInteger(result)) ||
    result < (options.min ?? 0) ||
    result > (options.max ?? Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(`${label} is outside the allowed range`);
  }
  return result;
}

export function parseFamilies(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}
