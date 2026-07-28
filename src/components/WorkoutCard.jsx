import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDuration, calcVolume } from '../hooks/useWorkout'
import { pressProps } from '../lib/ui'
import { useLang } from '../hooks/useLang'

export default function WorkoutCard({ workout, onDelete, onDuplicate, hasPR = false }) {
  const { locale } = useLang()
  const navigate = useNavigate()
  const [duplicating, setDuplicating] = useState(false)

  const { totalVolume, exerciseCount, dateStr, duration, isActive, unit } = useMemo(() => {
    // Enriquecemos cada set con su unidad para que calcVolume pueda normalizar a kg
    const allSets = workout.workout_exercises?.flatMap(
      we => (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
    ) || []
    const totalVolume = calcVolume(allSets)
    const exerciseCount = workout.workout_exercises?.length || 0

    const date = new Date(workout.started_at)
    const dateStr = date.toLocaleDateString(locale, {
      weekday: 'short', month: 'short', day: 'numeric',
    })

    const duration = workout.ended_at
      ? formatDuration(workout.started_at, workout.ended_at)
      : null

    const isActive = !workout.ended_at
    // El volumen siempre se muestra en kg (normalizado)
    const unit = 'kg'

    return { totalVolume, exerciseCount, dateStr, duration, isActive, unit }
  }, [workout])

  // Delete is orchestrated by the parent (optimistic hide + undo snackbar);
  // the card just hands over the workout and unmounts.
  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete(workout)
  }

  const handleDuplicate = async (e) => {
    e.stopPropagation()
    setDuplicating(true)
    try {
      const newWorkout = await onDuplicate(workout)
      navigate(`/workout/${newWorkout.id}`)
    } catch (err) {
      console.error(err)
      setDuplicating(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => navigate(`/workout/${workout.id}`)}
        className="card-hover w-full text-left"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-subtle)',
          borderRadius: '16px',
          padding: '14px 16px',
          paddingRight: (onDelete || onDuplicate) ? '52px' : '16px', // room for action btns
          display: 'block',
          width: '100%',
          transition: `transform 160ms var(--ease-out), border-color 150ms var(--ease-out)`,
        }}
        {...pressProps(0.985)}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
              {dateStr}
            </p>
            <h3 style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {workout.name}
            </h3>
          </div>

          {isActive ? (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
              color: 'var(--c-action-text)', fontSize: '9px', fontWeight: 900,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '3px 7px', borderRadius: '6px',
            }}>
              <span className="live-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--c-accent)', display: 'inline-block' }} />
              Live
            </span>
          ) : hasPR ? (
            <span style={{
              background: 'var(--c-record)', color: 'var(--c-record-ink)',
              fontSize: '9px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '3px 7px', borderRadius: '6px',
            }}>
              PR
            </span>
          ) : null}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--c-border-subtle)', paddingTop: '10px' }}>
          {duration && (
            <div>
              <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Duración</p>
              <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{duration}</p>
            </div>
          )}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Volumen</p>
            <p style={{ color: 'var(--c-data)', fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {totalVolume > 0 ? totalVolume.toLocaleString() : '—'}
              {totalVolume > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)', marginLeft: '3px' }}>{unit}</span>}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Ejercicios</p>
            <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{exerciseCount}</p>
          </div>
        </div>
      </button>

      {/* Action buttons — sit outside the main button to avoid nesting.
          Delete is hidden while Live so an in-progress session can't be
          dropped from the list. */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 4px' }}>
        {onDuplicate && (
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            aria-label="Duplicar entreno"
            style={{
              color: 'var(--c-text-muted)',
              minWidth: '44px', minHeight: '44px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: `color 150ms var(--ease-out)`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
          >
            {duplicating
              ? <span className="spinner" style={{ width: '13px', height: '13px' }} />
              : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
          </button>
        )}
        {onDelete && !isActive && (
          <button
            onClick={handleDelete}
            aria-label="Eliminar entreno"
            style={{
              color: 'var(--c-text-muted)',
              fontSize: '15px', lineHeight: 1,
              minWidth: '44px', minHeight: '44px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: `color 150ms var(--ease-out)`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
