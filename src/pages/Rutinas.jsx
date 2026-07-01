import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useRoutines } from '../hooks/useRoutines'
import { useWorkouts } from '../hooks/useWorkout'
import { useStartRoutineWorkout } from '../hooks/useStartRoutineWorkout'
import { generateRecommendedRoutine, generateSingleDayRoutine, FOCUS_TO_MUSCLES } from '../lib/cycleGenerator'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Sheet, Button } from '../components/ui'
import CycleMuscleDistribution from '../components/CycleMuscleDistribution'

// ── Constantes ────────────────────────────────────────────────────────────
const GOALS_CYCLE      = ['Hipertrofia', 'Fuerza', 'Fuerza-Hipertrofia', 'Recomposición']
const GOALS_SINGLE_DAY = ['Hipertrofia', 'Fuerza', 'Pump / accesorios', 'Recuperación ligera']
const LEVELS           = ['Principiante', 'Intermedio', 'Avanzado']
const DAYS_OPTIONS     = [3, 4, 5, 6]
const FOCUS_OPTIONS    = Object.keys(FOCUS_TO_MUSCLES)

// ── Helpers ───────────────────────────────────────────────────────────────
function typeLabel(type) {
  if (type === 'cycle')      return 'Ciclo'
  if (type === 'single_day') return 'Rutina de un día'
  return type ?? '—'
}

function sourceLabel(source) {
  if (source === 'recommended')  return 'Recomendada'
  if (source === 'from_workout') return 'Desde entreno'
  return 'Personalizada'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })
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
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', ...style }}>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{typeLabel(routine.type)}</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>·</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{sourceLabel(routine.source)}</span>
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
  return (
    <span style={{
      background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
      fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--c-accent-border)',
    }}>
      Entrenador
    </span>
  )
}

// ── Card: ciclo activo ────────────────────────────────────────────────────
const REFRESH_CYCLE_WEEKS = 12  // suggest refreshing a cycle after this long

function ActiveCycleCard({ routine, weeksActive = 0, onDeactivate, onEdit }) {
  const activeLabel = weeksActive < 1
    ? 'Recién activado'
    : `Activo hace ${weeksActive} ${weeksActive === 1 ? 'semana' : 'semanas'}`
  const shouldRefresh = weeksActive >= REFRESH_CYCLE_WEEKS

  return (
    <div style={{
      padding: '18px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-accent-border)',
      borderRadius: '16px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          {routine.name}
        </p>
        <span style={{
          background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
          fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--c-accent-border)',
        }}>
          Activo
        </span>
      </div>

      {/* Time active */}
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '12px' }}>
        {activeLabel}
      </p>

      <RoutineMeta routine={routine} style={{ marginBottom: shouldRefresh ? '12px' : '12px' }} />

      {/* Refresh recommendation after a long run on the same cycle */}
      {shouldRefresh && (
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
          borderRadius: '10px', padding: '10px 12px', marginBottom: '14px',
        }}>
          <span aria-hidden="true" style={{ color: 'var(--c-action-text)', fontSize: '12px', lineHeight: 1.4, flexShrink: 0 }}>↻</span>
          <p style={{ color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 600, lineHeight: 1.45 }}>
            Llevas {weeksActive} semanas en este ciclo. Cambiarlo o ajustar cargas y ejercicios ayuda a seguir progresando.
          </p>
        </div>
      )}

      {(routine.routine_days || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
          {routine.routine_days.map(day => (
            <div key={day.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px',
              background: 'var(--c-surface-2)',
              borderRadius: '8px',
            }}>
              <span style={{ color: 'var(--c-text)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                {day.day_name}
              </span>
              <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
                {day.focus ? day.focus : `${(day.routine_day_exercises || []).length} ejercicios`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onEdit}
          style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-accent-border)', padding: '6px 12px', borderRadius: '8px', transition: 'background 150ms var(--ease-out)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dim)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Editar
        </button>
        <button
          onClick={onDeactivate}
          style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-border-subtle)', padding: '6px 12px', borderRadius: '8px', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
        >
          Desactivar
        </button>
      </div>
    </div>
  )
}

// ── Card: ciclo guardado ──────────────────────────────────────────────────
function CycleCard({ routine, onActivate, onDelete, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '14px',
      marginBottom: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
          {routine.name}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onEdit}
            style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--c-border-subtle)', padding: '4px 10px', borderRadius: '8px', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Editar
          </button>
          <button
            onClick={onActivate}
            style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--c-accent-border)', padding: '4px 10px', borderRadius: '8px', transition: 'background 150ms var(--ease-out)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Activar
          </button>
          {confirmDelete ? (
            <button onClick={onDelete} style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Confirmar
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ color: 'var(--c-text-ghost)', fontSize: '12px', lineHeight: 1, padding: '2px 6px', transition: 'color 150ms var(--ease-out)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)'; setConfirmDelete(false) }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <RoutineMeta routine={routine} />
    </div>
  )
}

// ── Card: rutina de un día ─────────────────────────────────────────────────
function SingleDayCard({ routine, onDelete, onStart, starting, hasExercises, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const day = (routine.routine_days || [])[0]
  const exCount = day ? (day.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length : 0
  const canStart = day && hasExercises && !starting

  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '14px',
      marginBottom: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
          {routine.name}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onEdit}
            style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--c-border-subtle)', padding: '4px 10px', borderRadius: '8px', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Editar
          </button>
          {day && (
            <button
              onClick={canStart ? onStart : undefined}
              disabled={!canStart}
              title={!hasExercises ? 'Este entreno no tiene ejercicios todavía' : undefined}
              style={{
                color: canStart ? 'var(--c-accent)' : 'var(--c-text-ghost)',
                fontSize: '9px', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                border: `1px solid ${canStart ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                padding: '4px 10px', borderRadius: '8px',
                cursor: canStart ? 'pointer' : 'default',
                transition: 'background 150ms var(--ease-out)',
                opacity: starting ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (canStart) e.currentTarget.style.background = 'var(--c-accent-dim)' }}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {starting ? 'Creando...' : !hasExercises ? 'Sin ejercicios' : 'Empezar'}
            </button>
          )}
          {confirmDelete ? (
            <button onClick={onDelete} style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Confirmar
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ color: 'var(--c-text-ghost)', fontSize: '12px', lineHeight: 1, padding: '2px 6px', transition: 'color 150ms var(--ease-out)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)'; setConfirmDelete(false) }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{sourceLabel(routine.source)}</span>
        {exCount > 0 ? (
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {exCount} ejercicios</span>
        ) : (
          <span style={{ color: 'var(--c-text-ghost)', fontSize: '10px' }}>· Sin ejercicios</span>
        )}
        {routine.assigned_by && <AssignedBadge />}
      </div>
    </div>
  )
}

// ── Shared: option row ────────────────────────────────────────────────────
function OptionRow({ label, description, onClick, filled = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 14px', textAlign: 'left',
        background: filled ? 'var(--c-surface-2)' : 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '12px',
        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
      onMouseLeave={e => { e.currentTarget.style.background = filled ? 'var(--c-surface-2)' : 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
      {...pressProps(0.98)}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
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
  const [tab, setTab] = useState('cycle')

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', fontSize: '11px', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out)',
    background: active ? 'var(--c-accent)' : 'transparent',
    color: active ? 'var(--c-on-action)' : 'var(--c-text-ghost)',
  })

  return (
    <Sheet title="Nueva rutina" onClose={onClose}>
      {/* Segmented control */}
      <div style={{
        display: 'flex', gap: '4px', padding: '4px',
        background: 'var(--c-surface-2)', borderRadius: '12px',
        marginBottom: '20px',
      }}>
        <button style={tabStyle(tab === 'cycle')}  onClick={() => setTab('cycle')}>Ciclo</button>
        <button style={tabStyle(tab === 'single')} onClick={() => setTab('single')}>Rutina de un día</button>
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
      subtitle={step === 0 ? 'Elige el entreno base' : 'Revisa y nombra la rutina'}
      onClose={onClose}
      maxHeight="88dvh"
    >
      {step === 0 && (
        <>
          {eligible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-muted)', fontSize: '12px' }}>
              No hay entrenos completados aún.
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
                      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
                      borderRadius: '12px',
                      transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                    {...pressProps(0.98)}
                  >
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '3px' }}>
                      {w.name || 'Entreno'}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
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
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
              Nombre de la rutina
            </p>
            <input
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
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
              Ejercicios ({workoutExercises(selected).length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {workoutExercises(selected).map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
                }}>
                  <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 600 }}>{ex.name}</span>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    {ex.sets} series
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
            {saving ? 'Guardando...' : 'Guardar rutina'}
          </Button>
          <button
            onClick={() => setStep(0)}
            style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block', marginTop: '12px' }}
          >
            Elegir otro entreno
          </button>
        </>
      )}
    </Sheet>
  )
}

// ── Modal: ciclo desde entrenos ───────────────────────────────────────────
function FromWorkoutsCycleModal({ onClose, onCreate, workouts }) {
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
              No hay entrenos completados aún.
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
                        borderRadius: '12px',
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
                        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                          {w.name || 'Entreno'}
                        </p>
                        <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
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
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
              Nombre del ciclo
            </p>
            <input
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
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
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
                        type="text"
                        value={dn}
                        onChange={e => setDayNames(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                        className="input-field"
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    <span style={{ color: 'var(--c-text-ghost)', fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {exs.length}ej
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
            {saving ? 'Guardando...' : 'Crear ciclo'}
          </Button>
          <button
            onClick={() => setStep(0)}
            style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block', marginTop: '12px' }}
          >
            Atrás
          </button>
        </>
      )}
    </Sheet>
  )
}

// ── Modal: crear ciclo manual ─────────────────────────────────────────────
function CreateCycleModal({ onClose, onCreate }) {
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
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
          Nombre
        </p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Push Pull Legs"
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Días ({days.length})
          </p>
          <button
            onClick={addDay}
            style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            + Agregar día
          </button>
        </div>
        {days.map((day, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <input
              type="text" value={day.day_name}
              onChange={e => updateDay(idx, 'day_name', e.target.value)}
              placeholder={`Día ${idx + 1} (ej: Lunes)`}
              className="input-field" style={{ flex: 1, fontSize: '12px' }}
            />
            <input
              type="text" value={day.focus}
              onChange={e => updateDay(idx, 'focus', e.target.value)}
              placeholder="Push, Pull, Legs..."
              className="input-field" style={{ width: '110px', fontSize: '12px' }}
            />
            {days.length > 1 && (
              <button
                onClick={() => removeDay(idx)}
                style={{ color: 'var(--c-text-ghost)', fontSize: '12px', flexShrink: 0, transition: 'color 150ms var(--ease-out)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
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
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
          Nombre
        </p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Upper Press Day"
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
          Enfoque (opcional)
        </p>
        <input
          type="text" value={focus} onChange={e => setFocus(e.target.value)}
          placeholder="Ej: Push, Upper, Pierna..."
          className="input-field" style={{ width: '100%', fontSize: '13px' }}
        />
      </div>

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {saving ? 'Guardando...' : 'Crear rutina'}
      </Button>
    </Sheet>
  )
}

// ── Modal: generar ciclo recomendado (wizard) ─────────────────────────────
function RecommendedCycleModal({ onClose, onCreate }) {
  const [step, setStep]           = useState(0)
  const [goal, setGoal]           = useState('')
  const [level, setLevel]         = useState('')
  const [daysPerWeek, setDays]    = useState(null)
  const [saving, setSaving]       = useState(false)
  const [localError, setLocalError] = useState(null)

  const steps = [
    { title: 'Objetivo',         options: GOALS_CYCLE,              value: goal,       onSelect: v => { setGoal(v); setStep(1) } },
    { title: 'Nivel',            options: LEVELS,                   value: level,      onSelect: v => { setLevel(v); setStep(2) } },
    { title: 'Días por semana',  options: DAYS_OPTIONS.map(String), value: daysPerWeek ? String(daysPerWeek) : '', onSelect: v => { setDays(parseInt(v, 10)); setStep(3) } },
  ]

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const plan = generateRecommendedRoutine({ goal, level, daysPerWeek, dailyTimeMinutes: 60, durationWeeks: 1, splitChoice: null, prioritizedGroups: [] })
      const days = plan.map((dayPlan, i) => ({
        day_name: dayPlan.dayName,
        day_order: i,
        focus: (dayPlan.muscleGroups || []).join(', '),
        exercises: (dayPlan.exercises || []).map((ex, j) => ({
          exercise_name: ex.exerciseName,
          exercise_order: j,
          sets: ex.sets,
          reps: `${ex.repsMin}-${ex.repsMax}`,
          notes: ex.suggestedWeight ? `~${ex.suggestedWeight} ${ex.unit}` : null,
        })),
      }))
      await onCreate({ name: `${goal} — ${level} (${daysPerWeek}d)`, type: 'cycle', source: 'recommended', goal, level, days_per_week: daysPerWeek, days })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const currentStep = steps[step]

  return (
    <Sheet title="Ciclo recomendado" subtitle={step < 3 ? `Paso ${step + 1} de 3 — ${currentStep?.title}` : undefined} onClose={onClose}>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      {step < 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentStep.options.map(opt => (
            <button
              key={opt}
              onClick={() => currentStep.onSelect(opt)}
              style={{
                width: '100%', padding: '14px 16px', textAlign: 'left',
                background: currentStep.value === opt ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                border: `1px solid ${currentStep.value === opt ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                borderRadius: '12px',
                color: currentStep.value === opt ? 'var(--c-accent)' : 'var(--c-text)',
                fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em',
                transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
              }}
              {...pressProps(0.98)}
            >
              {opt}
            </button>
          ))}
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px', textAlign: 'center' }}>
              Atrás
            </button>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ padding: '16px', background: 'var(--c-surface)', borderRadius: '14px', marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Resumen</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Objetivo: {goal}</p>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Nivel: {level}</p>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Días por semana: {daysPerWeek}</p>
            </div>
          </div>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '16px' }}>
            El algoritmo generará un plan semanal completo con ejercicios, series y repeticiones.
          </p>
          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleGenerate} style={{ marginBottom: '10px' }}>
            {saving ? 'Generando...' : 'Generar y guardar ciclo'}
          </Button>
          <button onClick={() => setStep(2)} style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block' }}>
            Atrás
          </button>
        </div>
      )}
    </Sheet>
  )
}

// ── Modal: generar rutina de un día recomendada (wizard) ──────────────────
function RecommendedSingleDayModal({ onClose, onCreate }) {
  const [step, setStep]             = useState(0)
  const [focus, setFocusVal]        = useState('')
  const [time, setTime]             = useState(null)
  const [goal, setGoal]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [localError, setLocalError] = useState(null)

  const steps = [
    { title: '¿Qué quieres entrenar?', options: FOCUS_OPTIONS,            value: focus, onSelect: v => { setFocusVal(v); setStep(1) } },
    { title: '¿Cuánto tiempo tienes?', options: ['30', '45', '60', '75'], value: time ? String(time) : '', onSelect: v => { setTime(parseInt(v, 10)); setStep(2) } },
    { title: 'Objetivo',               options: GOALS_SINGLE_DAY,         value: goal,  onSelect: v => { setGoal(v); setStep(3) } },
  ]

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const dayPlan = generateSingleDayRoutine({ focus, dailyTimeMinutes: time, goal, level: 'Intermedio' })
      await onCreate({
        name: `${focus} — ${goal} (${time} min)`,
        type: 'single_day',
        source: 'recommended',
        is_active: false,
        days: [{
          day_name: dayPlan.dayName,
          day_order: 0,
          focus: (dayPlan.muscleGroups || []).join(', '),
          exercises: dayPlan.exercises.map((ex, j) => ({
            exercise_name: ex.exerciseName,
            exercise_order: j,
            sets: ex.sets,
            reps: `${ex.repsMin}-${ex.repsMax}`,
            notes: ex.suggestedWeight ? `~${ex.suggestedWeight} ${ex.unit}` : null,
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

  const currentStep = steps[step]

  return (
    <Sheet title="Rutina recomendada" subtitle={step < 3 ? `Paso ${step + 1} de 3 — ${currentStep?.title}` : undefined} onClose={onClose} maxHeight="85dvh">
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      {step < 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentStep.options.map(opt => (
            <button
              key={opt}
              onClick={() => currentStep.onSelect(opt)}
              style={{
                width: '100%', padding: '14px 16px', textAlign: 'left',
                background: currentStep.value === opt ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                border: `1px solid ${currentStep.value === opt ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                borderRadius: '12px',
                color: currentStep.value === opt ? 'var(--c-accent)' : 'var(--c-text)',
                fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em',
                transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
              }}
              {...pressProps(0.98)}
            >
              {opt}{step === 1 ? ' min' : ''}
            </button>
          ))}
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px', textAlign: 'center' }}>
              Atrás
            </button>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ padding: '16px', background: 'var(--c-surface)', borderRadius: '14px', marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Resumen</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Enfoque: {focus}</p>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Tiempo: {time} min</p>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Objetivo: {goal}</p>
            </div>
          </div>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '16px' }}>
            RAW generará los ejercicios, series y repeticiones adaptados a tu selección.
          </p>
          <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleGenerate} style={{ marginBottom: '10px' }}>
            {saving ? 'Generando...' : 'Generar rutina'}
          </Button>
          <button onClick={() => setStep(2)} style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block' }}>
            Atrás
          </button>
        </div>
      )}
    </Sheet>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Rutinas() {
  const navigate = useNavigate()
  const {
    routines, activeRoutine, loading, error,
    createRoutine, deleteRoutine, setActiveRoutine,
  } = useRoutines()
  const { workouts } = useWorkouts()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()

  // modal: null | 'type' | 'cycle' | 'single' | 'rec-cycle' | 'rec-single' | 'from-workout' | 'from-cycle'
  const [modal, setModal]           = useState(null)
  const [actionError, setActionError] = useState(null)
  const [startingId, setStartingId] = useState(null)

  const activeCycle    = activeRoutine?.type === 'cycle' ? activeRoutine : null
  const savedCycles    = routines.filter(r => r.type === 'cycle' && !r.is_active)
  const singleDayItems = routines.filter(r => r.type === 'single_day')

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
    try { await setActiveRoutine(null) } catch (e) { setActionError(e.message) }
  }

  const handleActivate = async (id) => {
    setActionError(null)
    try { await setActiveRoutine(id) } catch (e) { setActionError(e.message) }
  }

  const handleDelete = async (id) => {
    setActionError(null)
    try { await deleteRoutine(id) } catch (e) { setActionError(e.message) }
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

        {/* Header */}
        <div className="fade-in" style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            Rutinas
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
            Ciclos y plantillas
          </p>
        </div>

        {/* CTA */}
        <div className="fade-in" style={{ marginBottom: '28px', animationDelay: '20ms' }}>
          <Button variant="primary" full onClick={() => setModal('type')} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            + Nueva rutina
          </Button>
        </div>

        {/* Errores */}
        {(error || actionError) && (
          <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{error || actionError}</div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: '72px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {activeCycle && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Ciclo activo
                </p>
                <ActiveCycleCard routine={activeCycle} weeksActive={cycleWeeksActive} onDeactivate={handleDeactivate} onEdit={() => navigate(`/rutina/${activeCycle.id}`)} />
                <CycleMuscleDistribution routine={activeCycle} />
              </section>
            )}

            {savedCycles.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '60ms' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Ciclos guardados
                </p>
                {savedCycles.map(r => (
                  <CycleCard key={r.id} routine={r} onActivate={() => handleActivate(r.id)} onDelete={() => handleDelete(r.id)} onEdit={() => navigate(`/rutina/${r.id}`)} />
                ))}
              </section>
            )}

            {singleDayItems.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '32px', animationDelay: '80ms' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Rutinas de un día
                </p>
                {singleDayItems.map(r => {
                  const firstDay = (r.routine_days || [])[0]
                  const hasExercises = (firstDay?.routine_day_exercises || []).some(e => e.exercise_name?.trim())
                  return (
                    <SingleDayCard
                      key={r.id} routine={r} hasExercises={hasExercises}
                      onDelete={() => handleDelete(r.id)}
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
                borderRadius: '16px', animationDelay: '40ms',
              }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Sin rutinas guardadas
                </p>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '8px' }}>
                  Crea un ciclo semanal o una rutina puntual para empezar.
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
      {modal === 'cycle'        && <CreateCycleModal onClose={close} onCreate={createRoutine} />}
      {modal === 'single'       && <CreateSingleDayModal onClose={close} onCreate={createRoutine} />}
      {modal === 'rec-cycle'    && <RecommendedCycleModal onClose={close} onCreate={createRoutine} />}
      {modal === 'rec-single'   && <RecommendedSingleDayModal onClose={close} onCreate={createRoutine} />}
      {modal === 'from-workout' && <FromWorkoutModal onClose={close} onCreate={createRoutine} workouts={workouts} />}
      {modal === 'from-cycle'   && <FromWorkoutsCycleModal onClose={close} onCreate={createRoutine} workouts={workouts} />}
    </Layout>
  )
}
