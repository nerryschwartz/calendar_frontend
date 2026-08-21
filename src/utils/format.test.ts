import { describe, expect, it } from "vitest";

import { formatCountdown, isPast } from "./format";

describe("format utilities", () => {
  it("formats countdowns and clamps elapsed timers", () => {
    const now = new Date("2026-08-21T10:00:00.000Z").getTime();

    expect(formatCountdown("2026-08-21T10:01:05.000Z", now)).toBe("1:05");
    expect(formatCountdown("2026-08-21T11:02:03.000Z", now)).toBe("1:02:03");
    expect(formatCountdown("2026-08-21T09:59:59.000Z", now)).toBe("0:00");
  });

  it("checks past dates", () => {
    const now = new Date("2026-08-21T10:00:00.000Z").getTime();

    expect(isPast("2026-08-21T09:59:59.000Z", now)).toBe(true);
    expect(isPast("2026-08-21T10:00:01.000Z", now)).toBe(false);
  });
});
