import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Layout from '../components/Layout'
import { useRoutines } from '../hooks/useRoutines'
import { useWorkouts } from '../hooks/useWorkout'
import { useStartRoutineWorkout } from '../hooks/useStartRoutineWorkout'
import RecommendedPlanWizard from '../components/RecommendedPlanWizard'
import { pressProps, ERROR_STYLE, clampLines } from '../lib/ui'
import { Sheet, Button, LiveRegion, UndoSnackbar, Toast } from '../components/ui'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useLang } from '../hooks/useLang'
import CycleMuscleDistribution from '../components/CycleMuscleDistribution'
import ShareRoutineSheet from '../components/ShareRoutineSheet'

// ── Constantes ────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────
function typeLabel(type) {
  if (type === 'cycle')      return 'Ciclo'
  if (type === 'single_day') return 'Rutina de un día'
  return type ?? '—'
}

function sourceLabel(source) {
  if (source === 'recommended')  return 'Recomendada'
  if (source === 'from_workout') return 'Desde entreno'
  if (source === 'shared')       return 'Compartida'
  return 'Personalizada'
}

function fmtDate(iso, locale = 'es-CO') {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

// Extract sorted exercises from a workout object
function workoutExercises(workout) {
  return [...(workout.workout_exercises || [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(we => ({
      name: we.exercises?.name || we.exercise_name || '?',
      sets: (we.sets || []).length,
    }))
    .filter(e => e.name && e.name !== '?')
}

function RoutineMeta({ routine, style = {} }) {
  const { t } = useLang()
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', ...style }}>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{t(typeLabel(routine.type))}</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>·</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{t(sourceLabel(routine.source))}</span>
      {routine.goal && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.goal}</span>}
      {routine.days_per_week && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.days_per_week} días/sem</span>}
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
        · {(routine.routine_days || []).length} {(routine.routine_days || []).length === 1 ? 'día' : 'días'}
      </span>
      {routine.assigned_by && <AssignedBadge />}
    </div>
  )
}

function AssignedBadge() {
  const { t } = useLang()
  return (
    <span style={{
      background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
      fontSize: '8px', fontWeight: 800, letterSpacing: '-0.01em',
      padding: '2px 7px', borderRadius: 'var(--r-xl)', border: '1px solid var(--c-accent-border)',
    }}>
      {t('Entrenador')}
    </span>
  )
}

// ── Card action buttons — >=44px touch height, text-sized width ────────────
const cardPillStyle = (accent) => ({
  minHeight: '44px', padding: '0 12px', borderRadius: 'var(--r-xs)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '10px', fontWeight: 800, letterSpacing: '-0.01em',
  color: accent ? 'var(--c-action-text)' : 'var(--c-text-dim)',
  border: `1px solid ${accent ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
  background: 'transparent',
  transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out), border-color 150ms var(--ease-out)',
})
const cardPillHover = (accent) => ({
  onMouseEnter: e => {
    if (accent) e.currentTarget.style.background = 'var(--c-accent-dim)'
    else { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }
  },
  onMouseLeave: e => {
    if (accent) e.currentTarget.style.background = 'transparent'
    else { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }
  },
})
// ✕ delete — 44px target, legible rest color (not ghost), accent on hover.
const cardIconBtnStyle = {
  minWidth: '44px', minHeight: '44px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--c-text-muted)', fontSize: '14px', lineHeight: 1,
  background: 'transparent', transition: 'color 150ms var(--ease-out)',
}
const cardIconBtnHover = {
  onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-action-text)' },
  onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-muted)' },
}

// ── Card: ciclo activo ────────────────────────────────────────────────────
const REFRESH_CYCLE_WEEKS = 12  // suggest refreshing a cycle after this long

function ActiveCycleCard({ routine, weeksActive = 0, onDeactivate, onEdit, onShare }) {
  const { t } = useLang()
  const activeLabel = weeksActive < 1
    ? t('Recién activado')
    : `${t('Activo hace')} ${weeksActive} ${t(weeksActive === 1 ? 'semana' : 'semanas')}`
  const shouldRefresh = weeksActive >= REFRESH_CYCLE_WEEKS

  return (
    <div style={{
      padding: '18px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-accent-border)',
      borderRadius: 'var(--r-lg)',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {routine.name}
        </p>
        <span style={{
          background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
          fontSize: '8px', fontWeight: 800, letterSpacing: '-0.01em',
          padding: '3px 8px', borderRadius: 'var(--r-xl)', border: '1px solid var(--c-accent-border)',
        }}>
          {t('Activo')}
        </span>
      </div>

      {/* Time active */}
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '12px' }}>
        {activeLabel}
      </p>

      <RoutineMeta routine={routine} style={{ marginBottom: '12px' }} />

      {/* Refresh recommendation after a long run on the same cycle */}
      {shouldRefresh && (
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
          borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: '14px',
        }}>
          <span aria-hidden="true" style={{ color: 'var(--c-action-text)', fontSize: '12px', lineHeight: 1.4, flexShrink: 0 }}>↻</span>
          <p style={{ color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 600, lineHeight: 1.45 }}>
            Llevas {weeksActive} semanas en este ciclo. Cambiarlo o ajustar cargas y ejercicios ayuda a seguir progresando.
          </p>
        </div>
      )}

      {/* Los días iban en dos columnas: el nombre a la izquierda y el enfoque
          pegado al borde derecho, que con «Cuádriceps + pecho + espalda +
          aductores» dejaba el texto apretado contra el margen y a 10px.

          Ahora se apilan —nombre encima, enfoque debajo— con filete entre días
          en vez de tres bloques grises. El enfoque puede respirar y la lista se
          lee de un tirón. */}
      {(routine.routine_days || []).length > 0 && (
        <div style={{ marginBottom: '14px', borderTop: '1px solid var(--c-border-subtle)' }}>
          {routine.routine_days.map(day => (
            <div key={day.id} style={{
              padding: '11px 2px',
              borderBottom: '1px solid var(--c-border-subtle)',
            }}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {day.day_name}
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', lineHeight: 1.4, marginTop: '2px' }}>
                {day.focus ? day.focus : `${(day.routine_day_exercises || []).length} ${t('ejercicios')}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onEdit}
          style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, letterSpacing: '-0.01em', border: '1px solid var(--c-accent-border)', padding: '6px 12px', borderRadius: 'var(--r-xs)', transition: 'background 150ms var(--ease-out)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dim)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {t('Editar')}
        </button>
        <button
          onClick={onShare}
          style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', border: '1px solid var(--c-border-subtle)', padding: '6px 12px', borderRadius: 'var(--r-xs)', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
        >
          {t('Compartir')}
        </button>
        <button
          onClick={onDeactivate}
          style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', border: '1px solid var(--c-border-subtle)', padding: '6px 12px', borderRadius: 'var(--r-xs)', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
        >
          {t('Desactivar')}
        </button>
      </div>
    </div>
  )
}

// ── Card: ciclo guardado ──────────────────────────────────────────────────
function CycleCard({ routine, onActivate, onDelete, onEdit }) {
  const { t } = useLang()
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
      borderRadius: 'var(--r-md)',
      marginBottom: '6px',
    }}>
      {/* El nombre tenía que caber en lo que le dejara el grupo de botones
          —unos 180px— y hay rutinas de 48 caracteres. Ahora ocupa su línea y
          la meta comparte la de abajo con las acciones, que si no se quedaban
          solas en una fila medio vacía. */}
      <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: '8px' }}>
        {routine.name}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}><RoutineMeta routine={routine} /></div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginRight: '-6px' }}>
          <button onClick={onEdit} aria-label={`Editar ${routine.name}`} style={cardPillStyle(false)} {...cardPillHover(false)}>
            {t('Editar')}
          </button>
          <button onClick={onActivate} aria-label={`Activar ${routine.name}`} style={cardPillStyle(true)} {...cardPillHover(true)}>
            {t('Activar')}
          </button>
          <button onClick={onDelete} aria-label={`Eliminar ${routine.name}`} style={cardIconBtnStyle} {...cardIconBtnHover}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card: rutina de un día ─────────────────────────────────────────────────
function SingleDayCard({ routine, onDelete, onStart, starting, hasExercises, onEdit }) {
  const { t } = useLang()
  const day = (routine.routine_days || [])[0]
  const exCount = day ? (day.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length : 0
  const canStart = day && hasExercises && !starting

  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
      borderRadius: 'var(--r-md)',
      marginBottom: '6px',
    }}>
      {/* El nombre tenía que caber en lo que le dejara el grupo de botones
          —unos 180px— y hay rutinas de 48 caracteres. Ahora ocupa su línea y
          la meta comparte la de abajo con las acciones, que si no se quedaban
          solas en una fila medio vacía. */}
      <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: '8px' }}>
        {routine.name}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{t(sourceLabel(routine.source))}</span>
          {exCount > 0 ? (
            <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {exCount} {t('ejercicios')}</span>
          ) : (
            <span style={{ color: 'var(--c-text-ghost)', fontSize: '10px' }}>· {t('Sin ejercicios')}</span>
          )}
          {routine.assigned_by && <AssignedBadge />}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginRight: '-6px' }}>
          <button onClick={onEdit} aria-label={`Editar ${routine.name}`} style={cardPillStyle(false)} {...cardPillHover(false)}>
            {t('Editar')}
          </button>
          {day && (
            <button
              onClick={canStart ? onStart : undefined}
              disabled={!canStart}
              aria-label={hasExercises ? `${t('Empezar')} ${routine.name}` : `${routine.name}: ${t('Sin ejercicios').toLowerCase()}`}
              title={!hasExercises ? t('Este entreno no tiene ejercicios todavía') : undefined}
              style={{
                minHeight: '44px', padding: '0 12px', borderRadius: 'var(--r-xs)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 800, letterSpacing: '-0.01em',
                color: canStart ? 'var(--c-action-text)' : 'var(--c-text-ghost)',
                border: `1px solid ${canStart ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                background: 'transparent',
                cursor: canStart ? 'pointer' : 'default',
                opacity: starting ? 0.6 : 1,
                transition: 'background 150ms var(--ease-out)',
              }}
              onMouseEnter={e => { if (canStart) e.currentTarget.style.background = 'var(--c-accent-dim)' }}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {starting ? t('Creando...') : !hasExercises ? t('Sin ejercicios') : t('Empezar')}
            </button>
          )}
          <button onClick={onDelete} aria-label={`Eliminar ${routine.name}`} style={cardIconBtnStyle} {...cardIconBtnHover}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared: option row ────────────────────────────────────────────────────
function OptionRow({ label, description, onClick, filled = false }) {
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 14px', textAlign: 'left',
        background: filled ? 'var(--c-surface-2)' : 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: 'var(--r-md)',
        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
      onMouseLeave={e => { e.currentTarget.style.background = filled ? 'var(--c-surface-2)' : 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
      {...pressProps(0.98)}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {label}
        </p>
        {description && (
          <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
            {description}
          </p>
        )}
      </div>
      <span style={{ color: 'var(--c-text-ghost)', fontSize: '14px', flexShrink: 0 }}>→</span>
    </button>
  )
}

// ── Modal: selección de tipo — rediseñado ─────────────────────────────────
function TypeSelectionModal({ onClose, onSelectCycle, onSelectSingleDay, onSelectRecommendedCycle, onSelectRecommendedSingleDay, onSelectFromWorkout, onSelectFromWorkoutsCycle }) {
  const { t } = useLang()
  const [tab, setTab] = useState('cycle')

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', fontSize: '11px', fontWeight: 800, letterSpacing: '-0.01em',
    border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer',
    transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out)',
    background: active ? 'var(--c-accent)' : 'transparent',
    color: active ? 'var(--c-on-action)' : 'var(--c-text-ghost)',
  })

  return (
    <Sheet title="Nueva rutina" onClose={onClose}>
      {/* Segmented control */}
      <div style={{
        display: 'flex', gap: '4px', padding: '4px',
        background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)',
        marginBottom: '20px',
      }}>
        <button style={tabStyle(tab === 'cycle')}  onClick={() => setTab('cycle')}>{t('Ciclo')}</button>
        <button style={tabStyle(tab === 'single')} onClick={() => setTab('single')}>{t('Rutina de un día')}</button>
      </div>

      {tab === 'cycle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <OptionRow
            label="En blanco"
            description="Crea los días y ejercicios a mano."
            onClick={onSelectCycle}
            filled
          />
          <OptionRow
            label="Desde historial"
            description="Convierte entrenos pasados en días del ciclo."
            onClick={onSelectFromWorkoutsCycle}
          />
          <OptionRow
            label="Recomendado por RAW"
            description="RAW genera un plan semanal según tu objetivo y nivel."
            onClick={onSelectRecommendedCycle}
          />
        </div>
      )}

      {tab === 'single' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <OptionRow
            label="En blanco"
            description="Plantilla libre para un entrenamiento puntual."
            onClick={onSelectSingleDay}
            filled
          />
          <OptionRow
            label="Desde un entreno"
            description="Guarda los ejercicios de una sesión pasada como plantilla."
            onClick={onSelectFromWorkout}
          />
          <OptionRow
            label="Recomendado por RAW"
            description="RAW elige los ejercicios según lo que quieres trabajar."
            onClick={onSelectRecommendedSingleDay}
          />
        </div>
      )}
    </Sheet>
  )
}

// ── Modal: rutina de un día desde un entreno ──────────────────────────────
function FromWorkoutModal({ onClose, onCreate, workouts }) {
  const { t } = useLang()
  const [step, setStep] = useState(0)          // 0 = pick, 1 = name
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  // Only completed workouts with at least one exercise
  const eligible = useMemo(() =>
    workouts
      .filter(w => w.ended_at && (w.workout_exercises || []).length > 0)
      .slice(0, 30),
    [workouts]
  )

  const handlePick = (workout) => {
    setSelected(workout)
    const exercises = workoutExercises(workout)
    // Auto-fill name from workout name or date
    setName(workout.name || fmtDate(workout.started_at))
    setStep(1)
  }

  const handleCreate = async () => {
    if (!name.trim()) { setLocalError('El nombre es obligatorio'); return }
    if (!selected) return
    setSaving(true)
    setLocalError(null)
    try {
      const exercises = workoutExercises(selected)
      await onCreate({
        name: name.trim(),
        type: 'single_day',
        source: 'from_workout',
        is_active: false,
        days: [{
          day_name: name.trim(),
          day_order: 0,
          focus: null,
          exercises: exercises.map((ex, i) => ({
            exercise_name: ex.name,
            exercise_order: i,
            sets: ex.sets || 3,
            reps: null,
            notes: null,
          })),
        }],
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Desde un entreno"
      subtitle={t(step === 0 ? 'Elige el entreno base' : 'Revisa y nombra la rutina')}
      onClose={onClose}
      maxHeight="88dvh"
    >
      {step === 0 && (
        <>
          {eligible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-muted)', fontSize: '12px' }}>
              {t('No hay entrenos completados aún.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {eligible.map(w => {
                const exs = workoutExercises(w)
                return (
                  <button
                    key={w.id}
                    onClick={() => handlePick(w)}
                    style={{
                      width: '100%', padding: '12px 14px', textAlign: 'left',
                      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
                      borderRadius: 'var(--r-md)',
                      transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                    {...pressProps(0.98)}
                  >
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '3px' }}>
                      {w.name || 'Entreno'}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                      {fmtDate(w.started_at)} · {exs.length} ejercicios
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {step === 1 && selected && (
        <>
          {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

          {/* Nombre */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
              {t('Nombre de la rutina')}
            </p>
            <input
              aria-label={t('Nombre de la rutina')}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
              style={{ width: '100%', fontSize: '13px' }}
              autoFocus
            />
          </div>

          {/* Preview ejercicios */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              Ejercicios ({workoutExercises(selected).length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {workoutExercises(selected).map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)', borderRadius: 'var(--r-sm)',
                }}>
                  <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 600 }}>{ex.name}</span>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                    {ex.sets} series
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
            {t(saving ? 'Guardando...' : 'Guardar rutina')}
          </Button>
          <button
            onClick={() => setStep(0)}
            style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center', width: '100%', display: 'block', marginTop: '12px' }}
          >
            {t('Elegir otro entreno')}
          </button>
        </>
      )}
    </Sheet>
  )
}

// ── Modal: ciclo desde entrenos ───────────────────────────────────────────
function FromWorkoutsCycleModal({ onClose, onCreate, workouts }) {
  const { t } = useLang()
  const [step, setStep] = useState(0)          // 0 = pick workouts, 1 = name cycle
  const [selected, setSelected] = useState([]) // array of workout ids in order
  const [cycleName, setCycleName] = useState('')
  const [dayNames, setDayNames] = useState([]) // editable day names
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const eligible = useMemo(() =>
    workouts
      .filter(w => w.ended_at && (w.workout_exercises || []).length > 0)
      .slice(0, 30),
    [workouts]
  )

  const toggleSelect = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleNext = () => {
    if (selected.length === 0) { setLocalError('Selecciona al menos un entreno'); return }
    setLocalError(null)
    // Pre-fill day names from workout names
    const orderedWorkouts = selected.map(id => eligible.find(w => w.id === id)).filter(Boolean)
    setDayNames(orderedWorkouts.map(w => w.name || fmtDate(w.started_at)))
    setCycleName('')
    setStep(1)
  }

  const handleCreate = async () => {
    if (!cycleName.trim()) { setLocalError('El nombre del ciclo es obligatorio'); return }
    setSaving(true)
    setLocalError(null)
    try {
      const orderedWorkouts = selected.map(id => eligible.find(w => w.id === id)).filter(Boolean)
      const days = orderedWorkouts.map((w, i) => {
        const exercises = workoutExercises(w)
        return {
          day_name: dayNames[i]?.trim() || w.name || `Día ${i + 1}`,
          day_order: i,
          focus: null,
          exercises: exercises.map((ex, j) => ({
            exercise_name: ex.name,
            exercise_order: j,
            sets: ex.sets || 3,
            reps: null,
            notes: null,
          })),
        }
      })

      await onCreate({
        name: cycleName.trim(),
        type: 'cycle',
        source: 'from_workout',
        days,
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Ciclo desde historial"
      subtitle={step === 0 ? `Elige los entrenos — ${selected.length} seleccionados` : 'Nombre del ciclo'}
      onClose={onClose}
      maxHeight="88dvh"
    >
      {step === 0 && (
        <>
          {localError && <div style={{ ...ERROR_STYLE, marginBottom: '12px' }}>{localError}</div>}

          {eligible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-muted)', fontSize: '12px' }}>
              {t('No hay entrenos completados aún.')}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {eligible.map(w => {
                  const isOn = selected.includes(w.id)
                  const exs = workoutExercises(w)
                  const orderIdx = isOn ? selected.indexOf(w.id) + 1 : null
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleSelect(w.id)}
                      style={{
                        width: '100%', padding: '12px 14px', textAlign: 'left',
                        background: isOn ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                        border: `1px solid ${isOn ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                        borderRadius: 'var(--r-md)',
                        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}
                      {...pressProps(0.98)}
                    >
                      {/* Selection badge */}
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isOn ? 'var(--c-accent)' : 'var(--c-surface-2)',
                        border: `1px solid ${isOn ? 'transparent' : 'var(--c-border)'}`,
                        color: isOn ? 'var(--c-on-action)' : 'var(--c-text-ghost)',
                        fontSize: '10px', fontWeight: 800,
                        transition: 'background 150ms var(--ease-out)',
                      }}>
                        {isOn ? orderIdx : ''}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
                          {w.name || 'Entreno'}
                        </p>
                        <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                          {fmtDate(w.started_at)} · {exs.length} ejercicios
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Button
                variant="primary"
                full
                size="lg"
                disabled={selected.length === 0}
                onClick={handleNext}
              >
                Continuar ({selected.length} {selected.length === 1 ? 'día' : 'días'})
              </Button>
            </>
          )}
        </>
      )}

      {step === 1 && (
        <>
          {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

          {/* Nombre del ciclo */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
              {t('Nombre del ciclo')}
            </p>
            <input
              aria-label={t('Nombre del ciclo')}
              type="text"
              value={cycleName}
              onChange={e => setCycleName(e.target.value)}
              placeholder="Ej: Mi programa de fuerza"
              className="input-field"
              style={{ width: '100%', fontSize: '13px' }}
              autoFocus
            />
          </div>

          {/* Días editables */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              Días ({dayNames.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dayNames.map((dn, i) => {
                const w = eligible.find(x => x.id === selected[i])
                const exs = w ? workoutExercises(w) : []
                return (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--c-accent)', color: 'var(--c-on-action)',
                      fontSize: '10px', fontWeight: 800,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        aria-label={t('Nombre del día')}
                        type="text"
                        value={dn}
                        onChange={e => setDayNames(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                        className="input-field"
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    <span style={{ color: 'var(--c-text-ghost)', fontSize: '10px', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                      {exs.length}ej
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
            {t(saving ? 'Guardando...' : 'Crear ciclo')}
          </Button>
          <button
            onClick={() => setStep(0)}
            style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center', width: '100%', display: 'block', marginTop: '12px' }}
          >
            {t('Atrás')}
          </button>
        </>
      )}
    </Sheet>
  )
}

// ── Modal: crear ciclo manual ─────────────────────────────────────────────
function CreateCycleModal({ onClose, onCreate }) {
  const { t } = useLang()
  const [name, setName]         = useState('')
  const [days, setDays]         = useState([{ day_name: '', day_order: 0, focus: '', exercises: [] }])
  const [saving, setSaving]     = useState(false)
  const [localError, setLocalError] = useState(null)

  const addDay = () =>
    setDays(prev => [...prev, { day_name: '', day_order: prev.length, focus: '', exercises: [] }])

  const removeDay = idx =>
    setDays(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_order: i })))

  const updateDay = (idx, field, value) =>
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))

  const handleCreate = async () => {
    if (!name.trim()) { setLocalError('El nombre es obligatorio'); return }
    setSaving(true)
    setLocalError(null)
    try {
      await onCreate({
        name: name.trim(),
        type: 'cycle',
        source: 'manual',
        days: days.filter(d => d.day_name.trim()).map((d, i) => ({ ...d, day_order: i })),
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Ciclo en blanco" onClose={onClose} maxHeight="85dvh">
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
          {t('Nombre')}
        </p>
        <input
          aria-label={t('Nombre del ciclo')}
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Push Pull Legs"
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Días ({days.length})
          </p>
          <button
            onClick={addDay}
            style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            + Agregar día
          </button>
        </div>
        {days.map((day, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <input
              aria-label={t('Nombre del día')}
              type="text" value={day.day_name}
              onChange={e => updateDay(idx, 'day_name', e.target.value)}
              placeholder={`Día ${idx + 1} (ej: Lunes)`}
              className="input-field" style={{ flex: 1, fontSize: '12px' }}
            />
            <input
              aria-label={t('Enfoque del día')}
              type="text" value={day.focus}
              onChange={e => updateDay(idx, 'focus', e.target.value)}
              placeholder="Push, Pull, Legs..."
              className="input-field" style={{ width: '110px', fontSize: '12px' }}
            />
            {days.length > 1 && (
              <button
                onClick={() => removeDay(idx)}
                aria-label={`Quitar día ${idx + 1}`}
                style={{ ...cardIconBtnStyle, flexShrink: 0 }}
                {...cardIconBtnHover}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {saving ? 'Guardando...' : 'Crear ciclo'}
      </Button>
    </Sheet>
  )
}

// ── Modal: crear rutina de un día manual ──────────────────────────────────
function CreateSingleDayModal({ onClose, onCreate }) {
  const { t } = useLang()
  const [name, setName]             = useState('')
  const [focus, setFocus]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleCreate = async () => {
    if (!name.trim()) { setLocalError('El nombre es obligatorio'); return }
    setSaving(true)
    setLocalError(null)
    try {
      await onCreate({
        name: name.trim(),
        type: 'single_day',
        source: 'manual',
        is_active: false,
        days: [{
          day_name: focus.trim() || name.trim(),
          day_order: 0,
          focus: focus.trim() || null,
          exercises: [],
        }],
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Rutina en blanco" onClose={onClose}>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
          {t('Nombre')}
        </p>
        <input
          aria-label={t('Nombre de la rutina')}
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Upper Press Day"
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
          {t('Enfoque (opcional)')}
        </p>
        <input
          aria-label={t('Enfoque del día')}
          type="text" value={focus} onChange={e => setFocus(e.target.value)}
          placeholder="Ej: Push, Upper, Pierna..."
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
        />
      </div>

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {t(saving ? 'Guardando...' : 'Crear rutina')}
      </Button>
    </Sheet>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Rutinas() {
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    routines, activeRoutine, loading, error,
    createRoutine, deleteRoutine, setActiveRoutine,
  } = useRoutines()
  const { workouts } = useWorkouts()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()

  // modal: null | 'type' | 'cycle' | 'single' | 'rec-cycle' | 'rec-single' | 'from-workout' | 'from-cycle'
  // Arriving from the "+" quick-add opens the creation flow straight away.
  const [modal, setModal]           = useState(location.state?.create ? 'type' : null)
  const [actionError, setActionError] = useState(null)
  const [startingId, setStartingId] = useState(null)
  // Rutina cuyo enlace se está gestionando (null = hoja cerrada).
  const [sharingRoutine, setSharingRoutine] = useState(null)
  // Confirmación al llegar desde un enlace compartido: la copia se guarda en la
  // pantalla pública, que desaparece antes de poder anunciar nada.
  const [importedMsg, setImportedMsg] = useState(
    location.state?.imported ? `«${location.state.imported}» guardada en tus rutinas.` : null
  )

  // Undoable delete (shared primitive) — hide optimistically, commit after a
  // grace window, announce to screen readers. Reused for all status announces.
  const routineDelete = useUndoableDelete(r => deleteRoutine(r.id))
  const pendingId = routineDelete.pending?.id

  const activeCycle    = activeRoutine?.type === 'cycle' ? activeRoutine : null
  const savedCycles    = routines.filter(r => r.type === 'cycle' && !r.is_active && r.id !== pendingId)
  const singleDayItems = routines.filter(r => r.type === 'single_day' && r.id !== pendingId)

  // Weeks the active cycle has been in use — measured from the first workout
  // logged under it (0 if none yet).
  const cycleWeeksActive = useMemo(() => {
    if (!activeCycle) return 0
    const times = workouts
      .filter(w => w.routine_id === activeCycle.id && w.started_at)
      .map(w => new Date(w.started_at).getTime())
    if (!times.length) return 0
    return Math.floor((Date.now() - Math.min(...times)) / (7 * 86400000))
  }, [activeCycle, workouts])

  const handleDeactivate = async () => {
    if (!activeCycle) return
    setActionError(null)
    try { await setActiveRoutine(null); routineDelete.setLiveMsg(t('Ciclo desactivado.')) } catch (e) { setActionError(e.message) }
  }

  const handleActivate = async (routine) => {
    setActionError(null)
    try { await setActiveRoutine(routine.id); routineDelete.setLiveMsg(`Ciclo «${routine.name}» activado.`) } catch (e) { setActionError(e.message) }
  }

  // Undoable delete: hide optimistically + snackbar; commit after the window.
  const requestDelete = (routine) => routineDelete.request(routine, {
    deletedMsg: `«${routine.name}» eliminada. Toca deshacer para recuperarla.`,
    restoredMsg: `«${routine.name}» restaurada.`,
  })

  // Crear rutina + anuncio para lectores de pantalla.
  const handleCreateRoutine = async (data) => {
    const row = await createRoutine(data)
    routineDelete.setLiveMsg(`Rutina «${data.name}» creada.`)
    return row
  }

  const handleStartSingleDay = async (routine) => {
    if (startingId) return
    const day = (routine.routine_days || [])[0]
    if (!day) return
    const hasExercises = (day.routine_day_exercises || []).some(e => e.exercise_name?.trim())
    if (!hasExercises) return
    setStartingId(routine.id)
    setActionError(null)
    try {
      const workout = await startWorkoutFromRoutineDay({ routineId: routine.id, routineDayId: day.id, routineName: routine.name, day })
      navigate(`/workout/${workout.id}`)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setStartingId(null)
    }
  }

  const close = () => setModal(null)

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Cabecera.
            Antes eran 430px antes de ver una sola rutina: título, subtítulo
            («Ciclos y plantillas», que repite lo que ya dice el título), un
            botón azul a todo lo ancho y otra etiqueta.

            El botón baja a secundario y se pone al lado del título. Crear una
            rutina es lo que menos se hace aquí —se entra a mirar el ciclo que
            está corriendo—, y el azul relleno lo estaba gritando por encima
            del contenido. */}
        <div
          className="fade-in"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', paddingTop: '40px', paddingBottom: '20px',
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            {t('Rutinas')}
          </h1>
          <Button variant="secondary" size="sm" onClick={() => setModal('type')} style={{ flexShrink: 0 }}>
            + {t('Nueva')}
          </Button>
        </div>

        {/* Errores */}
        {(error || actionError) && (
          <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{error || actionError}</div>
        )}

        {/* Loading skeleton — foreshadows section label + routine cards */}
        {loading && (
          <div aria-hidden="true">
            <div className="skeleton" style={{ height: '9px', width: '96px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '68px', borderRadius: 'var(--r-md)', opacity: 1 - i * 0.18 }} />
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <>
            {activeCycle && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '10px' }}>
                  {t('Ciclo activo')}
                </p>
                <ActiveCycleCard
                  routine={activeCycle}
                  weeksActive={cycleWeeksActive}
                  onDeactivate={handleDeactivate}
                  onEdit={() => navigate(`/rutina/${activeCycle.id}`)}
                  onShare={() => setSharingRoutine(activeCycle)}
                />
                <CycleMuscleDistribution routine={activeCycle} />
              </section>
            )}

            {savedCycles.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '60ms' }}>
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '10px' }}>
                  {t('Ciclos guardados')}
                </p>
                {savedCycles.map(r => (
                  <CycleCard key={r.id} routine={r} onActivate={() => handleActivate(r)} onDelete={() => requestDelete(r)} onEdit={() => navigate(`/rutina/${r.id}`)} />
                ))}
              </section>
            )}

            {singleDayItems.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '32px', animationDelay: '80ms' }}>
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '10px' }}>
                  {t('Rutinas de un día')}
                </p>
                {singleDayItems.map(r => {
                  const firstDay = (r.routine_days || [])[0]
                  const hasExercises = (firstDay?.routine_day_exercises || []).some(e => e.exercise_name?.trim())
                  return (
                    <SingleDayCard
                      key={r.id} routine={r} hasExercises={hasExercises}
                      onDelete={() => requestDelete(r)}
                      onStart={() => handleStartSingleDay(r)}
                      starting={startingId === r.id}
                      onEdit={() => navigate(`/rutina/${r.id}`)}
                    />
                  )
                })}
              </section>
            )}

            {routines.length === 0 && (
              <div className="fade-in" style={{
                textAlign: 'center', padding: '48px 20px',
                background: 'var(--c-surface)', border: '2px dashed var(--c-border)',
                borderRadius: 'var(--r-lg)', animationDelay: '40ms',
              }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {t('Sin rutinas guardadas')}
                </p>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '8px' }}>
                  {t('Crea un ciclo semanal o una rutina puntual para empezar.')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      {modal === 'type' && (
        <TypeSelectionModal
          onClose={close}
          onSelectCycle={() => setModal('cycle')}
          onSelectSingleDay={() => setModal('single')}
          onSelectRecommendedCycle={() => setModal('rec-cycle')}
          onSelectRecommendedSingleDay={() => setModal('rec-single')}
          onSelectFromWorkout={() => setModal('from-workout')}
          onSelectFromWorkoutsCycle={() => setModal('from-cycle')}
        />
      )}
      {modal === 'cycle'        && <CreateCycleModal onClose={close} onCreate={handleCreateRoutine} />}
      {modal === 'single'       && <CreateSingleDayModal onClose={close} onCreate={handleCreateRoutine} />}
      {modal === 'rec-cycle'    && <RecommendedPlanWizard mode="cycle" onClose={close} onCreate={handleCreateRoutine} />}
      {modal === 'rec-single'   && <RecommendedPlanWizard mode="single_day" onClose={close} onCreate={handleCreateRoutine} />}
      {modal === 'from-workout' && <FromWorkoutModal onClose={close} onCreate={handleCreateRoutine} workouts={workouts} />}
      {modal === 'from-cycle'   && <FromWorkoutsCycleModal onClose={close} onCreate={handleCreateRoutine} workouts={workouts} />}

      {sharingRoutine && (
        <ShareRoutineSheet routine={sharingRoutine} onClose={() => setSharingRoutine(null)} />
      )}

      {/* Feedback compartido: aviso de importación, región viva y snackbar de deshacer */}
      <Toast message={importedMsg} onDismiss={() => setImportedMsg(null)} />
      <LiveRegion>{routineDelete.liveMsg}</LiveRegion>
      <UndoSnackbar show={!!routineDelete.pending} message="Rutina eliminada" onUndo={routineDelete.undo} />
    </Layout>
  )
}
