import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDuration, calcVolume } from '../hooks/useWorkout'
import { pressProps } from '../lib/ui'

export default function WorkoutCard({ workout, onDelete }) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  const { totalVolume, exerciseCount, dateStr, duration, isActive, unit } = useMemo(() => {
    const allSets = workout.workout_exercises?.flatMap(we => we.sets || []) || []
    const totalVolume = calcVolume(allSets)
    const exerciseCount = workout.workout_exercises?.length || 0

    const date = new Date(workout.started_at)
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })

    const duration = workout.ended_at
      ? formatDuration(workout.started_at, workout.ended_at)
      : null

    const isActive = !workout.ended_at
    const unit = workout.workout_exercises?.[0]?.unit ?? 'lb'

    return { totalVolume, exerciseCount, dateStr, duration, isActive, unit }
  }, [workout])

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar "${workout.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await onDelete(workout.id)
    } catch (err) {
      console.error(err)
      setDeleting(false)
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
          paddingRight: onDelete ? '44px' : '16px', // room for delete btn
          display: 'block',
          width: '100%',
          transition: `transform 160ms var(--ease-out), border-color 150ms var(--ease-out)`,
        }}
        {...pressProps(0.985)}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
              {dateStr}
            </p>
            <h3 style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {workout.name}
            </h3>
          </div>

          {isActive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
              color: 'var(--c-accent)', fontSize: '9px', fontWeight: 900,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '3px 7px', borderRadius: '6px',
            }}>
              <span className="live-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--c-accent)', display: 'inline-block' }} />
              Live
            </span>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--c-border-subtle)', paddingTop: '10px' }}>
          {duration && (
            <div>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>Duración</p>
              <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>{duration}</p>
            </div>
          )}
          <div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>Volumen</p>
            <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {totalVolume > 0 ? `${totalVolume.toLocaleString()} ${unit}` : '—'}
            </p>
          </div>
          <div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>Ejercicios</p>
            <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>{exerciseCount}</p>
          </div>
        </div>
      </button>

      {/* Delete button — sits outside the main button to avoid nesting */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Eliminar entreno"
          style={{
            position: 'absolute',
            top: '50%',
            right: '12px',
            transform: 'translateY(-50%)',
            color: 'var(--c-text-ghost)',
            fontSize: '13px',
            lineHeight: 1,
            padding: '6px',
            transition: `color 150ms var(--ease-out)`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
        >
          {deleting ? <span className="spinner" style={{ width: '11px', height: '11px' }} /> : '✕'}
        </button>
      )}
    </div>
  )
}
