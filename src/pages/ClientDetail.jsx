import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Layout from '../components/Layout'
import MacroBar from '../components/MacroBar'
import NutritionTargetsSheet from '../components/NutritionTargetsSheet'
import { useClientDetail } from '../hooks/useClientDetail'
import { useRoutines } from '../hooks/useRoutines'
import { useGoals } from '../hooks/useGoals'
import { useDashboard } from '../hooks/useDashboard'
import { useNutritionTargets, useNutritionRange, toLocalISODate } from '../hooks/useNutrition'
import { useTheme } from '../hooks/useTheme'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Sheet, Button, UnitToggle } from '../components/ui'
import { useLang } from '../hooks/useLang'

// Literal hex per palette+theme — CSS vars don't resolve in recharts SVG attrs.
const CHART = {
  'slate-light': { bar: '#3E5C76', grid: '#DDE0E4', axis: '#565C64', cursor: 'rgba(62,92,118,0.10)' },
  'slate-dark':  { bar: '#7FA0BE', grid: '#2F343B', axis: '#9AA0A8', cursor: 'rgba(127,160,190,0.16)' },
  'riso-light':  { bar: '#2438FF', grid: '#D5D2C7', axis: '#67696c', cursor: 'rgba(36,56,255,0.08)' },
  'riso-dark':   { bar: '#6E7BFF', grid: '#26271F', axis: '#A2A096', cursor: 'rgba(110,123,255,0.14)' },
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
  const { t, locale } = useLang()
  return (
    <div style={{ ...CARD, flex: 1, textAlign: 'center', padding: '14px 8px' }}>
      <p style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</p>
    </div>
  )
}

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)

// ── Sección de nutrición del cliente ────────────────────────────────────────
// Plan (objetivos de kcal/macros que fija el entrenador) + seguimiento de lo
// que el cliente registró hoy y en los últimos 7 días.
function NutritionSection({ clientId, clientName, onOpenLog }) {
  const { t, locale } = useLang()
  const { targets, hasCustomTargets, loading, saveTargets } = useNutritionTargets(clientId)
  const [showPlan, setShowPlan] = useState(false)

  const today = toLocalISODate()
  const weekAgoDate = new Date()
  weekAgoDate.setDate(weekAgoDate.getDate() - 6)
  const weekAgo = toLocalISODate(weekAgoDate)
  const { byDay } = useNutritionRange(weekAgo, today, clientId)

  const todayTotals = byDay[today] || { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
  const daysLogged = Object.keys(byDay).length
  const avgKcal = daysLogged > 0
    ? Object.values(byDay).reduce((s, d) => s + d.kcal, 0) / daysLogged
    : 0

  return (
    <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '50ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>{t('Nutrición')}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowPlan(true)} style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {hasCustomTargets ? t('Editar plan') : `+ ${t('Plan')}`}
          </button>
          <button onClick={onOpenLog} style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('Registro →')}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '80px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
      ) : !hasCustomTargets ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '20px 16px' }}>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
            {t('Sin plan de nutrición')}
          </p>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5 }}>
            Define las calorías y macros diarios de {clientName}.
          </p>
        </div>
      ) : (
        <div style={{ ...CARD }}>
          {/* Plan asignado */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
            <p style={MINI_LABEL}>{t('Plan diario')}</p>
            <p className="tnum" style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700 }}>
              {fmt(targets.kcal, locale)} kcal · P {targets.protein_g} · C {targets.carbs_g} · G {targets.fat_g}
            </p>
          </div>

          {/* Hoy vs plan */}
          <p className="tnum" style={{ marginTop: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', color: todayTotals.kcal > targets.kcal ? 'var(--c-action-text)' : 'var(--c-text)' }}>
              {fmt(todayTotals.kcal, locale)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-muted)', marginLeft: '8px' }}>
              / {fmt(targets.kcal, locale)} kcal hoy
            </span>
          </p>
          <div style={{ display: 'flex', gap: '14px' }}>
            <MacroBar label="Proteína" current={todayTotals.protein} target={targets.protein_g} />
            <MacroBar label="Carbos"   current={todayTotals.carbs}   target={targets.carbs_g} />
            <MacroBar label="Grasa"    current={todayTotals.fat}     target={targets.fat_g} />
          </div>

          {/* Últimos 7 días */}
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--c-border-subtle)' }}>
            Últimos 7 días: {daysLogged === 0
              ? 'sin registros'
              : `${daysLogged} ${daysLogged === 1 ? 'día registrado' : 'días registrados'} · prom. ${fmt(avgKcal, locale)} kcal`}
          </p>
        </div>
      )}

      {showPlan && (
        <NutritionTargetsSheet
          targets={targets}
          userId={clientId}
          title="Plan de nutrición"
          subtitle={`Calorías y macros diarios para ${clientName}.`}
          onSave={async (fields) => { await saveTargets(fields); setShowPlan(false) }}
          onClose={() => setShowPlan(false)}
        />
      )}
    </section>
  )
}


// ── Constructor manual de rutinas ───────────────────────────────────────────
// El entrenador arma cada rutina a mano: días, ejercicios, series, reps y
// notas. Nada autogenerado.
function emptyExercise() {
  return { exercise_name: '', sets: '', reps: '', notes: '' }
}
function emptyDay() {
  return { day_name: '', focus: '', exercises: [emptyExercise()] }
}

// Una rutina propia (como la entrega useRoutines) → el estado del constructor.
// Los campos numéricos viajan como texto porque son valores de <input>.
function routineToBuilderDays(routine) {
  const days = (routine.routine_days || []).map(d => ({
    day_name: d.day_name || '',
    focus: d.focus || '',
    exercises: (d.routine_day_exercises || []).map(ex => ({
      exercise_name: ex.exercise_name || '',
      sets: ex.sets == null ? '' : String(ex.sets),
      reps: ex.reps || '',
      notes: ex.notes || '',
    })),
  }))
  // El constructor asume al menos un día con al menos un ejercicio editable.
  return days.length ? days.map(d => ({ ...d, exercises: d.exercises.length ? d.exercises : [emptyExercise()] })) : [emptyDay()]
}

function routineSummary(routine) {
  const days = (routine.routine_days || []).length
  const ex = (routine.routine_days || []).reduce((n, d) => n + (d.routine_day_exercises || []).length, 0)
  return `${routine.type === 'cycle' ? 'Ciclo' : 'Día'} · ${days} ${days === 1 ? 'día' : 'días'} · ${ex} ejercicios`
}

// Constructor de la rutina del cliente.
//
// Empezar de cero está bien para un plan a medida, pero un entrenador rara vez
// escribe desde cero: ya tiene sus ciclos hechos y quiere partir de uno. Por eso
// se puede cargar una rutina PROPIA dentro del constructor —no asignarla de
// golpe— y ajustarla al cliente antes de guardar. Lo que se guarda es una copia
// en la cuenta del cliente: editarla aquí no toca la rutina original.
export function BuildRoutineModal({ clientName, initialType, startPicking = false, onClose, onCreate }) {
  const { t, locale } = useLang()
  // Sin argumento, useRoutines opera sobre el propio entrenador: estas son SUS
  // rutinas, con días y ejercicios ya cargados.
  const { routines: myRoutines, loading: loadingMine } = useRoutines()

  const [type, setType]   = useState(initialType)   // 'cycle' | 'single_day'
  const [name, setName]   = useState('')
  const [days, setDays]   = useState([emptyDay()])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [picking, setPicking] = useState(startPicking)
  const [copiedFrom, setCopiedFrom] = useState(null)

  const isCycle = type === 'cycle'

  // Carga la rutina propia en el constructor y vuelve al formulario. El tipo lo
  // manda la rutina de origen: copiar un ciclo dentro de un formulario de "un
  // día" lo dejaría recortado al primer día sin avisar.
  const loadFromMine = (routine) => {
    setType(routine.type === 'single_day' ? 'single_day' : 'cycle')
    setName(routine.name || '')
    setDays(routineToBuilderDays(routine))
    setCopiedFrom(routine.name)
    setLocalError(null)
    setPicking(false)
  }

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
        // Copiada de una rutina del entrenador, no escrita a mano para este
        // cliente: la tarjeta del cliente lo dirá en vez de llamarla propia.
        source: copiedFrom ? 'shared' : 'manual',
        is_active: false,
        days: builtDays,
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
      setSaving(false)
    }
  }

  // ── Paso: elegir una rutina propia ──────────────────────────────────────
  if (picking) {
    return (
      <Sheet
        title="Mis rutinas"
        subtitle={`Elige una para copiarla a ${clientName}`}
        onClose={onClose}
        maxHeight="88dvh"
      >
        {loadingMine ? (
          <div className="skeleton" aria-hidden="true" style={{ height: '60px', borderRadius: '12px' }} />
        ) : myRoutines.length === 0 ? (
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', textAlign: 'center', padding: '28px 0' }}>
            {t('Todavía no tienes rutinas propias que copiar.')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {myRoutines.map(r => (
              <button
                key={r.id}
                onClick={() => loadFromMine(r)}
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
                  {r.name}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px' }}>
                  {routineSummary(r)}
                </p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setPicking(false)}
          style={{ width: '100%', minHeight: '44px', marginTop: '12px', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {t('Volver al constructor')}
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Crear rutina" subtitle={`Personalizada para ${clientName}`} onClose={onClose}>
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

      {/* Partir de una rutina propia en vez de escribirla de cero. */}
      <button
        onClick={() => setPicking(true)}
        style={{
          width: '100%', minHeight: '44px', padding: '10px 14px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
          borderRadius: '12px', textAlign: 'left',
        }}
        {...pressProps(0.99)}
      >
        <span style={{ color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t(copiedFrom ? 'Elegir otra de mis rutinas' : 'Usar una de mis rutinas')}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--c-action-text)', fontSize: '13px', flexShrink: 0 }}>→</span>
      </button>

      {copiedFrom && (
        <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5, marginBottom: '16px' }}>
          Copiada de «{copiedFrom}». Ajústala para {clientName}: lo que cambies aquí no toca tu rutina.
        </p>
      )}

      {/* Tipo */}
      <p style={MINI_LABEL}>{t('Tipo')}</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[{ v: 'cycle', l: t('Ciclo (varios días)') }, { v: 'single_day', l: t('Un día') }].map(opt => (
          <button
            key={opt.v}
            onClick={() => switchType(opt.v)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              border: `1px solid ${type === opt.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: type === opt.v ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
              color: type === opt.v ? 'var(--c-action-text)' : 'var(--c-text-dim)',
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* Nombre */}
      <p style={MINI_LABEL}>{t('Nombre')}</p>
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
            <p style={{ ...MINI_LABEL, marginBottom: 0 }}>{isCycle ? `${t('Día')} ${di + 1}` : t('Entrenamiento')}</p>
            {isCycle && days.length > 1 && (
              <button onClick={() => removeDay(di)} style={{ color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}>
                {t('Quitar día')}
              </button>
            )}
          </div>

          {/* nombre + enfoque del día */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              className="input-field"
              value={day.day_name}
              onChange={e => updateDay(di, 'day_name', e.target.value)}
              placeholder={isCycle ? t('Nombre (ej: Lunes / Push)') : t('Nombre del día')}
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
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
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
            style={{ color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}
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
        {t(saving ? 'Guardando...' : 'Asignar rutina')}
      </Button>
    </Sheet>
  )
}

// ── Modal: asignar meta ──────────────────────────────────────────────────────
function AssignGoalModal({ clientName, onClose, onCreate }) {
  const { t, locale } = useLang()
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

      <p style={MINI_LABEL}>{t('Tipo de meta')}</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {[
          { v: 'exercise_weight', l: t('Peso en ejercicio') },
          { v: 'days_trained',    l: 'Días/mes' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setType(opt.v)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              border: `1px solid ${type === opt.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: type === opt.v ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
              color: type === opt.v ? 'var(--c-action-text)' : 'var(--c-text-dim)',
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <p style={MINI_LABEL}>{t('Nombre')}</p>
        <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Press banca 100kg" />
      </div>

      {type === 'exercise_weight' && (
        <div style={{ marginBottom: '14px' }}>
          <p style={MINI_LABEL}>{t('Ejercicio')}</p>
          <input className="input-field" value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="Ej: Bench Press" />
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <p style={MINI_LABEL}>{t('Objetivo')}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" style={{ flex: 1 }} />
          {type === 'exercise_weight' && (
            <UnitToggle value={unit} units={['kg', 'lb']} onChange={setUnit} />
          )}
          {type === 'days_trained' && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700 }}>
              {t('días')}
            </div>
          )}
        </div>
      </div>

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {t(saving ? 'Asignando...' : 'Asignar meta')}
      </Button>
    </Sheet>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ClientDetail() {
  const { t, locale } = useLang()
  const { id: clientId } = useParams()
  const navigate = useNavigate()

  const { profile, age, loading: profLoading } = useClientDetail(clientId)
  const { routines, loading: routLoading, createRoutine, deleteRoutine, setActiveRoutine } = useRoutines(clientId)
  const { goals, loading: goalsLoading, createGoal, deleteGoal } = useGoals(clientId)
  const { data: dash } = useDashboard(clientId)
  const { resolved, palette } = useTheme()
  const cc = CHART[`${palette}-${resolved}`] || CHART['slate-light']

  const [modal, setModal] = useState(null) // 'mine' | 'cycle' | 'single' | 'goal'
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
              {[age ? `${age} años` : null, profile?.level, profile?.goal].filter(Boolean).join(' · ') || t('Sin datos de perfil')}
            </p>
          </div>
          <button
            onClick={() => navigate(`/chat/${clientId}`)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
              border: '1px solid var(--c-accent-border)', borderRadius: '10px',
              padding: '8px 12px', fontSize: '11px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
            {...pressProps(0.97)}
          >
            {t('Mensaje')}
          </button>
        </div>

        {actionError && <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{actionError}</div>}

        {/* ── Datos del cliente ────────────────────────────────────── */}
        {(profile?.weight || profile?.height || profile?.sex || profile?.days_per_week) && (
          <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '20ms' }}>
            <p style={SECTION_LABEL}>{t('Datos')}</p>
            <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', rowGap: '12px', padding: '14px 16px' }}>
              {[
                profile?.weight        && { label: t('Peso'),       value: `${profile.weight} ${profile.weight_unit || 'kg'}` },
                profile?.height        && { label: t('Estatura'),   value: `${profile.height} ${profile.height_unit || 'cm'}` },
                profile?.sex           && { label: t('Sexo'),       value: profile.sex },
                profile?.days_per_week && { label: t('Frecuencia'), value: `${profile.days_per_week} ${t('días')}/sem` },
              ].filter(Boolean).map(d => (
                <div key={d.label} style={{ flex: '1 1 50%', minWidth: 0 }}>
                  <p style={{ ...MINI_LABEL, marginBottom: '2px' }}>{d.label}</p>
                  <p className="tnum" style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>{d.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Progreso ─────────────────────────────────────────────── */}
        <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
            <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>{t('Progreso')}</p>
            <button
              onClick={() => navigate(`/coach/cliente/${clientId}/stats`)}
              style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              {t('Estadísticas →')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Stat label="Entrenos" value={dash?.totalWorkouts ?? '—'} />
            <Stat label="Este mes" value={dash?.thisMonth ?? '—'} />
            <Stat label="PRs" value={dash?.bestLifts?.length ?? '—'} />
          </div>

          {dash?.weeklyData?.some(w => w.volume > 0) && (
            <div style={{ ...CARD }}>
              <p style={MINI_LABEL}>{t('Volumen semanal')}</p>
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
              <p style={MINI_LABEL}>{t('Mejores levantamientos')}</p>
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

        {/* ── Nutrición ────────────────────────────────────────────── */}
        <NutritionSection
          clientId={clientId}
          clientName={name}
          onOpenLog={() => navigate(`/coach/cliente/${clientId}/nutricion`)}
        />

        {/* ── Rutinas ──────────────────────────────────────────────── */}
        <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '60ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>{t('Rutinas')}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* La vía corta a lo que el entrenador ya tiene escrito; las otras
                  dos siguen abriendo el constructor en blanco. */}
              <button onClick={() => setModal('mine')} style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ De mis rutinas</button>
              <button onClick={() => setModal('cycle')} style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Ciclo</button>
              <button onClick={() => setModal('single')} style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Día</button>
            </div>
          </div>

          {routLoading ? (
            <div style={{ height: '60px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
          ) : routines.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '12px 0' }}>{t('Sin rutinas. Copia una de las tuyas o crea un ciclo desde cero.')}</p>
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
                            <span style={{ color: 'var(--c-action-text)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>· Activo</span>
                          )}
                          {r.assigned_by && (
                            <span style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700 }}>· Asignada por ti</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        {r.type === 'cycle' && !r.is_active && (
                          <button onClick={() => run(() => setActiveRoutine(r.id))} style={{ color: 'var(--c-action-text)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-accent-border)', padding: '4px 9px', borderRadius: '8px' }}>
                            {t('Activar')}
                          </button>
                        )}
                        <button onClick={() => run(() => deleteRoutine(r.id))} aria-label="Eliminar" style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '2px 4px' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
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
            <p style={{ ...SECTION_LABEL, marginBottom: 0 }}>{t('Metas')}</p>
            <button onClick={() => setModal('goal')} style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Meta</button>
          </div>

          {goalsLoading ? (
            <div style={{ height: '50px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
          ) : goals.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '12px 0' }}>{t('Sin metas asignadas.')}</p>
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
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
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
      {modal === 'mine'   && <BuildRoutineModal clientName={name} initialType="cycle" startPicking onClose={() => setModal(null)} onCreate={createRoutine} />}
      {modal === 'goal'   && <AssignGoalModal   clientName={name}                          onClose={() => setModal(null)} onCreate={createGoal} />}
    </Layout>
  )
}
