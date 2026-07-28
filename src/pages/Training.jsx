import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import Layout from '../components/Layout'
import { useWorkouts } from '../hooks/useWorkout'
import { useProfile } from '../hooks/useProfile'
import { useNutritionDay, useNutritionTargets, toLocalISODate, DEFAULT_TARGETS } from '../hooks/useNutrition'
import { useBodyWeight } from '../hooks/useBodyWeight'
import { useGoals } from '../hooks/useGoals'
import { useRoutines, getNextRoutineDay } from '../hooks/useRoutines'
import { useStartRoutineWorkout } from '../hooks/useStartRoutineWorkout'
import { useInvites } from '../hooks/useInvites'
import { useTheme } from '../hooks/useTheme'
import { useSchedule } from '../hooks/useSchedule'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { ERROR_STYLE, pressable, PRESS_TRANSITION } from '../lib/ui'
import { Sheet, Field, Button, LiveRegion, UndoSnackbar, UnitToggle } from '../components/ui'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import Calendar from '../components/calendar/Calendar'
import DaySheet from '../components/calendar/DaySheet'
import { computeStreak, mondayOf, KINDS } from '../lib/calendar'
import { useLang } from '../hooks/useLang'
import { calc1RM } from '../lib/progress'

// Chart colors must be literal hex — CSS vars don't resolve in recharts SVG attrs.
const CHART_COLORS = {
  'slate-light': { axis: '#565C64', bar: '#3E5C76', today: '#1A1D21', empty: '#DDE0E4' },
  'slate-dark':  { axis: '#9AA0A8', bar: '#7FA0BE', today: '#E9EBEE', empty: '#2F343B' },
  'riso-light':  { axis: '#5A584F', bar: '#2438FF', today: '#FF2E7E', empty: '#D5D2C7' },
  'riso-dark':   { axis: '#A2A096', bar: '#6E7BFF', today: '#FF3D86', empty: '#26271F' },
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Se resuelve en cada render, no al cargar el módulo: la PWA puede quedar
// abierta toda la noche y la portada no puede seguir diciendo "ayer".
// Sentence case: "lunes, 2 de junio" → "Lunes, 2 de junio"
function todayLabel(locale) {
  const s = new Date().toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ── Format volume ─────────────────────────────────────────────────────────
function formatVolume(v) {
  if (!v) return '—'
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

// ── ChartTooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value || 0
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: '8px', padding: '6px 10px',
      fontSize: '10px', fontWeight: 700, color: 'var(--c-text)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    }}>
      {label}: {val > 0 ? `${(val / 1000).toFixed(1)}k kg` : '—'}
    </div>
  )
}

// ── WeeklyChart ───────────────────────────────────────────────────────────
function WeeklyChart({ chartData, height = 150, title, subtitle, colors }) {
  const { t, locale } = useLang()
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px',
      paddingBottom: '12px',
      overflow: 'hidden',
    }}>
      {/* Header interno del chart */}
      {title && (
        <div style={{ padding: '20px 20px 0' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div style={{ paddingTop: title ? '16px' : '20px', paddingLeft: '8px', paddingRight: '8px' }}>
        {chartData.every(d => d.vol === 0) ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-muted)', fontSize: '11px' }}>
            {t('Sin entrenos registrados esta semana')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} barSize={22} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: colors.axis, fontSize: 10, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="vol" radius={[5, 5, 0, 0]}>
                {chartData.map((entry, i) => {
                  const isToday = i === ((new Date().getDay() + 6) % 7)
                  return (
                    <Cell
                      key={i}
                      fill={
                        entry.future
                          ? colors.empty
                          : entry.vol > 0
                            ? (isToday ? colors.today : colors.bar)
                            : colors.empty
                      }
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── GoalModal ─────────────────────────────────────────────────────────────
function GoalModal({ onClose, onSave, exercises = [] }) {
  const [type, setType] = useState('exercise_weight')
  const [label, setLabel] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [targetReps, setTargetReps] = useState('')
  const [unit, setUnit] = useState('kg')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!label.trim() || !targetValue) return
    setSaving(true)
    try {
      await onSave({
        type,
        label: label.trim(),
        exercise_name: type === 'exercise_weight' ? exerciseName || null : null,
        target_value: parseFloat(targetValue),
        target_reps: type === 'exercise_weight' && targetReps ? parseInt(targetReps, 10) : null,
        unit: type === 'days_trained' ? 'días' : unit,
        is_monthly: type === 'days_trained',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Nueva meta" onClose={onClose}>
      <Field label="Tipo de meta">
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { value: 'exercise_weight', label: 'Peso en ejercicio' },
            { value: 'days_trained', label: 'Días entrenados' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: '8px',
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: type === opt.value ? 'var(--c-accent)' : 'var(--c-surface-2)',
                color: type === opt.value ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                border: `1px solid ${type === opt.value ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                transition: 'all 150ms',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nombre de la meta">
        <input
          className="input-field"
          placeholder={type === 'exercise_weight' ? 'Ej: Sentadilla 100kg' : 'Ej: Constancia este mes'}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </Field>

      {type === 'exercise_weight' && (
        <Field label="Ejercicio">
          <select
            className="input-field"
            value={exerciseName}
            onChange={e => setExerciseName(e.target.value)}
          >
            <option value="">— Selecciona un ejercicio —</option>
            {exercises.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label={type === 'days_trained' ? 'Días objetivo (este mes)' : 'Peso objetivo'}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input-field"
            type="number"
            placeholder={type === 'days_trained' ? '20' : '100'}
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
            style={{ flex: 1 }}
          />
          {type === 'exercise_weight' && (
            <UnitToggle value={unit} units={['kg', 'lb']} onChange={setUnit} />
          )}
        </div>
      </Field>

      {type === 'exercise_weight' && (
        <Field label="Reps objetivo" hint="Opcional — vacío = comparar 1RM">
          <input
            className="input-field"
            type="number"
            placeholder="Ej: 5"
            value={targetReps}
            onChange={e => setTargetReps(e.target.value)}
          />
        </Field>
      )}

      <Button
        variant="primary"
        full
        size="lg"
        loading={saving}
        disabled={saving || !label.trim() || !targetValue}
        onClick={handleSave}
        style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : 'Guardar meta'}
      </Button>
    </Sheet>
  )
}

// ── EntrenaHoyCard ────────────────────────────────────────────────────────
// Muestra el próximo día del ciclo activo con CTA para empezar.
function EntrenaHoyCard({ day, routineName, onStart, starting, fromCoach, coachName }) {
  const validExercises = (day?.routine_day_exercises || []).filter(e => e.exercise_name?.trim())
  const exCount = validExercises.length
  const hasExercises = exCount > 0

  return (
    <div style={{
      background: hasExercises ? 'var(--c-action)' : 'var(--c-surface)',
      border: hasExercises ? 'none' : '1px solid var(--c-border-subtle)',
      color: hasExercises ? 'var(--c-on-action)' : 'var(--c-text)',
      borderRadius: '16px',
      padding: '18px',
      marginBottom: '16px',
    }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: hasExercises ? 0.85 : 1, color: hasExercises ? 'var(--c-on-action)' : 'var(--c-action-text)' }}>
          {fromCoach ? `Recomendado por ${coachName || 'tu entrenador'}` : 'Entreno de hoy'}
        </p>
        {fromCoach && (
          <span style={{
            background: hasExercises ? 'var(--c-on-action)' : 'var(--c-action-dim)',
            color: hasExercises ? 'var(--c-action)' : 'var(--c-action-text)',
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 7px', borderRadius: '6px',
          }}>
            Coach
          </span>
        )}
      </div>

      {/* Nombre del día — display */}
      <p className="font-display" style={{ fontSize: '26px', lineHeight: 0.98, marginBottom: '6px', color: hasExercises ? 'var(--c-on-action)' : 'var(--c-text)' }}>
        {day.day_name}
      </p>

      {/* Ciclo activo — siempre visible */}
      <p style={{ fontSize: '11px', fontWeight: 500, marginBottom: '2px', opacity: hasExercises ? 0.85 : 1, color: hasExercises ? 'var(--c-on-action)' : 'var(--c-text-dim)' }}>
        Ciclo activo: {routineName}
      </p>

      {/* Detalle: ejercicios + focus */}
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '14px', opacity: hasExercises ? 0.75 : 1, color: hasExercises ? 'var(--c-on-action)' : 'var(--c-text-muted)' }}>
        {hasExercises
          ? `${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}${day.focus ? ' · ' + day.focus : ''}`
          : 'Sin ejercicios todavía'
        }
      </p>

      <button
        onClick={hasExercises && !starting ? onStart : undefined}
        disabled={!hasExercises || starting}
        style={{
          width: '100%',
          background: hasExercises ? 'var(--c-on-action)' : 'var(--c-surface-2)',
          color: hasExercises ? 'var(--c-action)' : 'var(--c-text-muted)',
          border: hasExercises ? 'none' : '1px solid var(--c-border-subtle)',
          borderRadius: '10px',
          padding: '13px',
          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase',
          cursor: hasExercises && !starting ? 'pointer' : 'default',
          transition: 'opacity 150ms',
          opacity: starting ? 0.6 : 1,
        }}
      >
        {starting ? 'Creando entreno...' : hasExercises ? 'Empezar entreno' : 'Sin ejercicios todavía'}
      </button>
    </div>
  )
}

// ── Chip — un dato vivo que además es el acceso a su sección ─────────────
// Antes había dos componentes casi idénticos (TodayChip y SectionChip) en tres
// filas distintas, y el resultado era un campo de cajitas iguales: justo el
// "dashboard SaaS" que el sistema rechaza. Uno solo, una fila.
function Chip({ label, value, hint, live, index = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="stagger-item"
      style={{
        '--i': index,
        flex: '1 1 30%', minWidth: '96px', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: '4px',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
        borderRadius: '12px', padding: '11px 12px', minHeight: '44px',
        cursor: 'pointer',
        transition: `border-color 150ms var(--ease-out), ${PRESS_TRANSITION}`,
      }}
      {...pressable(0.97, {
        onMouseEnter: e => { e.currentTarget.style.borderColor = 'var(--c-border)' },
        onMouseLeave: e => { e.currentTarget.style.borderColor = 'var(--c-border-subtle)' },
      })}
    >
      <span style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px',
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {live && <span className="live-dot" aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--c-action)', flexShrink: 0 }} />}
        {label}
      </span>
      <span style={{
        color: hint ? 'var(--c-text-muted)' : 'var(--c-text)',
        fontSize: hint ? '11px' : '15px',
        fontWeight: hint ? 500 : 800,
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {hint || value}
      </span>
    </button>
  )
}

// ── Helpers visuales de metas ────────────────────────────────────────────
function getMotivation(pct) {
  if (pct >= 100) return 'Meta cumplida. Crea una nueva.'
  if (pct >= 75)  return 'Ya casi. Te falta poco.'
  if (pct >= 50)  return 'Vas por la mitad. Sigue así.'
  if (pct >= 25)  return 'Buen arranque. Mantén el ritmo.'
  return 'Apenas empiezas. Suma tu próximo entreno.'
}

// On-palette + AA in every theme: success green at 100%, muted otherwise.
// (No off-system amber; the % badge and bar already encode the tier.)
const getMotivationColor = (pct) => (pct >= 100 ? 'var(--c-success)' : 'var(--c-text-muted)')

// ── Metas ────────────────────────────────────────────────────────────────
// Vive fuera del bloque "hay entrenos": definir una meta es justo lo que hace
// alguien que todavía no ha registrado nada, y antes estaba fuera de alcance.
function GoalsCard({ goals, onAdd, onDelete }) {
  const { t, locale } = useLang()
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('Mis metas')}
        </p>
        <button
          onClick={onAdd}
          style={{
            color: 'var(--c-action-text)', fontSize: '22px', lineHeight: 1, fontWeight: 300,
            minWidth: '44px', minHeight: '44px', margin: '-11px -10px -11px 0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          aria-label={t('Agregar meta')}
          title={t('Agregar meta')}
        >
          +
        </button>
      </div>

      {goals.length === 0 ? (
        /* Empty state humanizado */
        <div style={{
          background: 'var(--c-surface-2)',
          borderRadius: '12px',
          padding: '18px 16px',
        }}>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            {t('Todavía no tienes metas activas.')}
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 400, lineHeight: 1.5, marginBottom: '14px' }}>
            {t('Define una meta de fuerza o frecuencia para medir tu progreso real.')}
          </p>
          <button
            onClick={onAdd}
            style={{
              background: 'transparent',
              color: 'var(--c-action-text)',
              border: '1px solid var(--c-action-border)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '11px',
              fontWeight: 700,
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-action-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {t('Crear meta')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {goals.map(goal => (
            <div key={goal.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Goal label: sentence case, sin uppercase */}
                  <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
                    {goal.label}
                  </p>
                  <p style={{ color: getMotivationColor(goal.pct), fontSize: '11px', fontWeight: 500 }}>
                    {t(getMotivation(goal.pct))}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(goal)}
                  style={{ color: 'var(--c-text-muted)', fontSize: '13px', minWidth: '44px', minHeight: '44px', margin: '-12px -10px -12px 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 120ms' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
                  aria-label={`${t('Eliminar')}: ${goal.label}`}
                  title={t('Eliminar')}
                >
                  ✕
                </button>
              </div>
              {/* Barra de progreso */}
              <div
                style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', marginBottom: '6px', overflow: 'hidden' }}
                role="progressbar"
                aria-valuenow={goal.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={goal.label}
              >
                <div style={{
                  height: '100%',
                  width: '100%',
                  transformOrigin: 'left center',
                  transform: `scaleX(${goal.pct / 100})`,
                  background: goal.pct >= 100 ? 'var(--c-record)' : 'var(--c-action)',
                  borderRadius: '999px',
                  transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500 }}>
                  {goal.type === 'days_trained'
                    ? `${goal.current} / ${goal.target_value} ${t('días este mes')}`
                    : goal.target_reps
                      ? `${goal.current} / ${goal.target_value} ${goal.unit} × ${goal.target_reps} reps`
                      : `${goal.current} / ${goal.target_value} ${goal.unit} (1RM est.)`
                  }
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: goal.pct >= 100 ? 'var(--c-success)' : 'var(--c-text-dim)' }}>
                  {goal.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hoy — la portada de la app ───────────────────────────────────────────
// El estado de hoy arriba (entreno en curso / entreno de hoy), los números de
// la semana en medio y la señal ganada (PR) al lado. Nutrición y peso apare-
// cen como una línea de hoy: son de otras secciones, pero son de hoy.
export default function Training() {
  const navigate = useNavigate()
  const { t, locale } = useLang()
  const { workouts, loading, error, createWorkout, fetchWorkouts } = useWorkouts()
  const { goals, createGoal, deleteGoal } = useGoals()
  const { profile } = useProfile()
  const firstName = profile?.name?.split(' ')[0] || ''
  const { totals: nutritionTotals } = useNutritionDay(toLocalISODate())
  const { targets: nutritionTargets } = useNutritionTargets()
  const { latestLog: latestWeight } = useBodyWeight()

  const { sessions, createSession, updateSession, deleteSession } = useSchedule()
  const { counts: unreadMap } = useUnreadCounts()

  const [selectedDay, setSelectedDay] = useState(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState(false)
  const [startingRoutineWorkout, setStartingRoutineWorkout] = useState(false)
  const [startingCoachId, setStartingCoachId] = useState(null)

  // Undoable goal delete (shared primitive) — hides optimistically, commits
  // after a grace window, announces state to screen readers.
  const goalDelete = useUndoableDelete(goal => deleteGoal(goal.id))

  const { activeRoutine, routines } = useRoutines()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()
  const { trainers } = useInvites()
  const { resolved, palette } = useTheme()
  const chartColors = CHART_COLORS[`${palette}-${resolved}`] || CHART_COLORS['slate-light']

  const kcalToday = Math.round(nutritionTotals?.kcal || 0)
  const kcalTarget = nutritionTargets?.kcal || DEFAULT_TARGETS.kcal

  // Mapa id_entrenador → nombre, para mostrar quién asignó cada rutina.
  const trainerNameById = Object.fromEntries(
    (trainers || []).map(t => [t.trainerId, t.profile?.name])
  )
  const coachName = (assignedBy) => trainerNameById[assignedBy] || 'tu entrenador'

  // Rutinas de un día asignadas por el entrenador (con ejercicios), para
  // mostrarlas y poder empezarlas directamente desde Inicio.
  const coachSingleDays = (routines || []).filter(r =>
    r.type === 'single_day' && r.assigned_by &&
    (r.routine_days?.[0]?.routine_day_exercises || []).some(e => e.exercise_name?.trim())
  )

  // Empezar una rutina de un día asignada por el coach
  const handleStartCoachDay = async (routine) => {
    if (startingCoachId) return
    const day = (routine.routine_days || [])[0]
    if (!day) return
    setStartingCoachId(routine.id)
    try {
      const workout = await startWorkoutFromRoutineDay({
        routineId: routine.id,
        routineDayId: day.id,
        routineName: routine.name,
        day,
      })
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Error al iniciar entreno del coach:', err)
    } finally {
      setStartingCoachId(null)
    }
  }

  // Entreno en curso: sin ended_at
  const activeWorkout = useMemo(() => workouts.find(w => !w.ended_at) || null, [workouts])

  // Ciclo activo válido: debe ser type=cycle e is_active=true
  const activeCycle = (activeRoutine?.type === 'cycle' && activeRoutine?.is_active === true)
    ? activeRoutine : null

  // Siguiente día del ciclo activo
  const nextDay = useMemo(
    () => activeCycle ? getNextRoutineDay(activeCycle, workouts) : null,
    [activeCycle, workouts]
  )

  // Mostrar tarjeta de ciclo: sin entreno en curso + ciclo válido + día disponible
  const showCycleCard = !activeWorkout && activeCycle && nextDay

  // CTA libre — guard contra doble click
  const handleStartWorkout = async () => {
    if (startingWorkout) return
    if (activeWorkout) {
      navigate(`/workout/${activeWorkout.id}`)
      return
    }
    setStartingWorkout(true)
    try {
      const workout = await createWorkout()
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Error al iniciar entreno:', err)
    } finally {
      setStartingWorkout(false)
    }
  }

  // CTA desde ciclo activo — guard contra doble click + validar ejercicios
  const handleStartRoutineWorkout = async () => {
    if (startingRoutineWorkout) return
    if (!activeCycle || !nextDay) return
    const hasExercises = (nextDay.routine_day_exercises || []).some(e => e.exercise_name?.trim())
    if (!hasExercises) return
    setStartingRoutineWorkout(true)
    try {
      const workout = await startWorkoutFromRoutineDay({
        routineId: activeCycle.id,
        routineDayId: nextDay.id,
        routineName: activeCycle.name,
        day: nextDay,
      })
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Error al iniciar entreno de rutina:', err)
    } finally {
      setStartingRoutineWorkout(false)
    }
  }

  // Ejercicios únicos del usuario (para el select del GoalModal)
  const userExercises = useMemo(() => {
    const names = new Set()
    workouts.forEach(w =>
      (w.workout_exercises || []).forEach(we => {
        if (we.exercises?.name) names.add(we.exercises.name)
      })
    )
    return [...names].sort()
  }, [workouts])

  // ── Stats + PR + starLift ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const empty = { count: 0, weekVolume: 0, chartData: [], thisMonth: 0, weekPR: null }
    if (!workouts.length) return empty

    const monday = mondayOf(new Date())

    const thisWeekWorkouts = workouts.filter(w => w.ended_at && new Date(w.started_at) >= monday)
    const previousWorkouts = workouts.filter(w => w.ended_at && new Date(w.started_at) < monday)

    const now = new Date()
    const thisMonth = workouts.filter(w => {
      if (!w.ended_at) return false
      const d = new Date(w.started_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    // Volumen semanal — normalizado a kg
    let weekVolume = 0
    for (const w of thisWeekWorkouts) {
      for (const we of w.workout_exercises || []) {
        const factor = we.unit === 'lb' ? 0.453592 : 1
        for (const s of we.sets || []) {
          weekVolume += (s.weight || 0) * (s.reps || 0) * factor
        }
      }
    }

    // Volumen por día (Lun–Dom)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const chartData = DAY_LABELS.map((day, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const isFuture = date > today
      if (isFuture) return { day, vol: 0, future: true }

      const dayWorkouts = workouts.filter(w => {
        const d = new Date(w.started_at)
        d.setHours(0, 0, 0, 0)
        return d.getTime() === date.getTime()
      })
      const vol = dayWorkouts.reduce((sum, w) =>
        sum + (w.workout_exercises || []).reduce((s2, we) => {
          const factor = we.unit === 'lb' ? 0.453592 : 1
          return s2 + (we.sets || []).reduce((s3, s) => s3 + (s.weight || 0) * (s.reps || 0) * factor, 0)
        }, 0), 0)
      return { day, vol, future: false }
    })

    // Mejor 1RM histórico por ejercicio (antes de esta semana)
    const historicBest = {}
    previousWorkouts.forEach(w => {
      ;(w.workout_exercises || []).forEach(we => {
        const name = we.exercises?.name
        if (!name) return
        ;(we.sets || []).forEach(s => {
          const rm = calc1RM(s.weight, s.reps)
          if (rm > (historicBest[name] || 0)) historicBest[name] = rm
        })
      })
    })

    // Mejor 1RM esta semana por ejercicio
    const weekBest = {}
    thisWeekWorkouts.forEach(w => {
      ;(w.workout_exercises || []).forEach(we => {
        const name = we.exercises?.name
        if (!name) return
        ;(we.sets || []).forEach(s => {
          const rm = calc1RM(s.weight, s.reps)
          if (!weekBest[name] || rm > weekBest[name].rm) {
            weekBest[name] = { rm, weight: s.weight, reps: s.reps, unit: we.unit }
          }
        })
      })
    })

    // PR: 1RM esta semana supera histórico previo
    let weekPR = null
    Object.entries(weekBest).forEach(([name, data]) => {
      const isNew = data.rm > (historicBest[name] || 0)
      if (isNew && (!weekPR || data.rm > weekPR.rm)) {
        weekPR = { exercise: name, ...data }
      }
    })

    return { count: thisWeekWorkouts.length, weekVolume: Math.round(weekVolume), chartData, thisMonth, weekPR }
  }, [workouts])

  // ── Calendario: racha y próximo plan ──────────────────────────────────
  // La racha cuenta semanas seguidas entrenadas (no días): es la señal honesta
  // de constancia en fuerza, donde no se entrena todos los días.
  const streak = useMemo(() => computeStreak(workouts), [workouts])

  const todayISO = toLocalISODate()
  const nextPlanned = useMemo(
    () => sessions
      .filter(s => s.date >= todayISO && s.status === 'planned')
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null,
    [sessions, todayISO]
  )

  // Entrenos y planes del día abierto en la hoja.
  const selectedISO = selectedDay ? toLocalISODate(selectedDay) : null
  const dayWorkouts = useMemo(
    () => !selectedISO ? [] : workouts.filter(
      w => w.ended_at && toLocalISODate(new Date(w.started_at)) === selectedISO
    ),
    [workouts, selectedISO]
  )
  const daySessions = useMemo(
    () => !selectedISO ? [] : sessions.filter(s => s.date === selectedISO),
    [sessions, selectedISO]
  )

  // Mensajes sin leer — el único dato de Coach que merece sitio en la portada.
  const unread = useMemo(
    () => Object.values(unreadMap || {}).reduce((a, b) => a + b, 0),
    [unreadMap]
  )

  // ── Progreso de metas ─────────────────────────────────────────────────
  // Hide any goal awaiting an undoable delete so it vanishes optimistically.
  const goalProgress = goals.filter(g => g.id !== goalDelete.pending?.id).map(goal => {
    if (goal.type === 'days_trained') {
      const current = stats.thisMonth || 0
      const pct = Math.min(100, Math.round((current / goal.target_value) * 100))
      return { ...goal, current, pct }
    }
    if (goal.type === 'exercise_weight') {
      const hasRepsTarget = goal.target_reps && goal.target_reps > 0
      let best = 0

      workouts.filter(w => w.ended_at).forEach(w => {
        ;(w.workout_exercises || []).forEach(we => {
          if (we.exercises?.name?.toLowerCase() === goal.exercise_name?.toLowerCase()) {
            ;(we.sets || []).forEach(s => {
              if (hasRepsTarget) {
                // Modo reps: mejor peso real donde reps >= objetivo
                if ((s.reps || 0) >= goal.target_reps && (s.weight || 0) > best) {
                  best = s.weight
                }
              } else {
                // Modo 1RM estimado (Epley)
                const rm = calc1RM(s.weight, s.reps)
                if (rm > best) best = rm
              }
            })
          }
        })
      })

      const pct = Math.min(100, Math.round((best / goal.target_value) * 100))
      return { ...goal, current: best, pct }
    }
    return { ...goal, current: 0, pct: 0 }
  })

  // ── Señal ganada, cuando no hay PR de la semana ───────────────────────
  // Antes esto rotaba entre cuatro tarjetas según el día del año: la portada
  // cambiaba de tema sola y nadie podía volver al dato que vio ayer. Ahora hay
  // una sola pregunta con una respuesta estable — ¿en qué estás mejorando? —, y
  // si todavía no hay dos ventanas que comparar, tu mejor lift de siempre.
  const todayHighlight = useMemo(() => {
    const finished = workouts.filter(w => w.ended_at)
    if (!finished.length) return null

    const bestRMMap = (list) => {
      const map = {}
      list.forEach(w => {
        ;(w.workout_exercises || []).forEach(we => {
          const name = we.exercises?.name
          if (!name) return
          ;(we.sets || []).forEach(s => {
            const rm = calc1RM(s.weight, s.reps)
            if (!map[name] || rm > map[name].rm) map[name] = { rm, unit: we.unit }
          })
        })
      })
      return map
    }

    // 1) Mayor progreso: últimos 30 días contra los 30 anteriores.
    const now = new Date()
    const c30 = new Date(now); c30.setDate(c30.getDate() - 30)
    const c60 = new Date(now); c60.setDate(c60.getDate() - 60)
    const recentMap = bestRMMap(finished.filter(w => new Date(w.started_at) >= c30))
    const prevMap = bestRMMap(finished.filter(w => {
      const d = new Date(w.started_at)
      return d >= c60 && d < c30
    }))

    let topGain = null
    Object.entries(recentMap).forEach(([name, { rm }]) => {
      if (!prevMap[name] || prevMap[name].rm === 0) return
      const gain = ((rm - prevMap[name].rm) / prevMap[name].rm) * 100
      if (gain > 0 && (!topGain || gain > topGain.gain)) topGain = { name, gain: Math.round(gain) }
    })
    if (topGain) {
      return {
        label: 'Mayor progreso',
        title: topGain.name,
        value: `+${topGain.gain}%`,
        sub: `Mejoraste un ${topGain.gain}% en los últimos 30 días.`,
      }
    }

    // 2) Sin comparación posible todavía: el mejor 1RM estimado de siempre.
    const best = Object.entries(bestRMMap(finished))
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.rm - a.rm)[0]
    if (!best) return null
    return {
      label: 'Mejor levantamiento',
      title: best.name,
      value: `${best.rm} ${best.unit}`,
      sub: 'Tu mejor 1RM estimado de todos los tiempos.',
    }
  }, [workouts])

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="w-full px-4 pt-10 pb-10 max-w-[480px] mx-auto md:max-w-none md:px-8 md:py-8">

        {/* ── Header — esta es la portada de la app: la fecha y el saludo,
            no un título de sección. Ni Progreso ni Perfil tienen acceso aquí:
            los dos son pestaña de la barra inferior. ── */}
        <div className="fade-in flex items-start mb-6 md:mb-8">
          <div style={{ minWidth: 0 }}>
            {/* Fecha — eyebrow mono en azul (dato) */}
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-data)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
              {todayLabel(locale)}
            </p>
            <h1 className="text-[30px] md:text-[36px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
              {t(greetingKey())}{firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
        </div>

        {/* ── Loading skeleton — mismo orden que el contenido real: CTA ·
            resumen (2 números) · fila de chips · gráfico. Antes prometía tres
            números y ningún chip, así que la página saltaba al cargar. ── */}
        {loading && (
          <div aria-hidden="true" style={{ marginBottom: '24px' }}>
            {/* CTA */}
            <div className="skeleton" style={{ height: '56px', borderRadius: '14px', marginBottom: '28px' }} />
            {/* Resumen semanal: eyebrow + 2 números */}
            <div className="skeleton" style={{ height: '10px', width: '96px', borderRadius: '6px', marginBottom: '16px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {[...Array(2)].map((_, i) => (
                <div key={i}>
                  <div className="skeleton" style={{ height: '38px', borderRadius: '10px', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ height: '8px', width: '70%', borderRadius: '6px' }} />
                </div>
              ))}
            </div>
            {/* Fila de chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ flex: 1, height: '60px', borderRadius: '12px' }} />
              ))}
            </div>
            {/* Gráfico */}
            <div className="skeleton" style={{ height: '210px', borderRadius: '16px' }} />
          </div>
        )}

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{t('No pudimos cargar tus entrenos.')}</span>
            <button
              onClick={fetchWorkouts}
              style={{
                flexShrink: 0,
                color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700,
                border: '1px solid var(--c-accent-border)', borderRadius: '8px',
                padding: '6px 12px', background: 'transparent',
              }}
            >
              {t('Reintentar')}
            </button>
          </div>
        )}

        {/* ── CTA principal ── */}
        {!loading && !error && (
          <div style={{ marginBottom: '20px' }}>
            {/* Si hay ciclo activo: tarjeta con el día sugerido */}
            {showCycleCard && (
              <EntrenaHoyCard
                day={nextDay}
                routineName={activeCycle.name}
                onStart={handleStartRoutineWorkout}
                starting={startingRoutineWorkout}
                fromCoach={!!activeCycle.assigned_by}
                coachName={coachName(activeCycle.assigned_by)}
              />
            )}

            {/* Botón de acción principal */}
            {activeWorkout ? (
              /* Continuar entreno en curso */
              <button
                onClick={handleStartWorkout}
                disabled={startingWorkout}
                style={{
                  width: '100%',
                  background: 'var(--c-surface)',
                  color: 'var(--c-action-text)',
                  border: '2px solid var(--c-action)',
                  borderRadius: '14px',
                  padding: '16px',
                  fontFamily: 'var(--font-sans)', fontSize: '14px',
                  fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  transition: 'opacity 150ms',
                  opacity: startingWorkout ? 0.6 : 1,
                }}
              >
                {t('Continuar entreno')}
              </button>
            ) : !showCycleCard ? (
              /* Sin ciclo activo: empezar entreno libre */
              <button
                onClick={handleStartWorkout}
                disabled={startingWorkout}
                style={{
                  width: '100%',
                  background: 'var(--c-accent)',
                  color: 'var(--c-on-action)',
                  border: '2px solid transparent',
                  borderRadius: '14px',
                  padding: '16px',
                  fontFamily: 'var(--font-sans)', fontSize: '14px',
                  fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  transition: 'opacity 150ms',
                  opacity: startingWorkout ? 0.6 : 1,
                }}
              >
                {startingWorkout ? t('Creando entreno...') : t('Empezar entreno')}
              </button>
            ) : (
              /* Con ciclo activo la tarjeta ya es el CTA; el entreno libre baja
                 a enlace para no ser un tercer botón compitiendo con ella. */
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleStartWorkout}
                  disabled={startingWorkout}
                  style={{
                    background: 'transparent',
                    color: 'var(--c-text-dim)',
                    border: 'none',
                    minHeight: '44px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    transition: 'opacity 150ms, color 150ms',
                    opacity: startingWorkout ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
                >
                  {startingWorkout ? t('Creando entreno...') : t('Empezar entreno libre')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Resumen — los números de la semana y la fila de un vistazo.
            Sube por encima del calendario: en el gimnasio lo primero que se
            busca después del CTA es "¿cómo voy?", no planear el mes. ── */}
        {!loading && !error && (
          <div className="fade-in" style={{ marginBottom: '28px', animationDelay: '40ms' }}>
            {workouts.length > 0 && (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                  {t('Esta semana')}
                </p>
                {/* Antes eran dos cifras de 42px lado a lado, y una tercera de
                    40px en la tarjeta de al lado: tres cosas empatadas a héroe,
                    que es lo mismo que no tener ninguno. Manda una —los entrenos
                    de esta semana, la señal honesta de constancia— y el resto
                    baja un escalón. El volumen ya vive en su propio gráfico. */}
                <p
                  className="rise-in"
                  style={{
                    color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900,
                    fontSize: '56px', letterSpacing: '-0.045em', lineHeight: 0.85,
                    fontVariantNumeric: 'tabular-nums', marginBottom: '6px',
                    animationDelay: '60ms',
                  }}
                >
                  {stats.count}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 400, letterSpacing: '0.03em', lineHeight: 1.3 }}>
                  {t(stats.count === 1 ? 'entreno' : 'entrenos')}
                </p>

                {/* El mes es contexto del dato de arriba, no un segundo titular. */}
                <p style={{
                  marginTop: '12px', paddingTop: '10px',
                  borderTop: '1px solid var(--c-border-subtle)',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 400,
                  color: 'var(--c-text-muted)', letterSpacing: '0.02em',
                }}>
                  <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{stats.thisMonth}</span>
                  {' '}{t('días este mes')}
                </p>
              </>
            )}

            {/* Una sola fila de chips. Cada uno es un dato vivo y, a la vez, la
                entrada a la sección donde vive — Nutrición y Perfil ya no
                necesitan una fila de accesos aparte. */}
            <nav
              aria-label="Resumen de hoy"
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '8px',
                marginTop: workouts.length > 0 ? '20px' : 0,
              }}
            >
              <Chip
                index={0}
                label={t('racha')}
                value={streak > 0 ? `${streak} ${t(streak === 1 ? 'semana' : 'semanas')}` : '—'}
                hint={streak > 0 ? null : t('Entrena esta semana')}
                onClick={() => navigate('/progreso')}
              />
              <Chip
                index={1}
                label={t('kcal hoy')}
                value={kcalToday > 0 ? `${kcalToday.toLocaleString(locale)} / ${kcalTarget.toLocaleString(locale)}` : '—'}
                hint={kcalToday > 0 ? null : t('Registra tu comida')}
                onClick={() => navigate('/nutrition')}
              />
              <Chip
                index={2}
                label={t('peso corporal')}
                value={latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : '—'}
                hint={latestWeight ? null : t('Aún sin registrar')}
                onClick={() => navigate('/profile?s=caracteristicas')}
              />
              {profile?.is_trainer && (
                <Chip
                  index={3}
                  label={t('coach')}
                  live={unread > 0}
                  value={unread > 0 ? `${unread} ${t('sin leer')}` : t('Tus clientes')}
                  onClick={() => navigate('/coach')}
                />
              )}
            </nav>
          </div>
        )}

        {/* ── Rutinas de un día asignadas por el entrenador ── */}
        {!loading && !error && coachSingleDays.length > 0 && (
          <section className="fade-in" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {[...new Set(coachSingleDays.map(r => r.assigned_by))].length === 1
                  ? `De ${coachName(coachSingleDays[0].assigned_by)}`
                  : 'De tu entrenador'}
              </p>
              <span style={{
                background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
                fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--c-accent-border)',
              }}>
                Coach
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {coachSingleDays.map(routine => {
                const day = (routine.routine_days || [])[0]
                const exCount = (day?.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length
                const starting = startingCoachId === routine.id
                return (
                  <div key={routine.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    background: 'var(--c-surface)', border: '1px solid var(--c-accent-border)',
                    borderRadius: '14px', padding: '14px 16px',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {routine.name}
                      </p>
                      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                        {exCount} {exCount === 1 ? 'ejercicio' : 'ejercicios'}
                        {day?.focus ? ` · ${day.focus}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartCoachDay(routine)}
                      disabled={starting}
                      style={{
                        flexShrink: 0,
                        background: 'var(--c-accent)', color: 'var(--c-on-action)',
                        border: 'none', borderRadius: '10px', padding: '10px 16px',
                        fontSize: '11px', fontWeight: 800, letterSpacing: '-0.01em',
                        opacity: starting ? 0.6 : 1, transition: 'opacity 150ms',
                      }}
                    >
                      {starting ? 'Creando...' : 'Empezar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Empty state — first run ── */}
        {!loading && !error && workouts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              {t('Registra tu primer entreno')}
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '34ch', margin: '0 auto' }}>
              {t('Anota tus series y Raw te dice al instante si superas tu última marca. Toca «Empezar entreno» arriba.')}
            </p>
          </div>
        )}

        {/* ── Contenido principal ── */}
        {!loading && !error && workouts.length > 0 && (
          <>
            {/* Grid: gráfico (izq) · señal ganada + metas (der) */}
            <div className="md:grid md:grid-cols-[1fr_360px] md:gap-x-6 md:items-start">

              {/* ── Columna derecha: señal ganada (PR o highlight) + Metas ── */}
              <div
                className="fade-in md:col-start-2 md:row-start-1"
                style={{ animationDelay: '60ms', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
              >

                {/* ── Señal ganada: PR de la semana, o highlight si no hay PR ── */}
                {stats.weekPR ? (
                  <div style={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-subtle)',
                    borderTop: '3px solid var(--c-record)',
                    borderRadius: '16px',
                    padding: '20px',
                  }}>
                    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                      {t('Mejor marca esta semana')}
                    </p>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: 'var(--c-record)',
                      color: 'var(--c-record-ink)',
                      borderRadius: '6px',
                      padding: '4px 9px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      marginBottom: '10px',
                    }}>
                      ▲ {t('Nuevo récord')}
                    </span>
                    <p className="font-display" style={{ color: 'var(--c-text)', fontSize: '24px', lineHeight: 1, marginBottom: '8px' }}>
                      {stats.weekPR.exercise}
                    </p>
                    <p style={{ color: 'var(--c-text-dim)', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
                      {stats.weekPR.weight} × {stats.weekPR.reps} reps
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, marginBottom: '10px' }}>
                      1RM estimado:{' '}
                      <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
                        {stats.weekPR.rm} {stats.weekPR.unit === 'lb' ? 'lb' : 'kg'}
                      </span>
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, borderTop: '1px solid var(--c-border-subtle)', paddingTop: '10px', lineHeight: 1.5 }}>
                      {t('Superaste tu mejor registro en este ejercicio.')}
                    </p>
                  </div>
                ) : todayHighlight ? (
                  <div style={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-subtle)',
                    borderRadius: '16px',
                    padding: '20px',
                  }}>
                    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                      {t(todayHighlight.label)}
                    </p>
                    <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>
                      {todayHighlight.title}
                    </p>
                    <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '32px', letterSpacing: '-0.04em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums', marginBottom: '8px' }}>
                      {todayHighlight.value}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.5 }}>
                      {todayHighlight.sub}
                    </p>
                  </div>
                ) : null}

                <GoalsCard
                  goals={goalProgress}
                  onAdd={() => setShowGoalModal(true)}
                  onDelete={goal => goalDelete.request(goal, {
                    deletedMsg: `Meta «${goal.label}» eliminada. Toca deshacer para recuperarla.`,
                    restoredMsg: `Meta «${goal.label}» restaurada.`,
                  })}
                />

              </div>
              {/* fin columna derecha */}

              {/* ── Gráfico semanal — col 1 ── */}
              <div
                className="fade-in md:col-start-1 md:row-start-1 mb-4 md:mb-0"
                style={{ animationDelay: '100ms' }}
              >
                <WeeklyChart
                  chartData={stats.chartData}
                  height={160}
                  title={t('Volumen semanal')}
                  subtitle={`${formatVolume(stats.weekVolume)} kg · ${t('Esta semana').toLowerCase()}`}
                  colors={chartColors}
                />
              </div>

            </div>
          </>
        )}

        {/* ── Metas sin entrenos todavía ──
            Definir una meta es justo lo que hace quien aún no ha registrado
            nada; antes la tarjeta estaba dentro del bloque "hay entrenos" y
            por tanto era inalcanzable en el primer uso. */}
        {!loading && !error && workouts.length === 0 && (
          <div className="fade-in" style={{ marginBottom: '20px', animationDelay: '60ms' }}>
            <GoalsCard
              goals={goalProgress}
              onAdd={() => setShowGoalModal(true)}
              onDelete={goal => goalDelete.request(goal, {
                deletedMsg: `Meta «${goal.label}» eliminada. Toca deshacer para recuperarla.`,
                restoredMsg: `Meta «${goal.label}» restaurada.`,
              })}
            />
          </div>
        )}

        {/* ── Calendario — lo planeado y lo hecho sobre la misma rejilla.
            Baja por debajo de los números: planear el mes es una tarea de
            sofá, no de gimnasio, y ocupaba una pantalla entera antes del
            primer dato. ── */}
        {!loading && !error && (
          <section className="fade-in" style={{ marginBottom: '20px', animationDelay: '120ms' }}>
            <Calendar
              workouts={workouts}
              sessions={sessions}
              routines={routines}
              onSelectDay={setSelectedDay}
            />

            {/* Lo que viene — la entrada a planear un día concreto. */}
            <div style={{ display: 'flex', alignItems: 'stretch', marginTop: '10px' }}>
              <Chip
                label={t('próximo')}
                value={nextPlanned ? (nextPlanned.title || KINDS[nextPlanned.kind]?.label || '—') : '—'}
                hint={nextPlanned ? null : t('Toca un día para planear')}
                onClick={() => setSelectedDay(
                  nextPlanned ? new Date(`${nextPlanned.date}T00:00:00`) : new Date()
                )}
              />
            </div>
          </section>
        )}

      </div>

      {/* ── Hoja del día del calendario ── */}
      {selectedDay && (
        <DaySheet
          date={selectedDay}
          workouts={dayWorkouts}
          sessions={daySessions}
          routines={routines}
          onCreate={createSession}
          onUpdate={updateSession}
          onDelete={deleteSession}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* ── Modal nueva meta ── */}
      {showGoalModal && (
        <GoalModal
          onClose={() => setShowGoalModal(false)}
          onSave={async (data) => { await createGoal(data); setShowGoalModal(false); goalDelete.setLiveMsg(`Meta «${data.label}» creada.`) }}
          exercises={userExercises}
        />
      )}

      {/* ── Feedback compartido: región viva + snackbar de deshacer ── */}
      <LiveRegion>{goalDelete.liveMsg}</LiveRegion>
      <UndoSnackbar show={!!goalDelete.pending} message="Meta eliminada" onUndo={goalDelete.undo} />
    </Layout>
  )
}
