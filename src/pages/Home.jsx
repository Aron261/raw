import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import Layout from '../components/Layout'
import { useWorkouts } from '../hooks/useWorkout'
import { useProfile } from '../hooks/useProfile'
import { useGoals } from '../hooks/useGoals'
import { useRoutines, getNextRoutineDay } from '../hooks/useRoutines'
import { useStartRoutineWorkout } from '../hooks/useStartRoutineWorkout'
import { useInvites } from '../hooks/useInvites'
import { useTheme } from '../hooks/useTheme'
import { ERROR_STYLE } from '../lib/ui'
import { Sheet, Field, Button } from '../components/ui'

// Chart colors must be literal hex — CSS vars don't resolve in recharts SVG attrs.
const CHART_COLORS = {
  'slate-light': { axis: '#565C64', bar: '#3E5C76', today: '#1A1D21', empty: '#DDE0E4' },
  'slate-dark':  { axis: '#9AA0A8', bar: '#7FA0BE', today: '#E9EBEE', empty: '#2F343B' },
  'riso-light':  { axis: '#5A584F', bar: '#2438FF', today: '#FF2E7E', empty: '#D5D2C7' },
  'riso-dark':   { axis: '#A2A096', bar: '#6E7BFF', today: '#FF3D86', empty: '#26271F' },
}

// ── Date helpers ─────────────────────────────────────────────────────────
function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Sentence case: "lunes, 2 de junio" → "Lunes, 2 de junio"
const dateStr = (() => {
  const s = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
})()

function getGreeting() {
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
            Sin entrenos registrados esta semana
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
            <div style={{ display: 'flex', gap: '4px' }}>
              {['kg', 'lb'].map(u => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px',
                    fontSize: '11px', fontWeight: 700,
                    background: unit === u ? 'var(--c-surface-2)' : 'transparent',
                    border: `1px solid ${unit === u ? 'var(--c-border)' : 'var(--c-border-subtle)'}`,
                    color: unit === u ? 'var(--c-text)' : 'var(--c-text-dim)',
                    transition: 'all 150ms',
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
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

// ── Highlight rotativo (cambia cada día entre 4 tipos) ────────────────────
function getDayHighlightType() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return dayOfYear % 4
}

// ── Home ──────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { workouts, loading, error, createWorkout, fetchWorkouts } = useWorkouts()
  const { goals, createGoal, deleteGoal } = useGoals()

  const firstName = profile?.name?.split(' ')[0] || ''
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState(false)
  const [startingRoutineWorkout, setStartingRoutineWorkout] = useState(false)
  const [startingCoachId, setStartingCoachId] = useState(null)

  const { activeRoutine, routines } = useRoutines()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()
  const { trainers } = useInvites()
  const { resolved, palette } = useTheme()
  const chartColors = CHART_COLORS[`${palette}-${resolved}`] || CHART_COLORS['slate-light']

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
    const empty = { count: 0, weekVolume: 0, chartData: [], thisMonth: 0, weekPR: null, starLift: null }
    if (!workouts.length) return empty

    const monday = getMondayOfWeek()

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

    const calc1RM = (weight, reps) => {
      if (!weight || !reps || reps <= 0) return 0
      return Math.round(weight * (1 + reps / 30))
    }

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

    // Mejor 1RM de todos los tiempos (starLift)
    const allBest = {}
    workouts.filter(w => w.ended_at).forEach(w => {
      ;(w.workout_exercises || []).forEach(we => {
        const name = we.exercises?.name
        if (!name) return
        ;(we.sets || []).forEach(s => {
          const rm = calc1RM(s.weight, s.reps)
          if (!allBest[name] || rm > allBest[name].rm) {
            allBest[name] = { rm, unit: we.unit }
          }
        })
      })
    })
    const starLift = Object.entries(allBest)
      .map(([name, d]) => ({ exercise: name, ...d }))
      .sort((a, b) => b.rm - a.rm)[0] || null

    return { count: thisWeekWorkouts.length, weekVolume: Math.round(weekVolume), chartData, thisMonth, weekPR, starLift }
  }, [workouts])

  // ── Progreso de metas ─────────────────────────────────────────────────
  const goalProgress = goals.map(goal => {
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
                const rm = (!s.weight || !s.reps) ? 0 : Math.round(s.weight * (1 + s.reps / 30))
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

  // ── Highlight rotativo del día ────────────────────────────────────────
  const highlightType = getDayHighlightType()

  const todayHighlight = useMemo(() => {
    if (!workouts.length) return null
    const _calc1RM = (w, r) => (!w || !r || r <= 0) ? 0 : Math.round(w * (1 + r / 30))
    const finished = workouts.filter(w => w.ended_at)
    if (!finished.length) return null

    const getBestRMMap = (list) => {
      const map = {}
      list.forEach(w => {
        ;(w.workout_exercises || []).forEach(we => {
          const name = we.exercises?.name
          if (!name) return
          ;(we.sets || []).forEach(s => {
            const rm = _calc1RM(s.weight, s.reps)
            if (!map[name] || rm > map[name].rm) map[name] = { rm, unit: we.unit }
          })
        })
      })
      return map
    }

    const fallback0 = () => {
      const best = Object.entries(getBestRMMap(finished))
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.rm - a.rm)[0]
      if (!best) return null
      return {
        label: 'Lift histórico',
        title: best.name,
        value: `${best.rm} ${best.unit}`,
        sub: 'Tu mejor 1RM estimado de todos los tiempos.',
      }
    }

    if (highlightType === 0) return fallback0()

    if (highlightType === 1) {
      const now = new Date()
      const thisMonth = finished.filter(w => {
        const d = new Date(w.started_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      if (!thisMonth.length) return fallback0()
      const freq = {}
      thisMonth.forEach(w => {
        const names = new Set((w.workout_exercises || []).map(we => we.exercises?.name).filter(Boolean))
        names.forEach(n => { freq[n] = (freq[n] || 0) + 1 })
      })
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
      if (!top) return fallback0()
      const n = top[1]
      return {
        label: 'Ejercicio más frecuente',
        title: top[0],
        value: `${n} ${n === 1 ? 'vez' : 'veces'}`,
        sub: `Lo entrenaste ${n} ${n === 1 ? 'vez' : 'veces'} este mes.`,
      }
    }

    if (highlightType === 2) {
      const withVol = finished.map(w => {
        const vol = (w.workout_exercises || []).reduce((s, we) =>
          s + (we.sets || []).reduce((s2, set) => s2 + (set.weight || 0) * (set.reps || 0), 0), 0)
        return { ...w, vol: Math.round(vol) }
      }).filter(w => w.vol > 0).sort((a, b) => b.vol - a.vol)
      const best = withVol[0]
      if (!best) return fallback0()
      const date = new Date(best.started_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
      const fmt = best.vol >= 10000 ? `${(best.vol / 1000).toFixed(1)}k kg` : `${best.vol.toLocaleString()} kg`
      return {
        label: 'Mejor sesión',
        title: best.name,
        value: fmt,
        sub: `Volumen total el ${date}.`,
      }
    }

    if (highlightType === 3) {
      const now = new Date()
      const c30 = new Date(now); c30.setDate(c30.getDate() - 30)
      const c60 = new Date(now); c60.setDate(c60.getDate() - 60)
      const recent = finished.filter(w => new Date(w.started_at) >= c30)
      const prev = finished.filter(w => { const d = new Date(w.started_at); return d >= c60 && d < c30 })
      const recentMap = getBestRMMap(recent)
      const prevMap = getBestRMMap(prev)
      let topGain = null
      Object.entries(recentMap).forEach(([name, { rm }]) => {
        if (!prevMap[name] || prevMap[name].rm === 0) return
        const gain = ((rm - prevMap[name].rm) / prevMap[name].rm) * 100
        if (gain > 0 && (!topGain || gain > topGain.gain)) topGain = { name, gain: Math.round(gain) }
      })
      if (!topGain) return fallback0()
      return {
        label: 'Mayor progreso',
        title: topGain.name,
        value: `+${topGain.gain}%`,
        sub: `Mejoraste un ${topGain.gain}% en los últimos 30 días.`,
      }
    }

    return fallback0()
  }, [workouts, highlightType])

  // ── Helpers visuales ─────────────────────────────────────────────────
  const getMotivation = (pct) => {
    if (pct >= 100) return 'Meta cumplida. Seteá una nueva.'
    if (pct >= 75)  return 'Casi ahí. Un empujón más.'
    if (pct >= 50)  return 'Ya pasaste la mitad. No aflojés.'
    if (pct >= 25)  return 'Buen arranque. Mantené el ritmo.'
    return 'Recién empezando. Cada entreno cuenta.'
  }

  const getMotivationColor = (pct) => {
    if (pct >= 100) return 'var(--c-success)'
    if (pct >= 75)  return 'oklch(65% 0.18 60)'
    return 'var(--c-text-muted)'
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Layout showProfile>
      <div className="w-full px-4 pt-10 pb-10 max-w-[480px] mx-auto md:max-w-none md:px-8 md:py-8">

        {/* ── Header ── */}
        <div className="fade-in flex items-start mb-6 md:mb-8">
          <div className="pr-12 md:pr-0">
            {/* Fecha — eyebrow mono en azul (dato) */}
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-data)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
              {dateStr}
            </p>
            {/* Saludo + nombre — Archivo 900, sentence case para legibilidad */}
            <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
              {getGreeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            {/* Acceso a estadísticas — chip tappable, legible */}
            <button
              onClick={() => navigate('/stats')}
              style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '999px', padding: '7px 14px', fontFamily: 'var(--font-mono)', color: 'var(--c-accent)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'background 150ms, border-color 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-action-dim)'; e.currentTarget.style.borderColor = 'var(--c-action-border)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
            >
              Estadísticas <span aria-hidden="true" style={{ fontSize: '13px' }}>→</span>
            </button>
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                height: '64px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-subtle)',
                borderRadius: '16px',
                opacity: 1 - i * 0.25,
              }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>No pudimos cargar tus entrenos.</span>
            <button
              onClick={fetchWorkouts}
              style={{
                flexShrink: 0,
                color: 'var(--c-accent)', fontSize: '12px', fontWeight: 700,
                border: '1px solid var(--c-accent-border)', borderRadius: '8px',
                padding: '6px 12px', background: 'transparent',
              }}
            >
              Reintentar
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
                Continuar entreno
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
                {startingWorkout ? 'Creando entreno...' : 'Empezar entreno'}
              </button>
            ) : (
              /* Con ciclo activo: opción secundaria para entreno libre */
              <button
                onClick={handleStartWorkout}
                disabled={startingWorkout}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: 'var(--c-text-dim)',
                  border: '1px solid var(--c-border-subtle)',
                  borderRadius: '12px',
                  padding: '11px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  transition: 'opacity 150ms',
                  opacity: startingWorkout ? 0.6 : 1,
                }}
              >
                {startingWorkout ? 'Creando entreno...' : 'Empezar entreno libre'}
              </button>
            )}
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
                background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
                fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
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
              Registra tu primer entreno
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '34ch', margin: '0 auto' }}>
              Anota tus series y Raw te dice al instante si superas tu última marca. Toca «Empezar entreno» arriba.
            </p>
          </div>
        )}

        {/* ── Contenido principal ── */}
        {!loading && !error && workouts.length > 0 && (
          <>
            {/* ── Resumen semanal — el número es el héroe, sin tarjeta ── */}
            <div className="fade-in" style={{ marginBottom: '32px', animationDelay: '40ms' }}>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                Esta semana
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  { value: stats.count, label: stats.count === 1 ? 'entreno' : 'entrenos' },
                  { value: formatVolume(stats.weekVolume), label: 'kg de volumen' },
                  { value: stats.thisMonth, label: 'días este mes' },
                ].map((s, i) => (
                  <div key={s.label} style={{ paddingLeft: i > 0 ? '16px' : 0, borderLeft: i > 0 ? '1px solid var(--c-border-subtle)' : 'none' }}>
                    <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-display)', fontSize: '42px', letterSpacing: '0.01em', lineHeight: 0.9, marginBottom: '8px' }}>
                      {s.value}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 400, letterSpacing: '0.03em', lineHeight: 1.3 }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

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
                      Mejor marca esta semana
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
                      ▲ Nuevo récord
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
                      Superaste tu mejor registro en este ejercicio.
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
                      {todayHighlight.label}
                    </p>
                    <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>
                      {todayHighlight.title}
                    </p>
                    <p className="font-display" style={{ color: 'var(--c-text)', fontSize: '40px', letterSpacing: '0.01em', lineHeight: 0.9, marginBottom: '8px' }}>
                      {todayHighlight.value}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.5 }}>
                      {todayHighlight.sub}
                    </p>
                  </div>
                ) : null}

                {/* ── Metas ── */}
                <div style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)',
                  borderRadius: '16px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Mis metas
                    </p>
                    <button
                      onClick={() => setShowGoalModal(true)}
                      style={{
                        color: 'var(--c-accent)', fontSize: '18px', lineHeight: 1,
                        padding: '0 4px', fontWeight: 300,
                        transition: 'opacity 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      aria-label="Agregar meta"
                      title="Agregar meta"
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
                        Todavía no tienes metas activas.
                      </p>
                      <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 400, lineHeight: 1.5, marginBottom: '14px' }}>
                        Define una meta de fuerza o frecuencia para medir tu progreso real.
                      </p>
                      <button
                        onClick={() => setShowGoalModal(true)}
                        style={{
                          background: 'transparent',
                          color: 'var(--c-accent)',
                          border: '1px solid var(--c-action-border)',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontSize: '11px',
                          fontWeight: 700,
                          transition: 'background 150ms, border-color 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-action-dim)'; e.currentTarget.style.borderColor = 'var(--c-action-border)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-action-border)' }}
                      >
                        Crear meta
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {goalProgress.map(goal => (
                        <div key={goal.id}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Goal label: sentence case, sin uppercase */}
                              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
                                {goal.label}
                              </p>
                              <p style={{ color: getMotivationColor(goal.pct), fontSize: '11px', fontWeight: 500 }}>
                                {getMotivation(goal.pct)}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '2px 4px', marginLeft: '8px', flexShrink: 0, transition: 'color 120ms' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
                              aria-label="Eliminar meta"
                              title="Eliminar meta"
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
                                ? `${goal.current} / ${goal.target_value} días este mes`
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
                  title="Volumen semanal"
                  colors={chartColors}
                />
              </div>

            </div>
          </>
        )}

      </div>

      {/* ── Modal nueva meta ── */}
      {showGoalModal && (
        <GoalModal
          onClose={() => setShowGoalModal(false)}
          onSave={async (data) => { await createGoal(data); setShowGoalModal(false) }}
          exercises={userExercises}
        />
      )}
    </Layout>
  )
}
