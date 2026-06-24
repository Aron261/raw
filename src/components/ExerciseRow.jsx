import { useState, useEffect, useRef, useMemo } from 'react'
import SetRow from './SetRow'
import PRBadge from './PRBadge'
import { calc1RM, useExerciseAllTimeBest, usePreviousSets } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { pressProps } from '../lib/ui'

export default function ExerciseRow({
  workoutExercise,
  workoutId,
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
  const storageKey = `raw_ex_expanded_${workoutExercise.id}`
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
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
  const { previousSets, previousUnit } = usePreviousSets(exercise?.id, workoutId, user?.id)

  const sessionBest1RM = useMemo(() => sets.reduce((best, set) => {
    const rm = calc1RM(set.weight, set.reps)
    return rm > best ? rm : best
  }, 0), [sets])

  // PR detection — show banner when this session beats the all-time best
  const isNewPR = !readOnly && sets.length > 0 && allTimeBestWeight > 0 && sessionBest1RM > allTimeBestWeight
  const prevPR = useRef(false)
  const [showPRBanner, setShowPRBanner] = useState(false)

  useEffect(() => {
    if (!showMenu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [showMenu])

  useEffect(() => {
    if (isNewPR && !prevPR.current) {
      setShowPRBanner(true)
      try { navigator.vibrate?.([100, 50, 100, 50, 200]) } catch {}
    }
    prevPR.current = isNewPR
  }, [isNewPR])

  // Pre-fill inputs: current session last set takes priority, else previous session last set
  useEffect(() => {
    if (sets.length > 0) {
      const last = sets[sets.length - 1]
      setNewReps(String(last.reps))
      setNewWeight(String(last.weight))
    } else if (previousSets.length > 0) {
      const last = previousSets[previousSets.length - 1]
      setNewReps(String(last.reps))
      setNewWeight(String(last.weight))
    }
  }, [sets, previousSets])

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
            color: 'var(--c-on-action)',
            fontSize: '10px', fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '4px 12px', borderRadius: '999px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px var(--c-action-border)',
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
          onClick={() => setExpanded(e => {
            const next = !e
            try { localStorage.setItem(storageKey, String(next)) } catch {}
            return next
          })}
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

        {/* Unidad — toggle directo (clic en lb/kg). Solo lectura: badge fijo. */}
        {readOnly ? (
          <span style={{
            color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            border: '1px solid var(--c-border)', padding: '3px 7px', borderRadius: '6px',
            flexShrink: 0,
          }}>
            {unit}
          </span>
        ) : (
          <div style={{
            display: 'flex', flexShrink: 0,
            border: '1px solid var(--c-border)', borderRadius: '6px', overflow: 'hidden',
          }}>
            {['lb', 'kg'].map(u => (
              <button
                key={u}
                onClick={() => { if (unit !== u) onUpdateUnit(workoutExercise.id, u) }}
                aria-pressed={unit === u}
                style={{
                  padding: '3px 8px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: unit === u ? 'var(--c-accent)' : 'transparent',
                  color: unit === u ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        {/* Menú 3 puntos — solo en modo edición */}
        {!readOnly && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowMenu(m => !m)}
              aria-label="Opciones"
              style={{
                color: showMenu ? 'var(--c-text)' : 'var(--c-text-ghost)',
                fontSize: '18px',
                lineHeight: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                background: showMenu ? 'var(--c-surface-2)' : 'transparent',
                transition: 'color 120ms, background 120ms',
                letterSpacing: '0.05em',
              }}
            >
              ···
            </button>

            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 30,
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  minWidth: '168px',
                  overflow: 'hidden',
                }}
              >
                {/* Nota */}
                {onUpdateNotes && (
                  <button
                    onClick={() => {
                      setShowNotes(n => !n)
                      setTimeout(() => notesRef.current?.focus(), 80)
                      setShowMenu(false)
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '11px 14px', fontSize: '12px', fontWeight: 700,
                      color: notesValue ? 'var(--c-accent)' : 'var(--c-text)',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {notesValue ? 'Ver nota' : 'Agregar nota'}
                  </button>
                )}

                {/* Cambiar ejercicio */}
                {onSwapExercise && (
                  <button
                    onClick={() => { onSwapExercise(workoutExercise.id); setShowMenu(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '11px 14px', fontSize: '12px', fontWeight: 700,
                      color: 'var(--c-text)',
                      borderTop: '1px solid var(--c-border-subtle)',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Cambiar ejercicio
                  </button>
                )}

                {/* Eliminar */}
                <button
                  onClick={() => { onRemoveExercise(workoutExercise.id); setShowMenu(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '11px 14px', fontSize: '12px', fontWeight: 700,
                    color: 'var(--c-accent)',
                    borderTop: '1px solid var(--c-border-subtle)',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Eliminar ejercicio
                </button>
              </div>
            )}
          </div>
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

          {/* Previous session ghost reference */}
          {!readOnly && previousSets.length > 0 && (
            <div style={{
              padding: '8px 14px 6px',
              borderTop: sets.length > 0 ? 'none' : '1px solid var(--c-border-subtle)',
            }}>
              <p style={{
                fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--c-text-ghost)',
                marginBottom: '4px',
              }}>
                Anterior
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {previousSets.map(set => (
                  <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '16px', color: 'var(--c-text-ghost)', fontSize: '10px' }}>
                      {set.set_number}
                    </span>
                    <span style={{ color: 'var(--c-text-ghost)', fontSize: '12px', fontWeight: 600 }}>
                      {set.reps} × {set.weight}
                      <span style={{ fontSize: '10px', fontWeight: 400, marginLeft: '3px' }}>
                        {previousUnit || unit}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                placeholder="Peso"
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
