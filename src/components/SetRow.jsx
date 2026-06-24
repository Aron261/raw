import { useState, useMemo } from 'react'
import PRBadge from './PRBadge'
import { calc1RM } from '../hooks/useWorkout'
import { hoverColor } from '../lib/ui'

export default function SetRow({ set, unit, allTimeBest1RM, onDelete, onUpdate, readOnly = false }) {
  const [reps, setReps] = useState(String(set.reps))
  const [weight, setWeight] = useState(String(set.weight))
  const [saving, setSaving] = useState(false)

  const { set1RM, isPR } = useMemo(() => {
    const rm = calc1RM(parseFloat(weight) || 0, parseInt(reps, 10) || 0)
    return { set1RM: rm, isPR: rm > 0 && allTimeBest1RM > 0 && rm >= allTimeBest1RM }
  }, [weight, reps, allTimeBest1RM])

  const handleBlur = async () => {
    if (readOnly) return
    if (String(set.reps) === reps && String(set.weight) === weight) return
    setSaving(true)
    try {
      await onUpdate(set.id, {
        reps: parseInt(reps, 10) || set.reps,
        weight: parseFloat(weight) || set.weight,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        borderBottom: '1px solid var(--c-surface-2)',
      }}
    >
      {/* Set number */}
      <span
        style={{
          color: 'var(--c-text-dim)',
          fontSize: '11px',
          fontWeight: 800,
          width: '20px',
          textAlign: 'center',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {set.set_number}
      </span>

      {/* Reps */}
      {readOnly ? (
        <span style={{ color: 'var(--c-text)', fontWeight: 700, fontSize: '14px', width: '44px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {set.reps}
        </span>
      ) : (
        <input
          type="number"
          value={reps}
          onChange={e => setReps(e.target.value)}
          onBlur={handleBlur}
          className="input-field"
          style={{ width: '44px', textAlign: 'center', fontSize: '14px', fontWeight: 700, padding: '5px 4px' }}
          placeholder="Reps"
          min="1"
        />
      )}

      <span style={{ color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700 }}>×</span>

      {/* Weight */}
      {readOnly ? (
        <span style={{ color: 'var(--c-text)', fontWeight: 700, fontSize: '14px', width: '56px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {set.weight}
        </span>
      ) : (
        <input
          type="number"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={handleBlur}
          className="input-field"
          style={{ width: '56px', textAlign: 'center', fontSize: '14px', fontWeight: 700, padding: '5px 4px' }}
          placeholder="Peso"
          min="0"
          step="2.5"
        />
      )}

      <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>{unit}</span>

      {/* Estimated 1RM */}
      <span
        style={{
          color: 'var(--c-text-ghost)',
          fontSize: '10px',
          fontWeight: 600,
          flex: 1,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {set1RM > 0 ? `~${set1RM}` : ''}
      </span>

      {/* PR badge */}
      {isPR && <PRBadge small />}

      {/* Saving */}
      {saving && <span className="spinner" style={{ flexShrink: 0 }} />}

      {/* Delete */}
      {!readOnly && !saving && (
        <button
          onClick={() => onDelete(set.id)}
          aria-label="Delete set"
          style={{
            color: 'var(--c-text-ghost)',
            fontSize: '12px',
            lineHeight: 1,
            flexShrink: 0,
            transition: `color 150ms var(--ease-out)`,
            padding: '4px',
          }}
          {...hoverColor('var(--c-accent)', 'var(--c-text-ghost)')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
