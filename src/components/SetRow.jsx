import { useState, useEffect, useMemo, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { EASE_POP_KEYFRAMES, POP_DURATION } from '../lib/motion'
import PRBadge from './PRBadge'
import { calc1RM } from '../hooks/useWorkout'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

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
  const reduce = useReducedMotion()
  // When ✓ / ✕ is the element being pressed, it steals focus from the inputs
  // and fires their onBlur. This flag tells blur to stand down so we don't
  // create the same set twice (blur + click both saving).
  const committing = useRef(false)
  // Enter walks the row: reps → weight → ✓, so a set can be logged without
  // leaving the keyboard.
  const weightRef = useRef(null)
  const checkRef = useRef(null)

  // Re-sync when the backing set changes (refetch, "igual que la vez pasada")
  useEffect(() => {
    setReps(set ? String(set.reps) : '')
    setWeight(set ? String(set.weight) : '')
  }, [set?.id, set?.reps, set?.weight])

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

  const persist = async (markDone) => {
    if (!filled) return
    const unchanged = set && String(set.reps) === reps && String(set.weight) === weight
    // A prior failure means the server never got these values — retry even if
    // they match the last-known set.
    if (unchanged && !markDone && !saveError) return
    setBusy(true)
    try {
      await onSave(setNumber, reps, weight, markDone)
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
        onChange={e => setReps(e.target.value)}
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
        onChange={e => setWeight(e.target.value)}
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
        style={{
          flexShrink: 0,
          width: '36px', height: '44px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-text-muted)', fontSize: '14px', lineHeight: 1,
          transition: 'color 150ms var(--ease-out)',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-action-text)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-muted)' }}
      >
        ✕
      </button>
    </div>

    {saveError && (
      <div role="alert" style={errorCaptionStyle}>
        <span>{online ? 'No se guardó' : 'Sin conexión · no se guardó'}</span>
        <button onClick={retry} style={retryLinkStyle}>Reintentar</button>
      </div>
    )}
    </>
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
