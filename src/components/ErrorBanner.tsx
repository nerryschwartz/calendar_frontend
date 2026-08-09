import {
  getAssignmentConflicts,
  type ApiErrorDetail,
  type AssignmentConflict,
} from '../api/types'

interface ErrorBannerProps {
  detail: ApiErrorDetail | null
  onDismiss?: () => void
}

export default function ErrorBanner({ detail, onDismiss }: ErrorBannerProps) {
  if (!detail) return null

  const conflicts = getAssignmentConflicts(detail)

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-header">
        <strong>Errors</strong>
        {onDismiss && (
          <button type="button" className="btn-text" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
      <ul>
        {detail.errors.map((error, index) => (
          <li key={`${error.code}-${index}`}>
            <code>{error.code}</code> — {error.message}
          </li>
        ))}
      </ul>
      {conflicts.length > 0 && (
        <div className="conflicts">
          <strong>Assignment conflicts</strong>
          <ul>
            {conflicts.map((conflict, index) => (
              <ConflictItem key={index} conflict={conflict} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConflictItem({ conflict }: { conflict: AssignmentConflict }) {
  return (
    <li>
      {conflict.explanation || 'Scheduling conflict'}
      {conflict.conflicting_plan_ids.length > 0 && (
        <span className="muted">
          {' '}
          (plans: {conflict.conflicting_plan_ids.join(', ')})
        </span>
      )}
    </li>
  )
}
