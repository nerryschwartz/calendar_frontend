import { useCallback, useEffect, useState } from 'react'
import { getTaskCalendar, refreshSchedule } from '../api/schedule'
import { isApiError, type ApiErrorDetail, type CalendarEntryDTO } from '../api/types'
import ErrorBanner from '../components/ErrorBanner'
import { formatDateTime } from '../utils/format'

export default function CalendarsView() {
  const [entries, setEntries] = useState<CalendarEntryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<ApiErrorDetail | null>(null)

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTaskCalendar()
      setEntries(data.entries)
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await refreshSchedule()
      await loadCalendar()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.detail)
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="view">
      <div className="view-header">
        <h2>Task &amp; Free-Time Calendar</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh schedule'}
        </button>
      </div>

      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      {loading ? (
        <p className="muted">Loading calendar…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No calendar entries.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.calendar_entry_id}>
                <td>{entry.display_label}</td>
                <td>{entry.entry_type}</td>
                <td>{formatDateTime(entry.start_time)}</td>
                <td>{formatDateTime(entry.end_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
