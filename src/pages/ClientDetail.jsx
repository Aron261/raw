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
import { useTheme } from '../hooks/useTheme'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Sheet, Button } from '../components/ui'

// Literal hex per theme — CSS vars don't resolve in recharts SVG attrs.
const CHART = {
  light: { bar: '#2438FF', grid: '#D5D2C7', axis: '#67696c', cursor: 'rgba(36,56,255,0.08)' },
  dark:  { bar: '#6E7BFF', grid: '#26271F', axis: '#A2A096', cursor: 'rgba(110,123,255,0.14)' },
}

const SECTION_LABEL = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px',
}
const CARD = {
  background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
  borderRadius: '14px', padding: '16px',
}
const MINI_LABEL = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px',
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


// ── Constructor manual de rutinas ───────────────────────────────────────────
// El entrenador arma cada rutina a mano: días, ejercicios, series, reps,
// descanso y notas. Nada autogenerado.
function emptyExercise() {
  return { exercise_name: '', sets: '', reps: '', rest_seconds: '', notes: '' }
}
function emptyDay() {
  return { day_name: '', focus: '', exercises: [emptyExercise()] }
}

function BuildRoutineModal({ clientName, initialType, onClose, onCreate }) {
  const [type, setType]   = useState(initialType)   // 'cycle' | 'single_day'
  const [name, setName]   = useState('')
  const [days, setDays]   = useState([emptyDay()])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const isCycle = type === 'cycle'

  // — mutadores de días —
  const addDay = () => setDays(prev => [...prev, emptyDay()])
  const removeDay = (di) => setDays(prev => prev.filter((_, i) => i !== di))
  const updateDay = (di, field, val) =>
    setDays(prev => prev.map((d, i) => i === di ? { ...d, [field]: val } : d))

  // — mutadores de ejercicios —
  const addExercise = (di) =>
    setDays(prev => prev.map((d, i) => i === di ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d))
  const removeExercise = (di, ei) =>
    setDays(prev => prev.map((d, i) => i === di ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d))
  const updateExercise = (di, ei, field, val) =>
    setDays(prev => prev.map((d, i) => {
      if (i !== di) return d
      return { ...d, exercises: d.exercises.map((e, j) => j === ei ? { ...e, [field]: val } : e) }
    }))

  // Cambiar a "un día" colapsa a un solo día
  const switchType = (t) => {
    setType(t)
    if (t === 'single_day') setDays(prev => [prev[0] || emptyDay()])
  }

  const handleSave = async () => {
    if (!name.trim()) { setLocalError('Ponle un nombre a la rutina'); return }

    const builtDays = (isCycle ? days : days.slice(0, 1)).map((d, i) => ({
      day_name: d.day_name.trim() || (isCycle ? `Día ${i + 1}` : name.trim()),
      day_order: i,
      focus: d.focus.trim() || null,
      exercises: d.exercises
        .filter(e => e.exercise_name.trim())
        .map((e, j) => ({
          exercise_name: e.exercise_name.trim(),
          exercise_order: j,
          sets: e.sets !== '' ? parseInt(e.sets, 10) : null,
          reps: e.reps.trim() || null,
          rest_seconds: e.rest_seconds !== '' ? parseInt(e.rest_seconds, 10) : null,
          notes: e.notes.trim() || null,
        })),
    }))

    const totalExercises = builtDays.reduce((n, d) => n + d.exercises.length, 0)
    if (totalExercises === 0) { setLocalError('Agrega al menos un ejercicio'); return }

    setSaving(true)
    setLocalError(null)
    try {
      await onCreate({
        name: name.trim(),
        type,
        source: 'manual',
        is_active: false,
        days: builtDays,
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
      setSaving(false)
    }
  }

  return (
    <Sheet title="Crear rutina" subtitle={`Personalizada para ${clientName}`} onClose={onClose}>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      {/* Tipo */}
      <p style={MINI_LABEL}>Tipo</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[{ v: 'cycle', l: 'Ciclo (varios días)' }, { v: 'single_day', l: 'Un día' }].map(opt => (
          <button
            key={opt.v}
            onClick={() => switchType(opt.v)}
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

      {/* Nombre */}
      <p style={MINI_LABEL}>Nombre</p>
      <input
        className="input-field"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={isCycle ? 'Ej: Fuerza 4 días' : 'Ej: Push pesado'}
        style={{ marginBottom: '20px', fontSize: '13px' }}
      />

      {/* Días */}
      {days.map((day, di) => (
        <div key={di} style={{ ...CARD, marginBottom: '12px', padding: '14px' }}>
          {/* cabecera del día */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...MINI_LABEL, marginBottom: 0 }}>{isCycle ? `Día ${di + 1}` : 'Entrenamiento'}</p>
            {isCycle && days.length > 1 && (
              <button onClick={() => removeDay(di)} style={{ color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}>
                Quitar día
              </button>
            )}
          </div>

          {/* nombre + enfoque del día */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              className="input-field"
              value={day.day_name}
              onChange={e => updateDay(di, 'day_name', e.target.value)}
              placeholder={isCycle ? 'Nombre (ej: Lunes / Push)' : 'Nombre del día'}
              style={{ flex: 1, fontSize: '12px' }}
            />
            <input
              className="input-field"
              value={day.focus}
              onChange={e => updateDay(di, 'focus', e.target.value)}
              placeholder="Enfoque"
              style={{ width: '100px', fontSize: '12px' }}
            />
          </div>

          {/* ejercicios */}
          {day.exercises.map((ex, ei) => (
            <div key={ei} style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '10px', padding: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  className="input-field"
                  value={ex.exercise_name}
                  onChange={e => updateExercise(di, ei, 'exercise_name', e.target.value)}
                  placeholder={`Ejercicio ${ei + 1}`}
                  style={{ flex: 1, fontSize: '12px', fontWeight: 600 }}
                />
                {day.exercises.length > 1 && (
                  <button onClick={() => removeExercise(di, ei)} aria-label="Quitar ejercicio"
                    style={{ color: 'var(--c-text-ghost)', fontSize: '13px', padding: '2px 4px', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}>
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  className="input-field" type="number" inputMode="numeric"
                  value={ex.sets}
                  onChange={e => updateExercise(di, ei, 'sets', e.target.value)}
                  placeholder="Series"
                  style={{ width: '64px', fontSize: '12px', textAlign: 'center' }}
                />
                <input
                  className="input-field"
                  value={ex.reps}
                  onChange={e => updateExercise(di, ei, 'reps', e.target.value)}
                  placeholder="Reps (8-12)"
                  style={{ flex: 1, fontSize: '12px', textAlign: 'center' }}
                />
                <input
                  className="input-field" type="number" inputMode="numeric"
                  value={ex.rest_seconds}
                  onChange={e => updateExercise(di, ei, 'rest_seconds', e.target.value)}
                  placeholder="Desc. (s)"
                  style={{ width: '78px', fontSize: '12px', textAlign: 'center' }}
                />
              </div>
              <input
                className="input-field"
                value={ex.notes}
                onChange={e => updateExercise(di, ei, 'notes', e.target.value)}
                placeholder="Notas (opcional)"
                style={{ fontSize: '12px', marginTop: '6px' }}
              />
            </div>
          ))}

          <button
            onClick={() => addExercise(di)}
            style={{ color: 'var(--c-accent)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}
          >
            + Agregar ejercicio
          </button>
        </div>
      ))}

      {/* agregar día (solo ciclo) */}
      {isCycle && (
        <Button variant="secondary" full onClick={addDay} style={{ marginBottom: '16px' }}>
          + Agregar día
        </Button>
      )}

      {/* guardar */}
      <Button
        variant="primary"
        full
        size="lg"
        loading={saving}
        disabled={saving}
        onClick={handleSave}
        style={{ marginTop: isCycle ? 0 : '8px' }}
      >
        {saving ? 'Guardando...' : 'Asignar rutina'}
      </Button>
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
    <Sheet title="Asignar meta" subtitle={`Para ${clientName}`} onClose={onClose}>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      <p style={MINI_LABEL}>Tipo de meta</p>
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
        <p style={MINI_LABEL}>Nombre</p>
        <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Press banca 100kg" />
      </div>

      {type === 'exercise_weight' && (
        <div style={{ marginBottom: '14px' }}>
          <p style={MINI_LABEL}>Ejercicio</p>
          <input className="input-field" value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="Ej: Bench Press" />
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <p style={MINI_LABEL}>Objetivo</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" style={{ flex: 1 }} />
          {type === 'exercise_weight' && (
            <div style={{ display: 'flex', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
              {['kg', 'lb'].map(u => (
                <button key={u} onClick={() => setUnit(u)} style={{
                  padding: '0 14px', fontSize: '11px', fontWeight: 700,
                  background: unit === u ? 'var(--c-accent)' : 'transparent',
                  color: unit === u ? 'var(--c-on-action)' : 'var(--c-text-dim)',
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

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {saving ? 'Asignando...' : 'Asignar meta'}
      </Button>
    </Sheet>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ClientDetail() {
  const { id: clientId } = useParams()
  const navigate = useNavigate()

  const { profile, age, loading: profLoading } = useClientDetail(clientId)
  const { routines, loading: routLoading, createRoutine, deleteRoutine, setActiveRoutine } = useRoutines(clientId)
  const { goals, loading: goalsLoading, createGoal, deleteGoal } = useGoals(clientId)
  const { data: dash } = useDashboard(clientId)
  const { resolved } = useTheme()
  const cc = CHART[resolved] || CHART.light

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
            <span style={{ color: 'var(--c-action-text)', fontSize: '20px', fontWeight: 900 }}>{name.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {profLoading ? '...' : name}
            </h1>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '4px' }}>
              {[age ? `${age} años` : null, profile?.level, profile?.goal].filter(Boolean).join(' · ') || 'Sin datos de perfil'}
            </p>
          </div>
          <button
            onClick={() => navigate(`/chat/${clientId}`)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
              border: '1px solid var(--c-accent-border)', borderRadius: '10px',
              padding: '8px 12px', fontSize: '11px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
            {...pressProps(0.97)}
          >
            Mensaje
          </button>
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
              <p style={MINI_LABEL}>Volumen semanal</p>
              <div style={{ height: '120px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dash.weeklyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: cc.axis, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: cc.axis, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: cc.cursor }} />
                    <Bar dataKey="volume" fill={cc.bar} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {dash?.bestLifts?.length > 0 && (
            <div style={{ ...CARD, marginTop: '8px' }}>
              <p style={MINI_LABEL}>Mejores levantamientos</p>
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
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '12px 0' }}>Sin rutinas. Crea un ciclo o un día personalizado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...cycles, ...singleDays].map(r => {
                const exCount = (r.routine_days || []).reduce((n, d) => n + (d.routine_day_exercises || []).length, 0)
                return (
                  <div key={r.id} style={{ ...CARD, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>{r.name}</p>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
                            {r.type === 'cycle' ? 'Ciclo' : 'Día'} · {(r.routine_days || []).length} {(r.routine_days || []).length === 1 ? 'día' : 'días'} · {exCount} ejercicios
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
                )
              })}
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

      {modal === 'cycle'  && <BuildRoutineModal clientName={name} initialType="cycle"      onClose={() => setModal(null)} onCreate={createRoutine} />}
      {modal === 'single' && <BuildRoutineModal clientName={name} initialType="single_day" onClose={() => setModal(null)} onCreate={createRoutine} />}
      {modal === 'goal'   && <AssignGoalModal   clientName={name}                          onClose={() => setModal(null)} onCreate={createGoal} />}
    </Layout>
  )
}
