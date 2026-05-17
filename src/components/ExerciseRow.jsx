import { useState, useEffect, useMemo } from 'react'
import SetRow from './SetRow'
import { calc1RM, useExerciseAllTimeBest } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { pressProps } from '../lib/ui'

export default function ExerciseRow({
  workoutExercise,
  onAddSet,
  onDeleteSet,
  onUpdateSet,
  onUpdateUnit,
  onRemoveExercise,
  readOnly = false,
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(true)
  const [newReps, setNewReps] = useState('10')
  const [newWeight, setNewWeight] = useState('135')
  const [adding, setAdding] = useState(false)

  const exercise = workoutExercise.exercises
  const sets = workoutExercise.sets || []
  const unit = workoutExercise.unit

  const { allTimeBestWeight } = useExerciseAllTimeBest(exercise?.id, user?.id)

  const sessionBest1RM = useMemo(() => sets.reduce((best, set) => {
    const rm = calc1RM(set.weight, set.reps)
    return rm > best ? rm : best
  }, 0), [sets])

  useEffect(() => {
    if (sets.length > 0) {
      const last = sets[sets.length - 1]
      setNewReps(String(last.reps))
      setNewWeight(String(last.weight))
    }
  }, [sets])

  const handleAddSet = async () => {
    if (!newReps || !newWeight) return
    setAdding(true)
    try {
      await onAddSet(workoutExercise.id, newReps, newWeight)
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '4px',
        marginBottom: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Exercise header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 14px',
          gap: '10px',
        }}
      >
        {/* Name + meta — tappable to expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          aria-label="Toggle sets"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
            transition: 'opacity 120ms',
          }}
        >
          <span
            style={{
              color: 'var(--c-text)',
              fontSize: '13px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
            }}
          >
            {exercise?.name}
          </span>

          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {sets.length} {sets.length === 1 ? 'set' : 'sets'}
          </span>

          {sessionBest1RM > 0 && (
            <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600 }}>
              · {sessionBest1RM} 1RM
            </span>
          )}

          {/* Chevron */}
          <span
            className={`chevron ${expanded ? 'open' : ''}`}
            style={{ marginLeft: 'auto', color: 'var(--c-text-ghost)', fontSize: '10px' }}
          >
            ▼
          </span>
        </button>

        {/* Unit toggle + remove */}
        {!readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => onUpdateUnit(workoutExercise.id, unit === 'lb' ? 'kg' : 'lb')}
              style={{
                color: 'var(--c-text-dim)',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                border: '1px solid var(--c-border)',
                padding: '3px 7px',
                borderRadius: '2px',
                transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
              }}
            >
              {unit}
            </button>
            <button
              onClick={() => onRemoveExercise(workoutExercise.id)}
              aria-label="Remove exercise"
              style={{
                color: 'var(--c-text-ghost)',
                fontSize: '13px',
                lineHeight: 1,
                padding: '4px',
                transition: `color 150ms var(--ease-out)`,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid var(--c-border)', padding: '3px 7px', borderRadius: '2px' }}>
            {unit}
          </span>
        )}
      </div>

      {/* Sets + add row — animated expand/collapse */}
      <div className={`exercise-sets-wrapper ${expanded ? '' : 'collapsed'}`}>
        <div className="exercise-sets-inner">
          <div style={{ padding: '0 14px', paddingBottom: readOnly ? '12px' : '0' }}>
            {sets.length === 0 && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '6px 0 12px' }}>
                No sets yet — add your first below.
              </p>
            )}

            {sets.map(set => (
              <SetRow
                key={set.id}
                set={set}
                unit={unit}
                allTimeBest1RM={allTimeBestWeight}
                onDelete={onDeleteSet}
                onUpdate={onUpdateSet}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Add set row */}
          {!readOnly && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px 12px',
                borderTop: '1px solid var(--c-surface-2)',
                background: 'var(--c-bg)',
              }}
            >
              <input
                type="number"
                value={newReps}
                onChange={e => setNewReps(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSet() }}
                className="input-field"
                style={{ width: '50px', textAlign: 'center', fontSize: '13px', fontWeight: 700, padding: '6px 4px' }}
                placeholder="Reps"
                min="1"
              />
              <span style={{ color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>×</span>
              <input
                type="number"
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSet() }}
                className="input-field"
                style={{ width: '62px', textAlign: 'center', fontSize: '13px', fontWeight: 700, padding: '6px 4px' }}
                placeholder="Weight"
                min="0"
                step="2.5"
              />
              <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>{unit}</span>

              <button
                onClick={handleAddSet}
                disabled={adding}
                style={{
                  marginLeft: 'auto',
                  background: adding ? 'var(--c-surface-2)' : 'var(--c-accent)',
                  color: 'var(--c-text)',
                  fontSize: '10px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '7px 12px',
                  borderRadius: '2px',
                  transition: `transform 160ms var(--ease-out), background 150ms var(--ease-out)`,
                  flexShrink: 0,
                  minWidth: '54px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                {...pressProps(0.95)}
              >
                {adding ? <span className="spinner" style={{ width: '12px', height: '12px', borderTopColor: 'var(--c-text)', borderColor: 'rgba(255,255,255,0.2)' }} /> : '+ Set'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
