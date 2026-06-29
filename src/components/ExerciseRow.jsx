import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import SetRow from './SetRow'
import PRBadge from './PRBadge'
import { calc1RM, useExerciseAllTimeBest, usePreviousSets } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'

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
  // ── Planned-rows / completion ──
  completedSetIds,            // Set<string>
  onToggleSetDone,            // (setId, nextDone) => void
  isExerciseFinished = false,
  onToggleFinish,             // (workoutExerciseId, nextFinished) => void
  onShowHistory,              // (exercise) => void   [optional]
  onMove,                     // (workoutExerciseId, 'up' | 'down') => void  [optional]
  canMoveUp = false,
  canMoveDown = false,
  readOnly = false,
}) {
  const { user } = useAuth()
  const storageKey = `raw_ex_expanded_${workoutExercise.id}`
  // During a live workout exercises start collapsed (open the one you're on);
  // when reviewing a finished workout they default open for scanning.
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? readOnly : saved === 'true'
    } catch {
      return readOnly
    }
  })
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState(null)   // {top, right} for the portalled menu
  const menuRef = useRef(null)                    // wrapper around the ··· trigger
  const menuPanelRef = useRef(null)               // the portalled panel
  const triggerRef = useRef(null)                 // the ··· button

  // Open the menu anchored to the trigger. The panel is portalled to <body>,
  // so it escapes the card's overflow:hidden and the row's transform stacking
  // context (which would otherwise clip it or paint it under the next card).
  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setShowMenu(true)
  }
  const [showNotes, setShowNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(workoutExercise.notes || '')
  const notesRef = useRef(null)

  const exercise = workoutExercise.exercises
  const sets = workoutExercise.sets || []
  const unit = workoutExercise.unit

  const { allTimeBestWeight } = useExerciseAllTimeBest(exercise?.id, user?.id)
  const { previousSets } = usePreviousSets(exercise?.id, workoutId, user?.id)

  // Number of rows to show: at least the saved sets, defaulting to last
  // session's set count (or 3) so a lifter sees their plan laid out and just
  // fills it in. Grows with "+ fila"; never shrinks below the saved sets.
  const [targetCount, setTargetCount] = useState(() => Math.max(sets.length, 3))
  useEffect(() => {
    if (sets.length === 0 && previousSets.length > 0) setTargetCount(previousSets.length)
  }, [previousSets.length, sets.length])
  const plannedCount = Math.max(sets.length, targetCount)

  const doneCount = useMemo(
    () => sets.reduce((n, s) => n + (completedSetIds?.has(s.id) ? 1 : 0), 0),
    [sets, completedSetIds]
  )
  const allDone = sets.length > 0 && doneCount === sets.length

  const sessionBest1RM = useMemo(() => sets.reduce((best, set) => {
    const rm = calc1RM(set.weight, set.reps)
    return rm > best ? rm : best
  }, 0), [sets])

  // PR detection — banner when this session beats the all-time best
  const isNewPR = !readOnly && sets.length > 0 && allTimeBestWeight > 0 && sessionBest1RM > allTimeBestWeight
  const prevPR = useRef(false)
  const [showPRBanner, setShowPRBanner] = useState(false)

  useEffect(() => {
    if (!showMenu) return
    const handler = (e) => {
      const inTrigger = menuRef.current?.contains(e.target)
      const inPanel = menuPanelRef.current?.contains(e.target)
      if (!inTrigger && !inPanel) setShowMenu(false)
    }
    // The menu is anchored on open; close it if the page scrolls or resizes
    // rather than chase the trigger's moving position.
    const close = () => setShowMenu(false)
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [showMenu])

  useEffect(() => {
    if (isNewPR && !prevPR.current) {
      setShowPRBanner(true)
      try { navigator.vibrate?.([100, 50, 100, 50, 200]) } catch {}
    }
    prevPR.current = isNewPR
  }, [isNewPR])

  // Save a row: update the saved set in this slot, or create it. When markDone,
  // flag it complete (which triggers the rest pill upstream). A per-slot
  // in-flight map dedupes concurrent creates so a slot can't insert twice.
  const creating = useRef(new Map())
  const saveRow = async (setNumber, reps, weight, markDone) => {
    const existing = sets[setNumber - 1]
    let id = existing?.id
    if (existing) {
      await onUpdateSet(existing.id, { reps: parseInt(reps, 10) || 0, weight: parseFloat(weight) || 0 })
    } else if (creating.current.has(setNumber)) {
      const created = await creating.current.get(setNumber)
      id = created?.id
    } else {
      const p = onAddSet(workoutExercise.id, reps, weight, setNumber)
      creating.current.set(setNumber, p)
      try { id = (await p)?.id }
      finally { creating.current.delete(setNumber) }
    }
    if (markDone && id) onToggleSetDone(id, true)
  }

  const removeRow = async (setNumber, setId) => {
    if (setId) {
      if (completedSetIds?.has(setId)) onToggleSetDone(setId, false)
      await onDeleteSet(setId)
    } else {
      setTargetCount(c => Math.max(sets.length, c - 1))
    }
  }

  const toggleExpand = () => setExpanded(e => {
    const next = !e
    try { localStorage.setItem(storageKey, String(next)) } catch {}
    return next
  })

  /* ── Finished (collapsed recap) ─────────────────────────────────────── */
  if (isExerciseFinished && !readOnly) {
    return (
      <div style={{ ...cardStyle(false), opacity: 0.92, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px' }}>
          <span style={{
            flexShrink: 0, width: '24px', height: '24px', borderRadius: '999px',
            background: 'var(--c-success)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {exercise?.name}
            </p>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>
              {sets.length} {sets.length === 1 ? 'serie' : 'series'}
              {sessionBest1RM > 0 && <> · mejor <span style={{ color: 'var(--c-data)', fontWeight: 800 }}>~{sessionBest1RM}</span> 1RM</>}
            </p>
          </div>
          <button
            onClick={() => onToggleFinish?.(workoutExercise.id, false)}
            style={{
              flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)',
              border: '1px solid var(--c-border-subtle)', borderRadius: '8px', padding: '8px 10px',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Reabrir
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* PR celebration banner */}
      {showPRBanner && (
        <div
          className="pr-badge-enter"
          style={{
            position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'var(--c-record)', color: 'var(--c-record-ink)',
            fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '4px 12px', borderRadius: '999px', whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(0,0,0,0.16)', cursor: 'pointer',
          }}
          onClick={() => setShowPRBanner(false)}
        >
          🏆 Nuevo récord personal
        </div>
      )}

      <div style={{ ...cardStyle(isNewPR), marginBottom: '10px', overflow: 'hidden' }}>
        {/* Exercise header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: '10px' }}>
          <button
            onClick={toggleExpand}
            aria-label="Mostrar series"
            aria-expanded={expanded}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', minWidth: 0 }}
          >
            <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {exercise?.name}
            </span>

            {sets.length > 0 ? (
              <span style={{
                flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.04em', color: allDone ? 'var(--c-success)' : 'var(--c-text-dim)',
              }}>
                {doneCount}/{sets.length}
              </span>
            ) : (
              <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--c-text-ghost)' }}>
                nuevo
              </span>
            )}

            {isNewPR && <PRBadge small />}

            <span className={`chevron ${expanded ? 'open' : ''}`} style={{ marginLeft: 'auto', color: 'var(--c-text-ghost)', fontSize: '10px', flexShrink: 0 }}>▼</span>
          </button>

          {/* Unit toggle */}
          {readOnly ? (
            <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-border)', padding: '3px 7px', borderRadius: '6px', flexShrink: 0 }}>
              {unit}
            </span>
          ) : (
            <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--c-border)', borderRadius: '6px', overflow: 'hidden' }}>
              {['lb', 'kg'].map(u => (
                <button
                  key={u}
                  onClick={() => { if (unit !== u) onUpdateUnit(workoutExercise.id, u) }}
                  aria-pressed={unit === u}
                  style={{
                    padding: '3px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
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

          {/* ··· menu */}
          {!readOnly && (
            <div ref={menuRef} style={{ flexShrink: 0 }}>
              <button
                ref={triggerRef}
                onClick={() => (showMenu ? setShowMenu(false) : openMenu())}
                aria-label="Opciones"
                aria-haspopup="menu"
                aria-expanded={showMenu}
                style={{
                  color: showMenu ? 'var(--c-text)' : 'var(--c-text-ghost)', fontSize: '18px', lineHeight: 1,
                  padding: '4px 6px', borderRadius: '6px', background: showMenu ? 'var(--c-surface-2)' : 'transparent',
                  transition: 'color 120ms, background 120ms', letterSpacing: '0.05em',
                }}
              >
                ···
              </button>

              {showMenu && menuPos && createPortal(
                <div
                  ref={menuPanelRef}
                  role="menu"
                  className="fade-in"
                  style={{
                    position: 'fixed', top: `${menuPos.top}px`, right: `${menuPos.right}px`, zIndex: 90,
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: '184px', overflow: 'hidden',
                  }}
                >
                  {onShowHistory && (
                    <MenuItem onClick={() => { onShowHistory(exercise); setShowMenu(false) }}>
                      Ver historial
                    </MenuItem>
                  )}
                  {onMove && canMoveUp && (
                    <MenuItem onClick={() => { onMove(workoutExercise.id, 'up'); setShowMenu(false) }}>
                      Mover arriba
                    </MenuItem>
                  )}
                  {onMove && canMoveDown && (
                    <MenuItem onClick={() => { onMove(workoutExercise.id, 'down'); setShowMenu(false) }}>
                      Mover abajo
                    </MenuItem>
                  )}
                  {onUpdateNotes && (
                    <MenuItem
                      color={notesValue ? 'var(--c-action-text)' : 'var(--c-text)'}
                      onClick={() => { setShowNotes(n => !n); setTimeout(() => notesRef.current?.focus(), 80); setShowMenu(false) }}
                    >
                      {notesValue ? 'Ver nota' : 'Agregar nota'}
                    </MenuItem>
                  )}
                  {onSwapExercise && (
                    <MenuItem onClick={() => { onSwapExercise(workoutExercise.id); setShowMenu(false) }}>
                      Cambiar ejercicio
                    </MenuItem>
                  )}
                  <MenuItem color="var(--c-action-text)" onClick={() => { onRemoveExercise(workoutExercise.id); setShowMenu(false) }}>
                    Eliminar ejercicio
                  </MenuItem>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>

        {/* Sets — animated expand/collapse */}
        <div className={`exercise-sets-wrapper ${expanded ? '' : 'collapsed'}`}>
          <div className="exercise-sets-inner">
            <div style={{ padding: '0 14px 6px' }}>
              {Array.from({ length: plannedCount }).map((_, i) => {
                const set = sets[i] || null
                return (
                  <SetRow
                    key={set?.id ?? `slot-${i}`}
                    set={set}
                    setNumber={i + 1}
                    unit={unit}
                    allTimeBest1RM={allTimeBestWeight}
                    previousSet={previousSets[i] || null}
                    done={set ? !!completedSetIds?.has(set.id) : false}
                    onSave={saveRow}
                    onToggleDone={onToggleSetDone}
                    onRemove={removeRow}
                    readOnly={readOnly}
                  />
                )
              })}
            </div>

            {!readOnly && (
              <div style={{ display: 'flex', gap: '8px', padding: '4px 14px 12px' }}>
                <button
                  onClick={() => setTargetCount(c => c + 1)}
                  style={ghostBtn}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-subtle)'; e.currentTarget.style.color = 'var(--c-text-dim)' }}
                >
                  + Serie
                </button>
                {sets.length > 0 && (
                  <button
                    onClick={() => onToggleFinish?.(workoutExercise.id, true)}
                    style={{
                      ...ghostBtn,
                      color: allDone ? '#fff' : 'var(--c-text-dim)',
                      background: allDone ? 'var(--c-success)' : 'transparent',
                      borderColor: allDone ? 'var(--c-success)' : 'var(--c-border-subtle)',
                    }}
                    onMouseEnter={e => { if (!allDone) { e.currentTarget.style.borderColor = 'var(--c-success)'; e.currentTarget.style.color = 'var(--c-success)' } }}
                    onMouseLeave={e => { if (!allDone) { e.currentTarget.style.borderColor = 'var(--c-border-subtle)'; e.currentTarget.style.color = 'var(--c-text-dim)' } }}
                  >
                    ✓ Finalizar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {(showNotes || notesValue) && (
          <div style={{ padding: '0 14px 12px', borderTop: showNotes ? '1px solid var(--c-border-subtle)' : 'none' }}>
            {showNotes ? (
              <textarea
                ref={notesRef}
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                onBlur={() => { onUpdateNotes?.(workoutExercise.id, notesValue.trim()); if (!notesValue.trim()) setShowNotes(false) }}
                placeholder="Nota sobre este ejercicio..."
                rows={2}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: 'var(--c-text)', fontSize: '13px', lineHeight: 1.5, marginTop: '10px', fontFamily: 'inherit' }}
              />
            ) : notesValue ? (
              <p onClick={() => setShowNotes(true)} style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.5, marginTop: '8px', cursor: 'text', fontStyle: 'italic' }}>
                {notesValue}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Bits ────────────────────────────────────────────────────────────── */
function MenuItem({ children, onClick, color = 'var(--c-text)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
        fontSize: '12px', fontWeight: 700, color,
        borderTop: '1px solid var(--c-border-subtle)', transition: 'background 100ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}

const cardStyle = (accent) => ({
  background: 'var(--c-surface)',
  border: `1px solid ${accent ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
  borderRadius: '16px',
  transition: 'border-color 400ms var(--ease-out)',
})

const ghostBtn = {
  flex: 1,
  padding: '11px',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--c-text-dim)',
  border: '1px dashed var(--c-border-subtle)',
  borderRadius: '10px',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out), background 150ms var(--ease-out)',
}
