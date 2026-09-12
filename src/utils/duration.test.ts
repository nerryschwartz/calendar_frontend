import { describe, expect, it } from "vitest";
import {
  durationForm,
  durationMinutes,
  parseDuration,
  splitDuration,
} from "./duration";
import {
  parseRepetition,
  repetitionForm,
} from "../components/plan/RepetitionFields";
describe("duration fields", () => {
  it("round-trips fixed intervals and keeps calendar parts distinct", () => {
    expect(durationMinutes(splitDuration(616565))).toBe(616565);
    expect(splitDuration(1440).days).toBe("1");
    const parts = { years: 0, months: 13, days: 4, hours: 5, minutes: 6 };
    expect(parseDuration(durationForm(parts))).toEqual(parts);
    expect(
      parseRepetition(repetitionForm({ repeat_interval_minutes: 616565 }))
        .repeat_interval_minutes,
    ).toBe(616565);
  });
  it.each(["-1", "1.2", "", "1e4", "9007199254740992"])(
    "rejects invalid duration %s",
    (years) => {
      expect(() => parseDuration({ ...splitDuration(1), years })).toThrow();
    },
  );
  it("rejects zero and unsafe combined intervals", () => {
    expect(() => parseDuration(splitDuration(0))).toThrow();
    expect(() =>
      durationMinutes({
        ...splitDuration(1),
        years: String(Number.MAX_SAFE_INTEGER),
      }),
    ).toThrow();
  });
});
