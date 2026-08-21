export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);

  if (minutes < 1) return diffMs >= 0 ? "just now" : "in a moment";
  if (minutes < 60)
    return diffMs >= 0 ? `${minutes} min ago` : `in ${minutes} min`;
  if (hours < 24) return diffMs >= 0 ? `${hours} hr ago` : `in ${hours} hr`;
  return diffMs >= 0 ? `${days} day(s) ago` : `in ${days} day(s)`;
}

export function formatDurationMinutes(
  startIso: string,
  endIso: string,
): string {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function formatCountdown(endIso: string, now = Date.now()): string {
  const remainingMs = new Date(endIso).getTime() - now;
  if (remainingMs <= 0) return "0:00";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isPast(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}

export function truncateId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}
