import { describe, expect, it } from "vitest";
import { parseNumericInput } from "./input";
import { normalizeTimezone, timezoneLabel } from "./timezones";

describe("numeric text input", () => {
  it.each(["", " ", "1e3", "NaN", "Infinity", "-1", "1.2", "9007199254740992"])(
    "rejects invalid integers: %s",
    (value) => {
      expect(() => parseNumericInput(value, "Count")).toThrow();
    },
  );
  it("accepts decimals and rejects invalid ranges", () => {
    expect(
      parseNumericInput(".25", "Fraction", { integer: false, max: 1 }),
    ).toBe(0.25);
    expect(() => parseNumericInput("2", "Fraction", { max: 1 })).toThrow();
  });
  it("normalizes legacy abbreviations and reflects DST", () => {
    expect(normalizeTimezone("EDT")).toBe("America/New_York");
    expect(
      timezoneLabel("America/New_York", new Date("2026-07-01T12:00:00Z")),
    ).toContain("UTC-04:00");
    expect(
      timezoneLabel("America/New_York", new Date("2026-01-01T12:00:00Z")),
    ).toContain("UTC-05:00");
  });
});
