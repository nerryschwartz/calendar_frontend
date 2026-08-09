export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function formatCountdown(endIso: string, now = Date.now()): string {
  const remainingMs = new Date(endIso).getTime() - now
  if (remainingMs <= 0) return '0:00'

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function isPast(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() <= now
}
