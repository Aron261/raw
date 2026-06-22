import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Layout from '../components/Layout'
import { useClientDetail } from '../hooks/useClientDetail'
import { useRoutines } from '../hooks/useRoutines'
import { useGoals } from '../hooks/useGoals'
import { useDashboard } from '../hooks/useDashboard'
import { generateRecommendedRoutine, generateSingleDayRoutine, FOCUS_TO_MUSCLES } from '../lib/cycleGenerator'
import { pressProps, ERROR_STYLE } from '../lib/ui'

const GOALS_CYCLE   = ['Hipertrofia', 'Fuerza', 'Fuerza-Hipertrofia', 'Recomposición']
const LEVELS        = ['Principiante', 'Intermedio', 'Avanzado']
const DAYS_OPTIONS  = [3, 4, 5, 6]
const FOCUS_OPTIONS = Object.keys(FOCUS_TO_MUSCLES)

const SECTION_LABEL = {
  color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px',
}
const CARD = {
  background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
  borderRadius: '14px', padding: '16px',
}

// ── Mini stat ──────────────────────────────────────────────────────────────
function Stat({ label, value }) {
  return (
    <div style={{ ...CARD, flex: 1, textAlign: 'center', padding: '14px 8px' }}>
      <p style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</p>
    </div>
  )
}

// ── Modal genérico (bottom sheet) ───────────────────────────────────────────
function Sheet({ title, onClose, children }) {
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
        width: '100%', maxWidth: '480px', padding: '24px 20px 40px',
        maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--c-text-ghost)', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Wizard de opciones (pills) ──────────────────────────────────────────────
function OptionList({ options, value, onSelect, suffix = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            width: '100%', padding: '14px 16px', textAlign: 'left',
            background: value === opt ? 'var(--c-accent-dim)' : 'var(--c-surface)',
            border: `1px solid ${value === opt ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
            borderRadius: '12px',
            color: value === opt ? 'var(--c-accent)' : 'var(--c-text)',
            fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em',
          }}
          {...pressProps(0.98)}
        >
          {opt}{suffix}
        </button>
      ))}
    </div>
  )
}

// ── Modal: asignar ciclo recomendado ────────────────────────────────────────
function AssignCycleModal({ clientName, onClose, onCreate }) {
  const [step, setStep]   = useState(0)
  const [goal, setGoal]   = useState('')
  const [level, setLevel] = useState('')
  const [days, setDays]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleGenerate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const plan = generateRecommendedRoutine({
        goal, level, daysPerWeek: days, dailyTimeMinutes: 60, durationWeeks: 1,
        splitChoice: null, prioritizedGroups: [],
      })
      const planDays = plan.map((dayPlan, i) => ({
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
        name: `${goal} — ${level} (${days}d)`,
        type: 'cycle', source: 'recommended',
        goal, level, days_per_week: days, days: planDays,
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Asignar ciclo" onClose={onClose}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginBottom: '16px' }}>
        Para {clientName}. RAW genera el plan completo según estos parámetros.
      </p>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      {step === 0 && (
        <>
          <p style={SECTION_LABEL}>Objetivo</p>
          <OptionList options={GOALS_CYCLE} value={goal} onSelect={v => { setGoal(v); setStep(1) }} />
        </>
      )}
      {step === 1 && (
        <>
          <p style={SECTION_LABEL}>Nivel</p>
          <OptionList options={LEVELS} value={level} onSelect={v => { setLevel(v); setStep(2) }} />
          <BackBtn onClick={() => setStep(0)} />
        </>
      )}
      {step === 2 && (
        <>
          <p style={SECTION_LABEL}>Días por semana</p>
          <OptionList options={DAYS_OPTIONS.map(String)} value={days ? String(days) : ''} onSelect={v => { setDays(parseInt(v, 10)); setStep(3) }} />
          <BackBtn onClick={() => setStep(1)} />
        </>
      )}
      {step === 3 && (
        <>
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <p style={SECTION_LABEL}>Resumen</p>
            <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Objetivo: {goal}</p>
            <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Nivel: {level}</p>
            <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>Días/semana: {days}</p>
          </div>
          <button onClick={handleGenerate} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '12px', fontWeight: 800, marginBottom: '10px' }} {...pressProps(0.98)}>
            {saving ? 'Asignando...' : 'Generar y asignar'}
          </button>
          <BackBtn onClick={() => setStep(2)} center />
        </>
      )}
    </Sheet>
  )
}

// ── Modal: asignar rutina de un día ─────────────────────────────────────────
function AssignSingleDayModal({ clientName, onClose, onCreate }) {
  const [focus, setFocus] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleGenerate = async (selectedFocus) => {
    setFocus(selectedFocus)
    setSaving(true)
    setLocalError(null)
    try {
      const dayPlan = generateSingleDayRoutine({
        focus: selectedFocus, dailyTimeMinutes: 60, goal: 'Hipertrofia', level: 'Intermedio',
      })
      await onCreate({
        name: `${selectedFocus} (día)`,
        type: 'single_day', source: 'recommended', is_active: false,
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
      setSaving(false)
    }
  }

  return (
    <Sheet title="Asignar rutina de un día" onClose={onClose}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginBottom: '16px' }}>
        Para {clientName}. Elige el enfoque del entrenamiento.
      </p>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}
      {saving
        ? <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', textAlign: 'center', padding: '20px' }} className="animate-pulse">Asignando {focus}...</p>
        : <OptionList options={FOCUS_OPTIONS} value={focus} onSelect={handleGenerate} />
      }
    </Sheet>
  )
}

// ── Modal: asignar meta ──────────────────────────────────────────────────────
function AssignGoalModal({ clientName, onClose, onCreate }) {
  const [type, setType]   = useState('exercise_weight')
  const [label, setLabel] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit]   = useState('kg')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleCreate = async () => {
    if (!label.trim()) { setLocalError('Ponle un nombre a la meta'); return }
    const targetNum = parseFloat(target)
    if (!targetNum || targetNum <= 0) { setLocalError('Ingresa un valor objetivo válido'); return }
    setSaving(true)
    setLocalError(null)
    try {
      await onCreate({
        type,
        label: label.trim(),
        exercise_name: type === 'exercise_weight' ? (exerciseName.trim() || null) : null,
        target_value: targetNum,
        unit: type === 'days_trained' ? 'días' : unit,
        is_monthly: type === 'days_trained',
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Asignar meta" onClose={onClose}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginBottom: '16px' }}>Para {clientName}.</p>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      <p style={SECTION_LABEL}>Tipo de meta</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {[
          { v: 'exercise_weight', l: 'Peso en ejercicio' },
          { v: 'days_trained',    l: 'Días/mes' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setType(opt.v)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              border: `1px solid ${type === opt.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: type === opt.v ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
              color: type === opt.v ? 'var(--c-accent)' : 'var(--c-text-dim)',
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <p style={SECTION_LABEL}>Nombre</p>
        <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Press banca 100kg" />
      </div>

      {type === 'exercise_weight' && (
        <div style={{ marginBottom: '14px' }}>
          <p style={SECTION_LABEL}>Ejercicio</p>
          <input className="input-field" value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="Ej: Bench Press" />
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <p style={SECTION_LABEL}>Objetivo</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" style={{ flex: 1 }} />
          {type === 'exercise_weight' && (
            <div style={{ display: 'flex', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
              {['kg', 'lb'].map(u => (
                <button key={u} onClick={() => setUnit(u)} style={{
                  padding: '0 14px', fontSize: '11px', fontWeight: 700,
                  background: unit === u ? 'var(--c-accent)' : 'transparent',
                  color: unit === u ? '#fff' : 'var(--c-text-dim)',
                }}>{u}</button>
              ))}
            </div>
          )}
          {type === 'days_trained' && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700 }}>
              días
            </div>
          )}
        </div>
      </div>

      <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '13px', fontSize: '12px', fontWeight: 800 }} {...pressProps(0.98)}>
        {saving ? 'Asignando...' : 'Asignar meta'}
      </button>
    </Sheet>
  )
}

function BackBtn({ onClick, center }) {
  return (
    <button onClick={onClick} style={{
      color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px',
      textAlign: 'center', width: center ? '100%' : 'auto', display: 'block',
    }}>
      Atras
    </button>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ClientDetail() {
  const { id: clientId } = useParams()
  const navigate = useNavigate()

  const { profile, age, loading: profLoading } = useClientDetail(clientId)
  const { routines, activeRoutine, loading: routLoading, createRoutine, deleteRoutine, setActiveRoutine } = useRoutines(clientId)
  const { goals, loading: goalsLoading, createGoal, deleteGoal } = useGoals(clientId)
  const { data: dash } = useDashboard(clientId)

  const [modal, setModal] = useState(null) // 'cycle' | 'single' | 'goal'
  const [actionError, setActionError] = useState(null)

  const name = profile?.name || 'Cliente'
  const cycles = routines.filter(r => r.type === 'cycle')
  const singleDays = routines.filter(r => r.type === 'single_day')

  const run = async (fn) => {
    setActionError(null)
    try { await fn() } catch (e) { setActionError(e.message) }
  }

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Back */}
        <button
          onClick={() => navigate('/coach')}
          style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Clientes
        </button>

        {/* Header */}
        <div className="fade-in" style={{ paddingTop: '16px', paddingBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--c-accent-dim)', border: '2px solid var(--c-accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--c-accent)', fontSize: '20px', fontWeight: 900 }}>{name.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {profLoading ? '...' : name}
            </h1>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '4px' }}>
              {[age ? `${age} años` : null, profile?.level, profile?.goal].filter(Boolean).join(' · ') || 'Sin datos de perfil'}
            </p>
          </div>
        </div>

        {actionError && <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{actionError}</div>}

        {/* ── Progreso ─────────────────────────────────────────────── */}
        <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
          <p style={SECTION_LABEL}>Progreso</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Stat label="Entrenos" value={dash?.totalWorkouts ?? '—'} />
            <Stat label="Este mes" value={dash?.thisMonth ?? '—'} />
            <Stat label="PRs" value={dash?.bestLifts?.length ?? '—'} />
          </div>

          {dash?.weeklyData?.some(w => w.volume > 0) && (
            <div style={{ ...CARD }}>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                Volumen semanal
              </p>
              <div style={{ height: '120px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dash.weeklyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="#E8E8EE" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,45,45,0.06)' }} />
                    <Bar dataKey="volume" fill="#FF2D2D" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {dash?.bestLifts?.length > 0 && (
            <div style={{ ...CARD, marginTop: '8px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                Mejores levantamientos
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dash.bestLifts.map(l => (
                  <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--c-text-dim)', fontSize: '12px' }}>{l.name}</span>
                    <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800 }}>{Math.round(l.best1RM)} {l.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Rutinas ──────────────────────────────────────────────── */}
        <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '60ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>Rutinas</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModal('cycle')} style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Ciclo</button>
              <button onClick={() => setModal('single')} style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Día</button>
            </div>
          </div>

          {routLoading ? (
            <div style={{ height: '60px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
          ) : routines.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '12px 0' }}>Sin rutinas. Asigna un ciclo o un día.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...cycles, ...singleDays].map(r => (
                <div key={r.id} style={{ ...CARD, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>{r.name}</p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
                          {r.type === 'cycle' ? 'Ciclo' : 'Día'} · {(r.routine_days || []).length} {(r.routine_days || []).length === 1 ? 'día' : 'días'}
                        </span>
                        {r.is_active && (
                          <span style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>· Activo</span>
                        )}
                        {r.assigned_by && (
                          <span style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700 }}>· Asignada por ti</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      {r.type === 'cycle' && !r.is_active && (
                        <button onClick={() => run(() => setActiveRoutine(r.id))} style={{ color: 'var(--c-accent)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-accent-border)', padding: '4px 9px', borderRadius: '8px' }}>
                          Activar
                        </button>
                      )}
                      <button onClick={() => run(() => deleteRoutine(r.id))} aria-label="Eliminar" style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '2px 4px' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Metas ────────────────────────────────────────────────── */}
        <section className="fade-in" style={{ marginBottom: '40px', animationDelay: '80ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>Metas</p>
            <button onClick={() => setModal('goal')} style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Meta</button>
          </div>

          {goalsLoading ? (
            <div style={{ height: '50px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
          ) : goals.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '12px 0' }}>Sin metas asignadas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {goals.map(g => (
                <div key={g.id} style={{ ...CARD, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700 }}>{g.label}</p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                      Objetivo: {g.target_value} {g.unit}
                      {g.assigned_by ? ' · Asignada por ti' : ''}
                    </p>
                  </div>
                  <button onClick={() => run(() => deleteGoal(g.id))} aria-label="Eliminar" style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '2px 4px' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modal === 'cycle'  && <AssignCycleModal     clientName={name} onClose={() => setModal(null)} onCreate={createRoutine} />}
      {modal === 'single' && <AssignSingleDayModal clientName={name} onClose={() => setModal(null)} onCreate={createRoutine} />}
      {modal === 'goal'   && <AssignGoalModal      clientName={name} onClose={() => setModal(null)} onCreate={createGoal} />}
    </Layout>
  )
}
