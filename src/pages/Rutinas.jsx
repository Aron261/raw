import { useState } from 'react'
import Layout from '../components/Layout'
import { useRoutines } from '../hooks/useRoutines'
import { generateRecommendedRoutine } from '../lib/cycleGenerator'
import { pressProps, ERROR_STYLE } from '../lib/ui'

// ── Constantes para el wizard de rutina recomendada ────────────────────
const GOALS = ['Hipertrofia', 'Fuerza', 'Fuerza-Hipertrofia', 'Recomposición']
const LEVELS = ['Principiante', 'Intermedio', 'Avanzado']
const DAYS_OPTIONS = [3, 4, 5, 6]

// ── Card de rutina activa ──────────────────────────────────────────────
function ActiveRoutineCard({ routine, onDeactivate }) {
  return (
    <div style={{
      padding: '18px 16px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-accent-border)',
      borderRadius: '16px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          {routine.name}
        </p>
        <span style={{
          background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
          fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--c-accent-border)',
        }}>
          Activa
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {routine.type && (
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {routine.type === 'recommended' ? 'Recomendada' : 'Personalizada'}
          </span>
        )}
        {routine.goal && (
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px' }}>· {routine.goal}</span>
        )}
        {routine.level && (
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px' }}>· {routine.level}</span>
        )}
        {routine.days_per_week && (
          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px' }}>· {routine.days_per_week} días/semana</span>
        )}
      </div>

      {/* Días de la rutina */}
      {(routine.routine_days || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
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

// ── Card de rutina normal ──────────────────────────────────────────────
function RoutineCard({ routine, onActivate, onDelete }) {
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

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
          {routine.type === 'recommended' ? 'Recomendada' : 'Personalizada'}
        </span>
        {routine.goal && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.goal}</span>}
        {routine.days_per_week && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {routine.days_per_week} días/sem</span>}
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
          · {(routine.routine_days || []).length} días
        </span>
      </div>
    </div>
  )
}

// ── Modal: crear rutina personalizada ─────────────────────────────────
function CreateCustomModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [days, setDays] = useState([{ day_name: '', day_order: 0, focus: '', exercises: [] }])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const addDay = () => {
    setDays(prev => [...prev, { day_name: '', day_order: prev.length, focus: '', exercises: [] }])
  }

  const removeDay = (idx) => {
    setDays(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_order: i })))
  }

  const updateDay = (idx, field, value) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const handleCreate = async () => {
    if (!name.trim()) { setLocalError('El nombre es obligatorio'); return }
    setSaving(true)
    setLocalError(null)
    try {
      await onCreate({
        name: name.trim(),
        type: 'custom',
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--c-bg)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '480px',
        padding: '24px 20px 40px',
        maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            Crear Rutina
          </h2>
          <button onClick={onClose} style={{ color: 'var(--c-text-ghost)', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>

        {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

        {/* Nombre */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
            Nombre
          </p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Rutina Push Pull Legs"
            className="input-field"
            style={{ width: '100%', fontSize: '13px' }}
          />
        </div>

        {/* Días */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
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

        <button
          onClick={handleCreate}
          disabled={saving}
          className="btn-primary"
          style={{ width: '100%', padding: '13px', fontSize: '12px', fontWeight: 800 }}
          {...pressProps(0.98)}
        >
          {saving ? 'Guardando...' : 'Crear rutina'}
        </button>
      </div>
    </div>
  )
}

// ── Modal: rutina recomendada (wizard) ────────────────────────────────
function RecommendedModal({ onClose, onCreate }) {
  const [step, setStep] = useState(0) // 0: objetivo, 1: nivel, 2: días, 3: confirmar
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const steps = [
    {
      title: 'Objetivo',
      options: GOALS,
      value: goal,
      onSelect: (v) => { setGoal(v); setStep(1) },
    },
    {
      title: 'Nivel',
      options: LEVELS,
      value: level,
      onSelect: (v) => { setLevel(v); setStep(2) },
    },
    {
      title: 'Días por semana',
      options: DAYS_OPTIONS.map(String),
      value: daysPerWeek ? String(daysPerWeek) : '',
      onSelect: (v) => { setDaysPerWeek(parseInt(v, 10)); setStep(3) },
    },
  ]

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      // Generar el plan usando el algoritmo existente
      const plan = generateRecommendedRoutine({
        goal,
        level,
        daysPerWeek,
        dailyTimeMinutes: 60,
        durationWeeks: 1,
        splitChoice: null,
        prioritizedGroups: [],
      })

      // Mapear el plan al formato esperado por createRoutine
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
        type: 'recommended',
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--c-bg)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '480px',
        padding: '24px 20px 40px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
              Rutina Recomendada
            </h2>
            {step < 3 && (
              <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
                Paso {step + 1} de 3 — {currentStep?.title}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'var(--c-text-ghost)', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>

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
                Atras
              </button>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ padding: '16px', background: 'var(--c-surface)', borderRadius: '14px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                Resumen
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Objetivo: {goal}</p>
                <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Nivel: {level}</p>
                <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Días por semana: {daysPerWeek}</p>
              </div>
            </div>

            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '16px' }}>
              El algoritmo generara un plan semanal completo con ejercicios, series y repeticiones adaptados a tu objetivo y nivel.
            </p>

            <button
              onClick={handleGenerate}
              disabled={saving}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '12px', fontWeight: 800, marginBottom: '10px' }}
              {...pressProps(0.98)}
            >
              {saving ? 'Generando...' : 'Generar y guardar rutina'}
            </button>
            <button
              onClick={() => setStep(2)}
              style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: '100%', display: 'block' }}
            >
              Atras
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────
export default function Rutinas() {
  const {
    routines,
    activeRoutine,
    loading,
    error,
    createRoutine,
    deleteRoutine,
    setActiveRoutine,
  } = useRoutines()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRecommendedModal, setShowRecommendedModal] = useState(false)
  const [actionError, setActionError] = useState(null)

  const otherRoutines = routines.filter(r => !r.is_active)

  const handleDeactivate = async () => {
    if (!activeRoutine) return
    setActionError(null)
    try {
      await setActiveRoutine(null)
    } catch (e) {
      setActionError(e.message)
    }
  }

  const handleActivate = async (id) => {
    setActionError(null)
    try {
      await setActiveRoutine(id)
    } catch (e) {
      setActionError(e.message)
    }
  }

  const handleDelete = async (id) => {
    setActionError(null)
    try {
      await deleteRoutine(id)
    } catch (e) {
      setActionError(e.message)
    }
  }

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="fade-in" style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <h1 style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Mis Rutinas
          </h1>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
            Planes semanales de entrenamiento
          </p>
        </div>

        {/* Botones de acción */}
        <div className="fade-in" style={{ display: 'flex', gap: '10px', marginBottom: '28px', animationDelay: '20ms' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ flex: 1, padding: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            {...pressProps(0.97)}
          >
            + Crear rutina
          </button>
          <button
            onClick={() => setShowRecommendedModal(true)}
            style={{
              flex: 1, padding: '12px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: '10px',
              color: 'var(--c-text)', fontSize: '11px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            {...pressProps(0.97)}
          >
            Rutina recomendada
          </button>
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
            {/* Rutina activa */}
            {activeRoutine && (
              <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Rutina activa
                </p>
                <ActiveRoutineCard
                  routine={activeRoutine}
                  onDeactivate={handleDeactivate}
                />
              </section>
            )}

            {/* Otras rutinas */}
            {otherRoutines.length > 0 && (
              <section className="fade-in" style={{ marginBottom: '32px', animationDelay: '60ms' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  {activeRoutine ? 'Otras rutinas' : 'Mis rutinas'}
                </p>
                {otherRoutines.map(r => (
                  <RoutineCard
                    key={r.id}
                    routine={r}
                    onActivate={() => handleActivate(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
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
                  Crea una rutina propia o deja que el algoritmo diseñe una para ti.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateCustomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createRoutine}
        />
      )}
      {showRecommendedModal && (
        <RecommendedModal
          onClose={() => setShowRecommendedModal(false)}
          onCreate={createRoutine}
        />
      )}
    </Layout>
  )
}
