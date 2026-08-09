import { useCallback, useEffect, useState } from 'react'
import { getBlockCalendar, refreshSchedule } from '../api/schedule'
import { isApiError, type ApiErrorDetail, type BlockCalendarEntryDTO } from '../api/types'
import ErrorBanner from '../components/ErrorBanner'
import { formatDateTime } from '../utils/format'

export default function BlockCalendarView() {
  const [entries, setEntries] = useState<BlockCalendarEntryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<ApiErrorDetail | null>(null)

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBlockCalendar()
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
        <h2>Block Calendar</h2>
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
        <p className="muted">Loading block calendar…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No block entries.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.block_calendar_entry_id}>
                <td>{entry.display_label}</td>
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
