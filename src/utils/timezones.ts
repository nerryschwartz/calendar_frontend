const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Helsinki",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
];

export function normalizeTimezone(zone: string): string {
  return /^(EST|EDT)$/i.test(zone.trim()) ? "America/New_York" : zone.trim();
}

export function timezoneOptions(selected: string): string[] {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [
    ...new Set(
      [browser, normalizeTimezone(selected), ...TIMEZONES].filter(Boolean),
    ),
  ];
}

export function timezoneLabel(zone: string, now = new Date()): string {
  try {
    const name = (timeZoneName: "short" | "longOffset") =>
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value;
    const offset = name("longOffset")?.replace("GMT", "UTC");
    return `${zone} (${name("short")}, ${offset})`;
  } catch {
    return `${zone} (unrecognized timezone)`;
  }
}
