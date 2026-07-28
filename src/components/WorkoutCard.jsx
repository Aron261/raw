import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDuration, calcVolume } from '../hooks/useWorkout'
import { pressProps } from '../lib/ui'
import { useLang } from '../hooks/useLang'
import { formatVolume } from '../lib/format'

export default function WorkoutCard({ workout, onDelete, onDuplicate, hasPR = false }) {
  const { t, locale } = useLang()
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
    // Sin día de la semana: la lista ya viene agrupada por mes, así que
    // "mar," solo gastaba el ancho que necesitaba la línea de cifras.
    const dateStr = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })

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
          border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
          borderRadius: 'var(--r-lg)',
          padding: '14px 16px',
          paddingRight: (onDelete || onDuplicate) ? '92px' : '16px', // sitio para las acciones
          display: 'block',
          width: '100%',
          transition: `transform 160ms var(--ease-out), border-color 150ms var(--ease-out)`,
        }}
        {...pressProps(0.985)}
      >
        {/* La fila era una cabecera con fecha y nombre apilados, y debajo tres
            columnas rotuladas —Duración, Volumen, Ejercicios— repitiendo las
            mismas tres etiquetas en las treinta tarjetas de la lista. Eran
            250px por sesión para decir cinco cosas.

            Ahora el nombre manda, la fecha se apoya a su lado y las tres
            cifras van en una sola línea leída: «1h 15m · 5.535 kg · 6
            ejercicios». Las etiquetas se caen porque las unidades ya las
            dicen, y la tarjeta baja a la mitad de alto. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <h3 style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, minWidth: 0 }}>
            {workout.name}
          </h3>

          {isActive ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
              color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 900,
              letterSpacing: '-0.01em',
              padding: '3px 8px', borderRadius: '999px', flexShrink: 0,
            }}>
              <span className="live-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--c-accent)', display: 'inline-block' }} />
              Live
            </span>
          ) : hasPR ? (
            /* El PR iba en una ficha azul rellena, y como casi toda sesión
               trae alguno, treinta fichas azules seguidas no señalaban nada.
               Un punto y una palabra en el color del récord bastan. */
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              color: 'var(--c-record)', fontSize: '11px', fontWeight: 800,
              letterSpacing: '-0.01em', flexShrink: 0,
            }}>
              <span aria-hidden="true" style={{ width: '5px', height: '5px', borderRadius: '999px', background: 'var(--c-record)' }} />
              PR
            </span>
          ) : null}
        </div>

        <p style={{
          color: 'var(--c-text-muted)', fontSize: '12.5px', fontWeight: 500,
          letterSpacing: '-0.01em', lineHeight: 1.4,
        }}>
          {dateStr}
          {duration && <> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{duration}</span></>}
          {totalVolume > 0 && (
            <> · <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatVolume(totalVolume, locale)} {unit}
            </span></>
          )}
          {exerciseCount > 0 && <> · {exerciseCount} {t(exerciseCount === 1 ? 'ejercicio' : 'ejercicios')}</>}
        </p>
      </button>

      {/* Action buttons — sit outside the main button to avoid nesting.
          Delete is hidden while Live so an in-progress session can't be
          dropped from the list. */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', padding: '0 6px' }}>
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
