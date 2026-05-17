import { useState, useEffect, useRef, useMemo } from 'react'
import SetRow from './SetRow'
import PRBadge from './PRBadge'
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
  onSwapExercise,
  onUpdateNotes,
  readOnly = false,
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(true)
  const [newReps, setNewReps] = useState('10')
  const [newWeight, setNewWeight] = useState('135')
  const [adding, setAdding] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(workoutExercise.notes || '')
  const notesRef = useRef(null)

  const exercise = workoutExercise.exercises
  const sets = workoutExercise.sets || []
  const unit = workoutExercise.unit

  const { allTimeBestWeight } = useExerciseAllTimeBest(exercise?.id, user?.id)

  const sessionBest1RM = useMemo(() => sets.reduce((best, set) => {
    const rm = calc1RM(set.weight, set.reps)
    return rm > best ? rm : best
  }, 0), [sets])

  // PR detection — show banner when this session beats the all-time best
  const isNewPR = !readOnly && sets.length > 0 && allTimeBestWeight > 0 && sessionBest1RM > allTimeBestWeight
  const prevPR = useRef(false)
  const [showPRBanner, setShowPRBanner] = useState(false)

  useEffect(() => {
    if (isNewPR && !prevPR.current) {
      setShowPRBanner(true)
      try { navigator.vibrate?.([100, 50, 100, 50, 200]) } catch {}
    }
    prevPR.current = isNewPR
  }, [isNewPR])

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
    <div style={{ position: 'relative' }}>
      {/* PR celebration banner */}
      {showPRBanner && (
        <div
          className="pr-badge-enter"
          style={{
            position: 'absolute', top: '-10px', left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'var(--c-accent)',
            color: '#fff',
            fontSize: '10px', fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '4px 12px', borderRadius: '999px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(255,45,45,0.35)',
            cursor: 'pointer',
          }}
          onClick={() => setShowPRBanner(false)}
        >
          🏆 Nuevo récord personal
        </div>
      )}
    <div
      style={{
        background: 'var(--c-surface)',
        border: `1px solid ${isNewPR ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
        borderRadius: '16px',
        marginBottom: '10px',
        overflow: 'hidden',
        transition: 'border-color 400ms var(--ease-out)',
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

          {/* PR badge inline */}
          {isNewPR && <PRBadge small />}

          {/* Chevron */}
          <span
            className={`chevron ${expanded ? 'open' : ''}`}
            style={{ marginLeft: 'auto', color: 'var(--c-text-ghost)', fontSize: '10px' }}
          >
            ▼
          </span>
        </button>

        {/* Unit toggle + swap + remove */}
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
                borderRadius: '6px',
                transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
              }}
            >
              {unit}
            </button>

            {/* Notes toggle */}
            {onUpdateNotes && (
              <button
                onClick={() => {
                  setShowNotes(n => !n)
                  setTimeout(() => notesRef.current?.focus(), 80)
                }}
                aria-label="Nota"
                title="Agregar nota"
                style={{
                  color: notesValue ? 'var(--c-accent)' : 'var(--c-text-ghost)',
                  fontSize: '13px',
                  lineHeight: 1,
                  padding: '4px',
                  transition: `color 150ms var(--ease-out)`,
                }}
              >
                📝
              </button>
            )}

            {/* Swap exercise — only this day, routine untouched */}
            {onSwapExercise && (
              <button
                onClick={() => onSwapExercise(workoutExercise.id)}
                aria-label="Cambiar ejercicio"
                title="Cambiar ejercicio (solo hoy)"
                style={{
                  color: 'var(--c-text-ghost)',
                  fontSize: '12px',
                  lineHeight: 1,
                  padding: '4px',
                  transition: `color 150ms var(--ease-out)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)' }}
              >
                ✎
              </button>
            )}

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
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid var(--c-border)', padding: '3px 7px', borderRadius: '6px' }}>
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

      {/* Notes area — expands inline below sets */}
      {(showNotes || notesValue) && (
        <div style={{ padding: '0 14px 12px', borderTop: showNotes ? '1px solid var(--c-border-subtle)' : 'none' }}>
          {showNotes ? (
            <textarea
              ref={notesRef}
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onBlur={() => {
                onUpdateNotes?.(workoutExercise.id, notesValue.trim())
                if (!notesValue.trim()) setShowNotes(false)
              }}
              placeholder="Nota sobre este ejercicio..."
              rows={2}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--c-text)',
                fontSize: '12px',
                lineHeight: 1.5,
                marginTop: '10px',
                fontFamily: 'inherit',
              }}
            />
          ) : notesValue ? (
            <p
              onClick={() => setShowNotes(true)}
              style={{
                color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5,
                marginTop: '8px', cursor: 'text',
                fontStyle: 'italic',
              }}
            >
              {notesValue}
            </p>
          ) : null}
        </div>
      )}
    </div>
    </div>
  )
}
