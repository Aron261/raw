import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_POP, FADE } from '../lib/motion'
import SetRow from './SetRow'
import PRBadge from './PRBadge'
import { calc1RM, useExerciseAllTimeBest, usePreviousSets } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { useExerciseLang } from '../hooks/useExerciseLang'
import { UnitToggle, Sheet } from './ui'
import ExerciseGif from './ExerciseGif'
import { useLang } from '../hooks/useLang'
import { pressable, PRESS_TRANSITION, clampLines } from '../lib/ui'

// Rest between sets: the routine's prescription wins, then the lifter's own
// per-exercise choice (localStorage — a device preference, not history), then 90s.
const REST_PRESETS = [60, 90, 120, 180, 240]
const DEFAULT_REST = 90
const fmtRest = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

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
  onRestStart,                // (seconds) => void — start the rest pill  [optional]
  autoExpandToken = null,     // bump to auto-open this row (next-up after a finish)
  onMove,                     // (workoutExerciseId, 'up' | 'down') => void  [optional]
  canMoveUp = false,
  canMoveDown = false,
  readOnly = false,
  // Modo baraja: la fila es la única carta en pantalla, así que no se pliega
  // (no hay nada que ganar plegándola) y pierde el galón y el resumen
  // colapsado del ejercicio terminado — de eso se encarga el contenedor.
  deck = false,
}) {
  const { user } = useAuth()
  const { t } = useLang()
  const reduce = useReducedMotion()
  const { label: exLabel } = useExerciseLang()
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
  const [showGif, setShowGif] = useState(false)
  const [menuPos, setMenuPos] = useState(null)   // {top, right} for the portalled menu
  const menuRef = useRef(null)                    // wrapper around the ··· trigger
  const menuPanelRef = useRef(null)               // the portalled panel
  const triggerRef = useRef(null)                 // the ··· button

  // Auto-advance: when finishing the previous exercise names this one as next,
  // open it (and remember it, like a manual expand). Skip the initial mount.
  const firstAutoExpand = useRef(true)
  useEffect(() => {
    if (firstAutoExpand.current) { firstAutoExpand.current = false; return }
    if (autoExpandToken == null) return
    setExpanded(true)
    try { localStorage.setItem(storageKey, 'true') } catch {}
  }, [autoExpandToken])

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

  const lib = exercise?.library
  const hasGif = Boolean(lib?.gif_url && lib?.media_reviewed)

  const { allTimeBestWeight } = useExerciseAllTimeBest(exercise?.id, user?.id)
  const { previousSets } = usePreviousSets(exercise?.id, workoutId, user?.id)

  // The routine's prescription for this exercise, when the workout came from a
  // routine day: target_sets (count) + target_reps (text, e.g. "8-12"). Shown
  // as a guide — the lifter can still add or remove rows freely.
  const targetSets = workoutExercise.target_sets || null
  const targetReps = workoutExercise.target_reps || null

  const restKey = `raw_rest_secs_${exercise?.id}`
  const [restSecs, setRestSecs] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(restKey), 10)
      if (saved > 0) return saved
    } catch {}
    return workoutExercise.target_rest || DEFAULT_REST
  })
  // Bumping this copies last session's reps × weight into every empty slot.
  // The ghost placeholders already show those numbers; this saves retyping
  // them set after set, which is most of what logging actually is.
  const [prefillToken, setPrefillToken] = useState(0)

  const cycleRest = () => setRestSecs(s => {
    const next = REST_PRESETS[(REST_PRESETS.indexOf(s) + 1) % REST_PRESETS.length]
    try { localStorage.setItem(restKey, String(next)) } catch {}
    return next
  })

  // Number of rows to show: at least the saved sets. Before anything's logged
  // we lay out the routine's prescribed set count (so the plan appears exactly
  // as written); with no routine we fall back to last session's count, then 3.
  // Grows with "+ Serie"; never shrinks below the saved sets.
  const [targetCount, setTargetCount] = useState(() => Math.max(sets.length, targetSets || 3))
  useEffect(() => {
    if (sets.length === 0) {
      if (targetSets) setTargetCount(targetSets)
      else if (previousSets.length > 0) setTargetCount(previousSets.length)
    }
  }, [previousSets.length, sets.length, targetSets])
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
    if (markDone && id) {
      onToggleSetDone(id, true)
      onRestStart?.(restSecs)
    }
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

  // En baraja la carta está sola en pantalla: plegarla no gana espacio, solo
  // esconde lo único que hay que ver.
  const isOpen = deck || expanded

  /* ── Finished (collapsed recap) ─────────────────────────────────────── */
  if (isExerciseFinished && !readOnly && !deck) {
    return (
      <div style={{ ...cardStyle(false), opacity: 0.92, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px' }}>
          <span style={{
            flexShrink: 0, width: '24px', height: '24px', borderRadius: '999px',
            background: 'var(--c-success)', color: 'var(--c-on-success)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', ...clampLines(2) }}>
              {exLabel(exercise)}
            </p>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>
              {sets.length} {sets.length === 1 ? 'serie' : 'series'}
              {sessionBest1RM > 0 && <> · mejor <span style={{ color: 'var(--c-data)', fontWeight: 800 }}>~{sessionBest1RM}</span> 1RM</>}
            </p>
          </div>
          <button
            onClick={() => onToggleFinish?.(workoutExercise.id, false)}
            style={{
              flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
              letterSpacing: '-0.01em', color: 'var(--c-text-dim)',
              border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-xs)', padding: '8px 10px',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            {t('Reabrir')}
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
            fontSize: '10px', fontWeight: 900, letterSpacing: '-0.01em',
            padding: '4px 12px', borderRadius: '999px', whiteSpace: 'nowrap',
            boxShadow: 'var(--e-2)', cursor: 'pointer',
          }}
          onClick={() => setShowPRBanner(false)}
        >
          🏆 {t('Nuevo récord personal')}
        </div>
      )}

      <div style={{ ...cardStyle(isNewPR), marginBottom: deck ? 0 : '10px', overflow: 'hidden' }}>
        {/* Exercise header */}
        <div style={{
          display: 'flex', alignItems: deck ? 'flex-start' : 'center',
          padding: deck ? '20px 18px 14px' : '12px 14px', gap: '10px',
        }}>
          {/* En lista, la cabecera entera es el control que pliega la fila. En
              baraja no hay nada que plegar, así que deja de ser un botón: es
              un titular, y el nombre puede crecer y ocupar su línea. */}
          {(() => {
            const Meta = (
              <>
                {sets.length > 0 ? (
                  <span style={{
                    flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: deck ? '12px' : '10px', fontWeight: 700,
                    letterSpacing: '-0.01em', color: allDone ? 'var(--c-success)' : 'var(--c-text-dim)',
                  }}>
                    {doneCount}/{sets.length}
                  </span>
                ) : (
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: deck ? '12px' : '10px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-ghost)' }}>
                    {t('nuevo')}
                  </span>
                )}

                {/* Routine target — the prescribed sets × reps, shown as a guide */}
                {(targetSets || targetReps) && (
                  <span
                    title="Objetivo de tu rutina"
                    style={{
                      flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                      letterSpacing: '-0.01em', color: 'var(--c-text-dim)',
                      border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-xs)', padding: '2px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {targetSets ? `${targetSets}×` : ''}{targetReps || ''}
                  </span>
                )}

                {isNewPR && <PRBadge small />}
              </>
            )

            const Name = (
              /* Iba en 13px con nowrap + ellipsis, así que "Dumbbell Bench
                 Press" se leía "Dumbbell Bench Pr…": justo la etiqueta que hay
                 que reconocer de un vistazo entre serie y serie era la única
                 que se cortaba. Ahora envuelve y, en baraja, crece. */
              <span style={{
                color: 'var(--c-text)',
                fontSize: deck ? '23px' : '15px', fontWeight: deck ? 900 : 800,
                letterSpacing: deck ? '-0.035em' : '-0.02em',
                lineHeight: deck ? 1.1 : 1.2, minWidth: 0,
                display: '-webkit-box', WebkitLineClamp: deck ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {exLabel(exercise)}
              </span>
            )

            if (deck) {
              return (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Name}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{Meta}</div>
                </div>
              )
            }

            return (
              <button
                onClick={toggleExpand}
                aria-label={t('Mostrar series')}
                aria-expanded={expanded}
                {...pressable(0.985)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', minWidth: 0,
                  transformOrigin: 'left center', transition: PRESS_TRANSITION,
                }}
              >
                {Name}
                {Meta}
                <span className={`chevron ${expanded ? 'open' : ''}`} style={{ marginLeft: 'auto', color: 'var(--c-text-ghost)', fontSize: '10px', flexShrink: 0 }}>▼</span>
              </button>
            )
          })()}

          {/* Unit toggle — una unidad a la vez, un toque la cambia */}
          <UnitToggle
            value={unit}
            units={['kg', 'lb']}
            size="sm"
            readOnly={readOnly}
            onChange={u => onUpdateUnit(workoutExercise.id, u)}
          />

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
                  padding: '4px 6px', borderRadius: 'var(--r-xs)', background: showMenu ? 'var(--c-surface-2)' : 'transparent',
                  transition: 'color 120ms, background 120ms', letterSpacing: '-0.01em',
                }}
              >
                ···
              </button>

              {showMenu && menuPos && createPortal(
                <motion.div
                  ref={menuPanelRef}
                  role="menu"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  transition={reduce ? FADE : SPRING_POP}
                  style={{
                    position: 'fixed', top: `${menuPos.top}px`, right: `${menuPos.right}px`, zIndex: 90,
                    transformOrigin: 'top right',
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)',
                    boxShadow: 'var(--e-3)', minWidth: '184px', overflow: 'hidden',
                  }}
                >
                  {previousSets.length > 0 && (
                    <MenuItem onClick={() => { setPrefillToken(t => t + 1); setExpanded(true); setShowMenu(false) }}>
                      {t('Repetir la vez pasada')}
                    </MenuItem>
                  )}
                  {onShowHistory && (
                    <MenuItem onClick={() => { onShowHistory(exercise); setShowMenu(false) }}>
                      {t('Ver historial')}
                    </MenuItem>
                  )}
                  {/* Bajo petición, no incrustado en la fila: durante la serie
                      lo que hace falta es el número, y una animación en bucle
                      al lado se lo come. Aquí no cuesta nada mientras no se
                      abra, que es casi siempre. */}
                  {hasGif && (
                    <MenuItem onClick={() => { setShowGif(true); setShowMenu(false) }}>
                      {t('Cómo se hace')}
                    </MenuItem>
                  )}
                  {/* Cycles presets in place — the menu stays open so the
                      lifter can tap through to the duration they want. */}
                  {onRestStart && (
                    <MenuItem onClick={cycleRest}>{t('Descanso ·')}<span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--c-data)' }}>{fmtRest(restSecs)}</span>
                    </MenuItem>
                  )}
                  {onMove && canMoveUp && (
                    <MenuItem onClick={() => { onMove(workoutExercise.id, 'up'); setShowMenu(false) }}>
                      {t('Mover arriba')}
                    </MenuItem>
                  )}
                  {onMove && canMoveDown && (
                    <MenuItem onClick={() => { onMove(workoutExercise.id, 'down'); setShowMenu(false) }}>
                      {t('Mover abajo')}
                    </MenuItem>
                  )}
                  {onUpdateNotes && (
                    <MenuItem
                      color={notesValue ? 'var(--c-action-text)' : 'var(--c-text)'}
                      onClick={() => { setShowNotes(n => !n); setTimeout(() => notesRef.current?.focus(), 80); setShowMenu(false) }}
                    >
                      {t(notesValue ? 'Ver nota' : 'Agregar nota')}
                    </MenuItem>
                  )}
                  {onSwapExercise && (
                    <MenuItem onClick={() => { onSwapExercise(workoutExercise.id); setShowMenu(false) }}>
                      {t('Cambiar ejercicio')}
                    </MenuItem>
                  )}
                  <MenuItem color="var(--c-action-text)" onClick={() => { onRemoveExercise(workoutExercise.id); setShowMenu(false) }}>
                    {t('Eliminar ejercicio')}
                  </MenuItem>
                </motion.div>,
                document.body
              )}
            </div>
          )}
        </div>

        {/* Sets — animated expand/collapse */}
        <div className={`exercise-sets-wrapper ${isOpen ? '' : 'collapsed'}`}>
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
                    targetReps={targetReps}
                    prefillToken={prefillToken}
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
                  + {t('Serie')}
                </button>
                {sets.length > 0 && (
                  <button
                    onClick={() => onToggleFinish?.(workoutExercise.id, true)}
                    style={{
                      ...ghostBtn,
                      color: allDone ? 'var(--c-on-success)' : 'var(--c-text-dim)',
                      background: allDone ? 'var(--c-success)' : 'transparent',
                      borderColor: allDone ? 'var(--c-success)' : 'var(--c-border-subtle)',
                    }}
                    onMouseEnter={e => { if (!allDone) { e.currentTarget.style.borderColor = 'var(--c-success)'; e.currentTarget.style.color = 'var(--c-success)' } }}
                    onMouseLeave={e => { if (!allDone) { e.currentTarget.style.borderColor = 'var(--c-border-subtle)'; e.currentTarget.style.color = 'var(--c-text-dim)' } }}
                  >
                    ✓ {t('Finalizar')}
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

      {showGif && (
        <Sheet title={exLabel(exercise)} onClose={() => setShowGif(false)}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
            <ExerciseGif exercise={exercise} size={264} rounded={14} />
          </div>
        </Sheet>
      )}
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

// Cada ejercicio es una superficie propia apoyada en el hueso. El que acaba
// de dar un récord sube un paso de elevación además de teñir el borde: la
// señal se ve de reojo sin depender solo del color.
const cardStyle = (accent) => ({
  background: 'var(--c-surface)',
  border: `1px solid ${accent ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
  borderRadius: 'var(--r-xl)',
  boxShadow: accent ? 'var(--e-2)' : 'var(--e-1)',
  transition: 'border-color 400ms var(--ease-out), box-shadow 400ms var(--ease-out)',
})

const ghostBtn = {
  flex: 1,
  padding: '11px',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '-0.01em',
  color: 'var(--c-text-dim)',
  border: '1px dashed var(--c-border-subtle)',
  borderRadius: 'var(--r-sm)',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out), background 150ms var(--ease-out)',
}
