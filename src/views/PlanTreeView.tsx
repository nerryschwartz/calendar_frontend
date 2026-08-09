import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getMasterPlan, getPlanDetail } from '../api/plans'
import type { PlanDetailDTO, PlanKind } from '../api/types'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorBanner from '../components/ErrorBanner'
import { usePlanEditMode } from '../hooks/usePlanEditMode'
import { formatDateTime } from '../utils/format'

export default function PlanTreeView() {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      if (planId) {
        const detail = await getPlanDetail(planId)
        setPlan(detail)
      } else {
        const master = await getMasterPlan()
        setPlan(master.plan)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [planId])

  const {
    editMode,
    draftEdits,
    saving,
    error,
    confirmExit,
    queueEdit,
    enterEditMode,
    requestExitEditMode,
    discardAndExit,
    saveEdits,
    setError,
  } = usePlanEditMode({ onSaved: () => void loadPlan() })

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  useEffect(() => {
    if (searchParams.get('edit') === '1' && plan && !editMode) {
      enterEditMode()
    }
  }, [searchParams, plan, editMode, enterEditMode])

  if (loading) {
    return <p className="muted">Loading plan…</p>
  }

  if (loadError || !plan) {
    return <p className="error-text">{loadError ?? 'Plan not found'}</p>
  }

  return (
    <section className="view">
      <div className="view-header">
        <div>
          <h2>{plan.name}</h2>
          <p className="muted">
            {plan.plan_kind}
            {plan.is_master && ' · master'}
          </p>
        </div>
        <div className="button-row">
          {editMode ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveEdits()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save edits'}
              </button>
              <button type="button" className="btn-secondary" onClick={requestExitEditMode}>
                Exit edit mode
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={enterEditMode}>
              Edit
            </button>
          )}
        </div>
      </div>

      {editMode && draftEdits.length > 0 && (
        <p className="draft-notice">{draftEdits.length} pending edit(s)</p>
      )}

      <ErrorBanner detail={error} onDismiss={() => setError(null)} />

      <nav className="breadcrumb">
        {plan.ancestry.map((item) => (
          <span key={item.plan_id}>
            <Link to={`/plan-tree/${item.plan_id}`}>{item.name}</Link>
            <span className="sep"> / </span>
          </span>
        ))}
        <span>{plan.name}</span>
      </nav>

      <div className="plan-details">
        <dl>
          <dt>Created</dt>
          <dd>{formatDateTime(plan.created_at)}</dd>
          <dt>Updated</dt>
          <dd>{formatDateTime(plan.updated_at)}</dd>
          {plan.goal_is_critical != null && (
            <>
              <dt>Critical</dt>
              <dd>{plan.goal_is_critical ? 'Yes' : 'No'}</dd>
            </>
          )}
        </dl>

        {plan.task_detail && (
          <div className="detail-panel">
            <h3>Task</h3>
            <p>
              Duration: {plan.task_detail.duration_minutes} min · Divisible:{' '}
              {plan.task_detail.divisible ? 'Yes' : 'No'} · Completed:{' '}
              {plan.task_detail.user_completed ? 'Yes' : 'No'}
            </p>
            {editMode && (
              <div className="button-row">
                {plan.task_detail.user_completed ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => queueEdit({ type: 'taskReopen', planId: plan.plan_id })}
                  >
                    Reopen task
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => queueEdit({ type: 'taskComplete', planId: plan.plan_id })}
                  >
                    Complete task
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {plan.block_detail && (
          <div className="detail-panel">
            <h3>Block</h3>
            <p>
              Duration: {plan.block_detail.duration_minutes} min · Family:{' '}
              {plan.block_detail.block_family} · Completed:{' '}
              {plan.block_detail.user_completed ? 'Yes' : 'No'}
            </p>
            {editMode && (
              <div className="button-row">
                {plan.block_detail.user_completed ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => queueEdit({ type: 'blockReopen', planId: plan.plan_id })}
                  >
                    Reopen block
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => queueEdit({ type: 'blockComplete', planId: plan.plan_id })}
                  >
                    Complete block
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editMode && <PlanEditControls plan={plan} queueEdit={queueEdit} />}

      <div className="detail-panel">
        <h3>Children</h3>
        {plan.children.length === 0 ? (
          <p className="muted">No children.</p>
        ) : (
          <ul className="link-list">
            {plan.children.map((child) => (
              <li key={child.plan_id}>
                <Link to={`/plan-tree/${child.plan_id}`}>
                  {child.name} ({child.plan_kind})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="detail-panel">
        <h3>Prerequisites</h3>
        {plan.prerequisites.length === 0 ? (
          <p className="muted">No prerequisites.</p>
        ) : (
          <ul className="link-list">
            {plan.prerequisites.map((prereq) => (
              <li key={prereq.prerequisite_plan_id}>
                <Link to={`/plan-tree/${prereq.prerequisite_plan_id}`}>
                  {prereq.name} ({prereq.plan_kind})
                </Link>
                {editMode && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() =>
                      queueEdit({
                        type: 'removePrerequisite',
                        planId: plan.plan_id,
                        prerequisitePlanId: prereq.prerequisite_plan_id,
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editMode && (
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            queueEdit({ type: 'delete', planId: plan.plan_id })
            if (plan.parent_id) {
              void navigate(`/plan-tree/${plan.parent_id}`)
            } else {
              void navigate('/plan-tree')
            }
          }}
        >
          Delete plan
        </button>
      )}

      <ConfirmDialog
        open={confirmExit}
        title="Unsaved edits"
        message="You have unsaved changes. Save before exiting or discard them?"
        confirmLabel="Save"
        cancelLabel="Discard"
        onConfirm={() => void saveEdits()}
        onCancel={discardAndExit}
      />
    </section>
  )
}

interface PlanEditControlsProps {
  plan: PlanDetailDTO
  queueEdit: ReturnType<typeof usePlanEditMode>['queueEdit']
}

function PlanEditControls({ plan, queueEdit }: PlanEditControlsProps) {
  const [renameValue, setRenameValue] = useState(plan.name)
  const [childKind, setChildKind] = useState<PlanKind>('GOAL')
  const [childName, setChildName] = useState('')
  const [childCritical, setChildCritical] = useState(false)
  const [childDuration, setChildDuration] = useState(30)
  const [childBlockFamily, setChildBlockFamily] = useState('default')
  const [movePosition, setMovePosition] = useState(0)
  const [prerequisiteId, setPrerequisiteId] = useState('')

  return (
    <div className="edit-panel">
      <h3>Edit controls</h3>

      <fieldset>
        <legend>Rename</legend>
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => queueEdit({ type: 'rename', planId: plan.plan_id, name: renameValue })}
        >
          Queue rename
        </button>
      </fieldset>

      <fieldset>
        <legend>Create child</legend>
        <select value={childKind} onChange={(e) => setChildKind(e.target.value as PlanKind)}>
          <option value="GOAL">GOAL</option>
          <option value="TASK">TASK</option>
          <option value="BLOCK">BLOCK</option>
        </select>
        <input
          type="text"
          placeholder="Name"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={childCritical}
            onChange={(e) => setChildCritical(e.target.checked)}
          />
          Critical
        </label>
        {(childKind === 'TASK' || childKind === 'BLOCK') && (
          <>
            <input
              type="number"
              min={1}
              value={childDuration}
              onChange={(e) => setChildDuration(Number(e.target.value))}
            />
            {childKind === 'BLOCK' && (
              <input
                type="text"
                placeholder="Block family"
                value={childBlockFamily}
                onChange={(e) => setChildBlockFamily(e.target.value)}
              />
            )}
          </>
        )}
        <button
          type="button"
          className="btn-secondary"
          disabled={!childName.trim()}
          onClick={() =>
            queueEdit({
              type: 'createChild',
              parentId: plan.plan_id,
              body: {
                kind: childKind,
                is_critical: childCritical,
                name: childName.trim(),
                duration_minutes: childKind !== 'GOAL' ? childDuration : undefined,
                divisible: childKind !== 'GOAL' ? false : undefined,
                block_family: childKind === 'BLOCK' ? childBlockFamily : undefined,
              },
            })
          }
        >
          Queue create child
        </button>
      </fieldset>

      <fieldset>
        <legend>Move</legend>
        <input
          type="number"
          min={0}
          value={movePosition}
          onChange={(e) => setMovePosition(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            queueEdit({ type: 'move', planId: plan.plan_id, position: movePosition })
          }
        >
          Queue move
        </button>
      </fieldset>

      <fieldset>
        <legend>Add prerequisite</legend>
        <input
          type="text"
          placeholder="Prerequisite plan ID"
          value={prerequisiteId}
          onChange={(e) => setPrerequisiteId(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={!prerequisiteId.trim()}
          onClick={() =>
            queueEdit({
              type: 'addPrerequisite',
              planId: plan.plan_id,
              prerequisitePlanId: prerequisiteId.trim(),
            })
          }
        >
          Queue prerequisite
        </button>
      </fieldset>
    </div>
  )
}
