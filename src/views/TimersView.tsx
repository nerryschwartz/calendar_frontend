import { useCallback, useEffect, useRef, useState } from 'react'
import { completeTimer, getActiveTimers } from '../api/timers'
import { isApiError, type ActiveTimerDTO, type ApiErrorDetail } from '../api/types'
import ErrorBanner from '../components/ErrorBanner'
import { formatCountdown, formatDateTime, isPast } from '../utils/format'

const POLL_INTERVAL_MS = 30_000
const TICK_INTERVAL_MS = 1_000

export default function TimersView() {
  const [timers, setTimers] = useState<ActiveTimerDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiErrorDetail | null>(null)
  const [now, setNow] = useState(Date.now())
  const completingRef = useRef<Set<string>>(new Set())

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const showCompletionNotification = useCallback((label: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer complete', { body: label })
    }
  }, [])

  const loadTimers = useCallback(async () => {
    setError(null)
    try {
      const data = await getActiveTimers()
      setTimers(data.timers)
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleComplete = useCallback(
    async (timer: ActiveTimerDTO) => {
      if (completingRef.current.has(timer.timer_key)) return
      completingRef.current.add(timer.timer_key)
      try {
        const result = await completeTimer(timer.timer_key)
        showCompletionNotification(timer.display_label)
        if (result.notification) {
          showCompletionNotification(
            `Notification queued: ${result.notification.display_label}`,
          )
        }
        await loadTimers()
      } catch (err) {
        if (isApiError(err)) {
          setError(err.detail)
        }
      } finally {
        completingRef.current.delete(timer.timer_key)
      }
    },
    [loadTimers, showCompletionNotification],
  )

  useEffect(() => {
    void requestNotificationPermission()
    void loadTimers()
    const pollId = window.setInterval(() => void loadTimers(), POLL_INTERVAL_MS)
    const tickId = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => {
      window.clearInterval(pollId)
      window.clearInterval(tickId)
    }
  }, [loadTimers, requestNotificationPermission])

  useEffect(() => {
    for (const timer of timers) {
      if (isPast(timer.window_end_at, now)) {
        void handleComplete(timer)
      }
    }
  }, [timers, now, handleComplete])

  return (
    <section className="view">
      <div className="view-header">
        <h2>Active Timers</h2>
        <button type="button" className="btn-secondary" onClick={() => void loadTimers()}>
          Reload
        </button>
      </div>

      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading ? (
        <p className="muted">Loading timers…</p>
      ) : timers.length === 0 ? (
        <p className="muted">No active timers.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Kind</th>
              <th>Ends</th>
              <th>Countdown</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {timers.map((timer) => (
              <tr key={timer.timer_key}>
                <td>{timer.display_label}</td>
                <td>{timer.source_kind}</td>
                <td>{formatDateTime(timer.window_end_at)}</td>
                <td>{formatCountdown(timer.window_end_at, now)}</td>
                <td>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void handleComplete(timer)}
                  >
                    Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
