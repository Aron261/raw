import { useState, useEffect, useMemo, useRef } from 'react'
import PRBadge from './PRBadge'
import { calc1RM } from '../hooks/useWorkout'

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
  // When ✓ / ✕ is the element being pressed, it steals focus from the inputs
  // and fires their onBlur. This flag tells blur to stand down so we don't
  // create the same set twice (blur + click both saving).
  const committing = useRef(false)

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
    if (unchanged && !markDone) return
    setBusy(true)
    try { await onSave(setNumber, reps, weight, markDone) }
    catch (e) { console.error(e) }
    finally { setBusy(false) }
  }

  const handleBlur = () => {
    if (readOnly || committing.current) { committing.current = false; return }
    persist(false)
  }

  const toggleDone = async () => {
    committing.current = false
    if (readOnly || busy) return
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
    <div style={rowStyle(done)}>
      <span style={numStyle}>{setNumber}</span>

      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={e => setReps(e.target.value)}
        onBlur={handleBlur}
        className="input-field set-input"
        style={inputStyle(52)}
        placeholder={repsHint}
        min="1"
        aria-label={`Reps serie ${setNumber}`}
      />

      <span style={times}>×</span>

      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        onBlur={handleBlur}
        className="input-field set-input"
        style={inputStyle(64)}
        placeholder={previousSet ? String(previousSet.weight) : 'peso'}
        min="0"
        step="2.5"
        aria-label={`Peso serie ${setNumber}`}
      />

      <span style={unitStyle}>{unit}</span>

      <span style={{ flex: 1, minWidth: 0 }} />

      {isPR && filled && <PRBadge small />}

      {/* ✓ — commit + done toggle */}
      <button
        onPointerDown={() => { committing.current = true }}
        onClick={toggleDone}
        disabled={!filled && !done}
        aria-label={done ? `Deshacer serie ${setNumber}` : `Completar serie ${setNumber}`}
        aria-pressed={done}
        style={{
          flexShrink: 0,
          width: '44px', height: '44px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '10px',
          background: done ? 'var(--c-success)' : 'transparent',
          border: `1.5px solid ${done ? 'var(--c-success)' : (filled ? 'var(--c-border)' : 'var(--c-border-subtle)')}`,
          color: done ? '#fff' : (filled ? 'var(--c-text-dim)' : 'var(--c-text-ghost)'),
          opacity: (!filled && !done) ? 0.5 : 1,
          cursor: (!filled && !done) ? 'default' : 'pointer',
          transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms',
        }}
      >
        {busy ? (
          <span className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'currentColor', borderColor: 'var(--c-border-subtle)' }} />
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
