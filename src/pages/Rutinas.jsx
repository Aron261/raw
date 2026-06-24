import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useRoutines } from '../hooks/useRoutines'
import { useStartRoutineWorkout } from '../hooks/useStartRoutineWorkout'
import { generateRecommendedRoutine, generateSingleDayRoutine, FOCUS_TO_MUSCLES } from '../lib/cycleGenerator'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Sheet, Button } from '../components/ui'

// ── Constantes ────────────────────────────────────────────────────────────
const GOALS_CYCLE      = ['Hipertrofia', 'Fuerza', 'Fuerza-Hipertrofia', 'Recomposición']
const GOALS_SINGLE_DAY = ['Hipertrofia', 'Fuerza', 'Pump / accesorios', 'Recuperación ligera']
const LEVELS           = ['Principiante', 'Intermedio', 'Avanzado']
const DAYS_OPTIONS     = [3, 4, 5, 6]
const FOCUS_OPTIONS    = Object.keys(FOCUS_TO_MUSCLES)
const TIME_OPTIONS     = [30, 45, 60, 75]

// ── Helpers de labels ─────────────────────────────────────────────────────
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

function RoutineMeta({ routine, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', ...style }}>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
        {typeLabel(routine.type)}
      </span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>·</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
        {sourceLabel(routine.source)}
      </span>
      {routine.goal && (
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.goal}</span>
      )}
      {routine.days_per_week && (
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.days_per_week} días/sem</span>
      )}
      <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
        · {(routine.routine_days || []).length} {(routine.routine_days || []).length === 1 ? 'día' : 'días'}
      </span>
      {routine.assigned_by && <AssignedBadge />}
    </div>
  )
}

// Badge para rutinas asignadas por un entrenador
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
function ActiveCycleCard({ routine, onDeactivate }) {
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

      <RoutineMeta routine={routine} style={{ marginBottom: '12px' }} />

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

      <button
        onClick={onDeactivate}
        style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-border-subtle)', padding: '6px 12px', borderRadius: '8px', transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
      >
        Desactivar
      </button>
    </div>
  )
}

// ── Card: ciclo guardado ──────────────────────────────────────────────────
function CycleCard({ routine, onActivate, onDelete }) {
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
            onClick={onActivate}
            style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--c-accent-border)', padding: '4px 10px', borderRadius: '8px', transition: 'background 150ms var(--ease-out)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Activar
          </button>
          {confirmDelete ? (
            <button
              onClick={onDelete}
              style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
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
function SingleDayCard({ routine, onDelete, onStart, starting, hasExercises }) {
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
          {/* Botón Empezar — siempre visible si hay day, disabled si no hay ejercicios */}
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
            <button
              onClick={onDelete}
              style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
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

// ── Modal: selección de tipo ───────────────────────────────────────────────
function TypeSelectionModal({ onClose, onSelectCycle, onSelectSingleDay, onSelectRecommendedCycle, onSelectRecommendedSingleDay }) {
  const options = [
    {
      label: 'Crear ciclo',
      description: 'Plan de varios días para seguir semana a semana.',
      onSelect: onSelectCycle,
    },
    {
      label: 'Crear rutina de un día',
      description: 'Plantilla para repetir un entrenamiento puntual.',
      onSelect: onSelectSingleDay,
    },
    {
      label: 'Generar ciclo recomendado',
      description: 'RAW crea un plan semanal según tus objetivos.',
      onSelect: onSelectRecommendedCycle,
    },
    {
      label: 'Generar rutina de un día',
      description: 'RAW crea un entrenamiento para lo que quieres trabajar hoy.',
      onSelect: onSelectRecommendedSingleDay,
    },
  ]

  return (
    <Sheet title="Crear nueva rutina" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map(opt => (
            <button
              key={opt.label}
              onClick={opt.onSelect}
              style={{
                width: '100%', padding: '14px 16px', textAlign: 'left',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-subtle)',
                borderRadius: '12px',
                transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
              {...pressProps(0.98)}
            >
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '3px' }}>
                {opt.label}
              </p>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>
                {opt.description}
              </p>
            </button>
          ))}
        </div>
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
    <Sheet title="Crear ciclo" onClose={onClose} maxHeight="85dvh">
        {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

        {/* Nombre */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
            Nombre
          </p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Push Pull Legs"
            className="input-field"
            style={{ width: '100%', fontSize: '13px' }}
          />
        </div>

        {/* Días */}
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
                type="text"
                value={day.day_name}
                onChange={e => updateDay(idx, 'day_name', e.target.value)}
                placeholder={`Día ${idx + 1} (ej: Lunes)`}
                className="input-field"
                style={{ flex: 1, fontSize: '12px' }}
              />
              <input
                type="text"
                value={day.focus}
                onChange={e => updateDay(idx, 'focus', e.target.value)}
                placeholder="Push, Pull, Legs..."
                className="input-field"
                style={{ width: '110px', fontSize: '12px' }}
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

        <Button
          variant="primary"
          full
          size="lg"
          loading={saving}
          disabled={saving}
          onClick={handleCreate}
        >
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
    <Sheet title="Crear rutina de un día" onClose={onClose}>
        {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
            Nombre
          </p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Upper Press Day"
            className="input-field"
            style={{ width: '100%', fontSize: '13px' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
            Enfoque (opcional)
          </p>
          <input
            type="text"
            value={focus}
            onChange={e => setFocus(e.target.value)}
            placeholder="Ej: Push, Upper, Pierna..."
            className="input-field"
            style={{ width: '100%', fontSize: '13px' }}
          />
        </div>

        <Button
          variant="primary"
          full
          size="lg"
          loading={saving}
          disabled={saving}
          onClick={handleCreate}
        >
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
    { title: 'Objetivo',          options: GOALS_CYCLE,               value: goal,       onSelect: v => { setGoal(v); setStep(1) } },
    { title: 'Nivel',             options: LEVELS,                    value: level,      onSelect: v => { setLevel(v); setStep(2) } },
    { title: 'Días por semana',   options: DAYS_OPTIONS.map(String),  value: daysPerWeek ? String(daysPerWeek) : '', onSelect: v => { setDays(parseInt(v, 10)); setStep(3) } },
  ]

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const plan = generateRecommendedRoutine({
        goal, level, daysPerWeek,
        dailyTimeMinutes: 60,
        durationWeeks: 1,
        splitChoice: null,
        prioritizedGroups: [],
      })

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

      await onCreate({
        name: `${goal} — ${level} (${daysPerWeek}d)`,
        type: 'cycle',
        source: 'recommended',
        goal,
        level,
        days_per_week: daysPerWeek,
        days,
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
    <Sheet
      title="Ciclo recomendado"
      subtitle={step < 3 ? `Paso ${step + 1} de 3 — ${currentStep?.title}` : undefined}
      onClose={onClose}
    >

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
                  fontSize: '13px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '-0.01em',
                  transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                }}
                {...pressProps(0.98)}
              >
                {opt}
              </button>
            ))}
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px', textAlign: 'center' }}
              >
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
            <Button
              variant="primary"
              full
              size="lg"
              loading={saving}
              disabled={saving}
              onClick={handleGenerate}
              style={{ marginBottom: '10px' }}
            >
              {saving ? 'Generando...' : 'Generar y guardar ciclo'}
            </Button>
            <button
              onClick={() => setStep(2)}
              style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block' }}
            >
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
    { title: '¿Cuánto tiempo tienes?', options: TIME_OPTIONS.map(String), value: time ? String(time) : '',  onSelect: v => { setTime(parseInt(v, 10)); setStep(2) } },
    { title: 'Objetivo',               options: GOALS_SINGLE_DAY,         value: goal,  onSelect: v => { setGoal(v); setStep(3) } },
  ]

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const dayPlan = generateSingleDayRoutine({
        focus,
        dailyTimeMinutes: time,
        goal,
        level: 'Intermedio', // por defecto; se puede exponer como paso extra en el futuro
      })

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
    <Sheet
      title="Rutina de un día"
      subtitle={step < 3 ? `Paso ${step + 1} de 3 — ${currentStep?.title}` : undefined}
      onClose={onClose}
      maxHeight="85dvh"
    >

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
                  fontSize: '13px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '-0.01em',
                  transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                }}
                {...pressProps(0.98)}
              >
                {opt}{step === 1 ? ' min' : ''}
              </button>
            ))}
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px', textAlign: 'center' }}
              >
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
            <Button
              variant="primary"
              full
              size="lg"
              loading={saving}
              disabled={saving}
              onClick={handleGenerate}
              style={{ marginBottom: '10px' }}
            >
              {saving ? 'Generando...' : 'Generar rutina'}
            </Button>
            <button
              onClick={() => setStep(2)}
              style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block' }}
            >
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
    routines,
    activeRoutine,
    loading,
    error,
    createRoutine,
    deleteRoutine,
    setActiveRoutine,
  } = useRoutines()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()

  // Estado de modales: null = cerrado, 'type' | 'cycle' | 'single' | 'rec-cycle' | 'rec-single'
  const [modal, setModal]           = useState(null)
  const [actionError, setActionError] = useState(null)
  // id de la rutina single_day que está iniciándose (para deshabilitar el botón)
  const [startingId, setStartingId] = useState(null)

  // Clasificar rutinas por tipo
  const activeCycle    = activeRoutine?.type === 'cycle' ? activeRoutine : null
  const savedCycles    = routines.filter(r => r.type === 'cycle' && !r.is_active)
  const singleDayItems = routines.filter(r => r.type === 'single_day')

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

  // Iniciar entreno desde una rutina de un día
  const handleStartSingleDay = async (routine) => {
    if (startingId) return  // guard doble click
    const day = (routine.routine_days || [])[0]
    if (!day) return
    // Validar que tenga al menos un ejercicio con nombre válido
    const hasExercises = (day.routine_day_exercises || []).some(e => e.exercise_name?.trim())
    if (!hasExercises) return
    setStartingId(routine.id)
    setActionError(null)
    try {
      const workout = await startWorkoutFromRoutineDay({
        routineId: routine.id,
        routineDayId: day.id,
        routineName: routine.name,
        day,
      })
      navigate(`/workout/${workout.id}`)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setStartingId(null)
    }
  }

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

        {/* Botón principal */}
        <div className="fade-in" style={{ marginBottom: '28px', animationDelay: '20ms' }}>
          <Button
            variant="primary"
            full
            onClick={() => setModal('type')}
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            + Nueva rutina
          </Button>
        </div>

        {/* Errores */}
        {(error || actionError) && (
          <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>
            {error || actionError}
          </div>
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
            {/* ── Ciclo activo ─────────────────────────────────────── */}
            {activeCycle && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Ciclo activo
                </p>
                <ActiveCycleCard routine={activeCycle} onDeactivate={handleDeactivate} />
              </section>
            )}

            {/* ── Ciclos guardados ──────────────────────────────────── */}
            {savedCycles.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '60ms' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Ciclos guardados
                </p>
                {savedCycles.map(r => (
                  <CycleCard
                    key={r.id}
                    routine={r}
                    onActivate={() => handleActivate(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </section>
            )}

            {/* ── Rutinas de un día ─────────────────────────────────── */}
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
                      key={r.id}
                      routine={r}
                      hasExercises={hasExercises}
                      onDelete={() => handleDelete(r.id)}
                      onStart={() => handleStartSingleDay(r)}
                      starting={startingId === r.id}
                    />
                  )
                })}
              </section>
            )}

            {/* Estado vacío */}
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
          onClose={() => setModal(null)}
          onSelectCycle={() => setModal('cycle')}
          onSelectSingleDay={() => setModal('single')}
          onSelectRecommendedCycle={() => setModal('rec-cycle')}
          onSelectRecommendedSingleDay={() => setModal('rec-single')}
        />
      )}
      {modal === 'cycle' && (
        <CreateCycleModal
          onClose={() => setModal(null)}
          onCreate={createRoutine}
        />
      )}
      {modal === 'single' && (
        <CreateSingleDayModal
          onClose={() => setModal(null)}
          onCreate={createRoutine}
        />
      )}
      {modal === 'rec-cycle' && (
        <RecommendedCycleModal
          onClose={() => setModal(null)}
          onCreate={createRoutine}
        />
      )}
      {modal === 'rec-single' && (
        <RecommendedSingleDayModal
          onClose={() => setModal(null)}
          onCreate={createRoutine}
        />
      )}
    </Layout>
  )
}
