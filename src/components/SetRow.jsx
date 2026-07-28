import { useState, useEffect, useMemo, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { EASE_POP_KEYFRAMES, POP_DURATION } from '../lib/motion'
import PRBadge from './PRBadge'
import { calc1RM } from '../hooks/useWorkout'
import { compareSet, formatDelta, describeDelta } from '../lib/progress'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useLang } from '../hooks/useLang'
import { pressable, PRESS_TRANSITION } from '../lib/ui'

// ── Delta contra la misma serie de la vez anterior ───────────────────────
// Azul de dato, no lima: la lima está reservada a un récord absoluto y superar
// tu serie de la semana pasada no lo es. Y quedarse corto se dice en gris, no
// en rojo: bajar el peso en una semana de descarga es el plan, no un fallo.
function SetDelta({ cmp, unit, t, locale }) {
  if (!cmp) return null
  const beat = cmp.verdict === 'beat'
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex', alignItems: 'baseline', gap: '6px',
        // Alineado bajo los inputs, no bajo el número de serie: la comparación
        // es de lo que acabas de teclear.
        padding: '0 0 6px 24px',
        marginTop: '-2px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.01em',
          color: beat ? 'var(--c-data)' : 'var(--c-text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatDelta(cmp, unit, t, locale)}
      </span>
      <span
        aria-hidden="true"
        style={{
          fontSize: '11px', fontWeight: 500,
          color: 'var(--c-text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {t('vs. la vez anterior')}
      </span>
      <span className="sr-only">{describeDelta(cmp, unit, t, locale)}</span>
    </div>
  )
}

/*
 * One planned set row. A row may be backed by a saved set (`set`) or be an
 * empty planned slot (`set == null`). Editing auto-saves on blur — there is no
 * "+ Set" button. The ✓ is the per-row commit: it saves the row (creating it if
 * needed), marks the set done, and triggers the rest pill upstream. Tapping ✓
 * again un-marks it. Inputs are ≥44px tall and 16px to keep one-handed, sweaty
 * logging fast and to stop iOS from zooming on focus.
 */
export default function SetRow({
  set,
  setNumber,
  unit,
  allTimeBest1RM,
  previousSet = null,   // { reps, weight } from the last session — shown as the ghost placeholder
  targetReps = null,    // routine's prescribed reps (e.g. "8-12") — reps hint when there's no prior set
  prefillToken = 0,     // bump to copy `previousSet` into this row's inputs
  done = false,
  readOnly = false,
  onSave,        // (setNumber, reps, weight, markDone) => Promise
  onToggleDone,  // (setId, nextDone) => void
  onRemove,      // (setNumber, setId) => void
}) {
  const [reps, setReps] = useState(set ? String(set.reps) : '')
  const [weight, setWeight] = useState(set ? String(set.weight) : '')
  const [busy, setBusy] = useState(false)
  // A save that failed (network/server). We keep the typed values, flag the row,
  // and offer a retry — nothing is lost silently. `pendingMarkDone` remembers
  // whether the failed attempt was also marking the set done, so a retry
  // reproduces the same intent.
  const [saveError, setSaveError] = useState(false)
  const pendingMarkDone = useRef(false)
  const online = useOnlineStatus()
  const { t, locale } = useLang()
  const reduce = useReducedMotion()
  // When ✓ / ✕ is the element being pressed, it steals focus from the inputs
  // and fires their onBlur. This flag tells blur to stand down so we don't
  // create the same set twice (blur + click both saving).
  const committing = useRef(false)
  // Enter walks the row: reps → weight → ✓, so a set can be logged without
  // leaving the keyboard.
  const weightRef = useRef(null)
  const checkRef = useRef(null)

  // A synchronous mirror of the current reps/weight. State drives rendering;
  // this ref drives saving — a debounced save reads it so it always sees the
  // latest values, even across rapid taps within one tick where React state
  // closures would lag a step behind. Every edit path updates both.
  const valuesRef = useRef({ reps, weight })
  const setRepsV = (v) => { valuesRef.current = { ...valuesRef.current, reps: v }; setReps(v) }
  const setWeightV = (v) => { valuesRef.current = { ...valuesRef.current, weight: v }; setWeight(v) }

  // Weight steppers: one plate's worth per tap — 2.5 kg (1.25/side) or 5 lb
  // (2.5/side), the smallest change most gyms actually stock. Faster than the
  // OS number pad for the common "same ± one plate" case; the pad stays for
  // arbitrary entry. Computes from the ref so rapid taps accumulate exactly.
  const stepBy = unit === 'lb' ? 5 : 2.5
  const bumpWeight = (delta) => {
    const next = Math.max(0, Math.round(((parseFloat(valuesRef.current.weight) || 0) + delta) * 100) / 100)
    setWeightV(String(next))
  }

  // Re-sync when the backing set changes (refetch, edit from elsewhere).
  useEffect(() => {
    setRepsV(set ? String(set.reps) : '')
    setWeightV(set ? String(set.weight) : '')
  }, [set?.id, set?.reps, set?.weight])

  // "Repetir la vez pasada": copy last session's numbers into this row. Only
  // fills empty slots — a logged set is history and is never overwritten — and
  // only fills the inputs. The lifter still commits with ✓, so nothing is
  // recorded that they didn't look at.
  const firstPrefill = useRef(true)
  useEffect(() => {
    if (firstPrefill.current) { firstPrefill.current = false; return }
    if (set || !previousSet) return
    setRepsV(String(previousSet.reps))
    setWeightV(String(previousSet.weight))
  }, [prefillToken])

  const filled = reps !== '' && weight !== ''
  // The reps box is narrow; only hint the routine target inside it when it's a
  // plain number (e.g. "10"). Ranges/text ("8-12", "Al fallo") would clip, so
  // those live only in the exercise header's target chip.
  const repsHint = previousSet
    ? String(previousSet.reps)
    : (targetReps && /^\d+$/.test(String(targetReps).trim()) ? String(targetReps).trim() : 'reps')
  const { set1RM, isPR } = useMemo(() => {
    const rm = calc1RM(parseFloat(weight) || 0, parseInt(reps, 10) || 0)
    return { set1RM: rm, isPR: rm > 0 && allTimeBest1RM > 0 && rm >= allTimeBest1RM }
  }, [weight, reps, allTimeBest1RM])

  // ¿Superaste esta misma serie la vez pasada? Solo cuando está confirmada: en
  // mitad de teclear el número aún no significa nada, y un veredicto que baila
  // mientras escribes es ruido, no información.
  const comparison = useMemo(
    () => (done ? compareSet({ reps, weight }, previousSet) : null),
    [done, reps, weight, previousSet]
  )

  // Values default to the live state (typing/✓ path) but can be passed
  // explicitly by the debounced stepper save, which reads them from valuesRef.
  const persist = async (markDone, r = reps, w = weight) => {
    if (r === '' || w === '') return
    const unchanged = set && String(set.reps) === r && String(set.weight) === w
    // A prior failure means the server never got these values — retry even if
    // they match the last-known set.
    if (unchanged && !markDone && !saveError) return
    setBusy(true)
    try {
      await onSave(setNumber, r, w, markDone)
      setSaveError(false)
      // A short tap + a spring pop confirm the set landed, on the same frame —
      // the most-repeated action in the app, so it earns real feedback.
      if (markDone) {
        try { navigator.vibrate?.(10) } catch {}
        if (checkRef.current && !reduce) {
          animate(checkRef.current, { scale: [1, 1.24, 1] }, { duration: POP_DURATION, ease: EASE_POP_KEYFRAMES })
        }
      }
    } catch (e) {
      console.error(e)
      pendingMarkDone.current = markDone
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  const retry = () => { if (!busy) persist(pendingMarkDone.current) }

  // Steppers save through this ref, not the closure live at pointer-up: a tap's
  // state hasn't flushed yet when onHoldEnd fires. The ref always points at the
  // current render's persist, and the value comes from valuesRef explicitly.
  const persistRef = useRef(persist)
  persistRef.current = persist

  // Auto-retry a failed save once we come back online.
  const wasOffline = useRef(false)
  useEffect(() => {
    if (!online) { wasOffline.current = true; return }
    if (wasOffline.current && saveError && !busy) {
      wasOffline.current = false
      retry()
    }
  }, [online, saveError])

  const handleBlur = () => {
    if (readOnly || committing.current) { committing.current = false; return }
    persist(false)
  }

  // After a stepper interaction settles, save like a blur — the value shown is
  // the value stored, same contract as typing. `committing` stood the input's
  // own blur down so this is the single save.
  // Save on release, reading the accumulated value straight from valuesRef so
  // it never lags behind rapid taps. A hold fires this once (on release); each
  // discrete tap fires it too, and the `unchanged` guard drops redundant writes.
  const commitStep = () => {
    committing.current = false
    const { reps: r, weight: w } = valuesRef.current
    persistRef.current(false, r, w)
  }

  const toggleDone = async () => {
    committing.current = false
    if (readOnly || busy) return
    if (saveError) { retry(); return }
    if (done && set) { onToggleDone(set.id, false); return }
    await persist(true)
  }

  // ── Read-only (finished workout, not editing) ──
  if (readOnly) {
    if (!set) return null
    return (
      <>
      <div style={rowStyle(done)}>
        <span style={numStyle}>{setNumber}</span>
        <span style={staticVal(56)}>{set.reps}</span>
        <span style={times}>×</span>
        <span style={staticVal(64)}>{set.weight}</span>
        <span style={unitStyle}>{unit}</span>
        <span style={{ flex: 1 }} />
        {isPR && <PRBadge small />}
        {set1RM > 0 && <span style={rmStyle}>~{set1RM}</span>}
      </div>
      <SetDelta cmp={compareSet({ reps: set.reps, weight: set.weight }, previousSet)} unit={unit} t={t} locale={locale} />
      </>
    )
  }

  return (
    <>
    <div style={rowStyle(done)}>
      <span style={numStyle}>{setNumber}</span>

      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={e => setRepsV(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); weightRef.current?.focus() } }}
        className="input-field set-input"
        style={{ ...inputStyle(52), ...(saveError ? errorBorder : null) }}
        placeholder={repsHint}
        min="1"
        enterKeyHint="next"
        aria-label={`Reps serie ${setNumber}`}
        aria-invalid={saveError || undefined}
      />

      <span style={times}>×</span>

      <input
        ref={weightRef}
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={e => setWeightV(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); checkRef.current?.focus() } }}
        className="input-field set-input"
        style={{ ...inputStyle(64), ...(saveError ? errorBorder : null) }}
        placeholder={previousSet ? String(previousSet.weight) : 'peso'}
        min="0"
        step="2.5"
        enterKeyHint="done"
        aria-label={`Peso serie ${setNumber}`}
        aria-invalid={saveError || undefined}
      />

      {/* Weight steppers — one plate per tap, hold to repeat. Stacked so the
          pair costs one narrow column on a crowded row. */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: '30px', height: '44px', gap: '2px' }}>
        <StepButton dir={1}  ariaLabel={`Subir peso serie ${setNumber} ${stepBy}`}  onHoldStart={() => { committing.current = true }} onStep={() => bumpWeight(stepBy)}  onHoldEnd={commitStep} />
        <StepButton dir={-1} ariaLabel={`Bajar peso serie ${setNumber} ${stepBy}`} onHoldStart={() => { committing.current = true }} onStep={() => bumpWeight(-stepBy)} onHoldEnd={commitStep} />
      </div>

      <span style={unitStyle}>{unit}</span>

      <span style={{ flex: 1, minWidth: 0 }} />

      {isPR && filled && <PRBadge small />}

      {/* ✓ — commit + done toggle. Becomes a retry control after a failed save. */}
      <button
        ref={checkRef}
        onPointerDown={() => { committing.current = true }}
        onClick={toggleDone}
        disabled={!filled && !done && !saveError}
        aria-label={
          saveError ? `Reintentar guardar serie ${setNumber}`
            : done ? `Deshacer serie ${setNumber}`
            : `Completar serie ${setNumber}`
        }
        aria-pressed={saveError ? undefined : done}
        style={{
          flexShrink: 0,
          width: '44px', height: '44px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '10px',
          background: done && !saveError ? 'var(--c-success)' : 'transparent',
          border: `1.5px solid ${
            saveError ? 'var(--c-action)'
              : done ? 'var(--c-success)'
              : (filled ? 'var(--c-border)' : 'var(--c-border-subtle)')
          }`,
          color: saveError ? 'var(--c-action-text)'
            : done ? '#fff'
            : (filled ? 'var(--c-text-dim)' : 'var(--c-text-ghost)'),
          opacity: (!filled && !done && !saveError) ? 0.5 : 1,
          cursor: (!filled && !done && !saveError) ? 'default' : 'pointer',
          transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms',
        }}
      >
        {busy ? (
          <span className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'currentColor', borderColor: 'var(--c-border-subtle)' }} />
        ) : saveError ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>

      {/* remove row */}
      <button
        onPointerDown={() => { committing.current = true }}
        onClick={() => { committing.current = false; onRemove(setNumber, set?.id) }}
        aria-label={`Quitar serie ${setNumber}`}
        {...pressable(0.9, {
          onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-action-text)' },
          onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-muted)' },
        })}
        style={{
          flexShrink: 0,
          width: '36px', height: '44px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-text-muted)', fontSize: '14px', lineHeight: 1,
          transition: `color 150ms var(--ease-out), ${PRESS_TRANSITION}`,
        }}
      >
        ✕
      </button>
    </div>

    <SetDelta cmp={comparison} unit={unit} t={t} locale={locale} />

    {saveError && (
      <div role="alert" style={errorCaptionStyle}>
        <span>{online ? 'No se guardó' : 'Sin conexión · no se guardó'}</span>
        <button onClick={retry} style={retryLinkStyle}>Reintentar</button>
      </div>
    )}
    </>
  )
}

/* ── Weight stepper ──────────────────────────────────────────────────── */
// One step on tap; press-and-hold to repeat (400ms before the first repeat,
// then every 90ms). Never focuses, so it doesn't summon the keyboard.
function StepButton({ dir, ariaLabel, onHoldStart, onStep, onHoldEnd }) {
  const timer = useRef(null)
  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; onHoldEnd() } }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const start = (e) => {
    e.preventDefault() // don't steal focus from the inputs / summon the keyboard
    onHoldStart()
    onStep()
    const tick = () => { onStep(); timer.current = setTimeout(tick, 90) }
    timer.current = setTimeout(tick, 400)
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        flex: 1, width: '30px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
        borderRadius: '6px', color: 'var(--c-text-dim)',
        fontSize: '15px', fontWeight: 700, lineHeight: 1, touchAction: 'none', cursor: 'pointer',
        WebkitUserSelect: 'none', userSelect: 'none',
      }}
    >
      {dir > 0 ? '+' : '−'}
    </button>
  )
}

/* ── Styles ──────────────────────────────────────────────────────────── */
const rowStyle = (done) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 0',
  opacity: done ? 0.5 : 1,
  transition: 'opacity 200ms var(--ease-out)',
})

const numStyle = {
  color: 'var(--c-text-dim)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  fontWeight: 700,
  width: '18px',
  textAlign: 'center',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
}

const inputStyle = (w) => ({
  width: `${w}px`,
  height: '44px',
  textAlign: 'center',
  fontSize: '16px',
  fontWeight: 800,
  padding: '0 4px',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
})

const staticVal = (w) => ({
  color: 'var(--c-text)',
  fontWeight: 800,
  fontSize: '16px',
  width: `${w}px`,
  textAlign: 'center',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
})

const times = { color: 'var(--c-text-ghost)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }
const unitStyle = { color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, flexShrink: 0 }
const rmStyle = { color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 600, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }

const errorBorder = { borderColor: 'var(--c-action)' }

const errorCaptionStyle = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '2px 0 8px 26px',
  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--c-action-text)',
}

const retryLinkStyle = {
  color: 'var(--c-action-text)',
  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  textDecoration: 'underline', textUnderlineOffset: '2px',
  padding: '4px 2px',
}
