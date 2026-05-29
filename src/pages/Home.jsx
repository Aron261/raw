import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import Layout from '../components/Layout'
import { useWorkouts } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useGoals } from '../hooks/useGoals'
import { ERROR_STYLE } from '../lib/ui'

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

const dateStr = new Date().toLocaleDateString('es-CO', {
  weekday: 'long', month: 'long', day: 'numeric',
}).toUpperCase()

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px',
      padding: '16px 12px',
      minWidth: 0,
    }}>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ color: 'var(--c-text)', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 600, marginTop: '5px' }}>
          {sub}
        </p>
      )}
    </div>
  )
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
// Extraído como componente para reutilizar en ambos breakpoints sin duplicar JSX.
function WeeklyChart({ chartData, height = 150 }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px',
      padding: '20px 8px 12px',
    }}>
      {chartData.every(d => d.vol === 0) ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-muted)', fontSize: '11px' }}>
          Sin entrenos registrados esta semana
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} barSize={22} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--c-text-dim)', fontSize: 10, fontWeight: 700 }}
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
                        ? 'var(--c-border-subtle)'
                        : entry.vol > 0
                          ? (isToday ? 'var(--c-accent)' : 'var(--c-border)')
                          : 'var(--c-border-subtle)'
                    }
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── GoalModal ─────────────────────────────────────────────────────────────
function GoalModal({ onClose, onSave, exercises = [] }) {
  const [type, setType] = useState('exercise_weight')
  const [label, setLabel] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [targetReps, setTargetReps] = useState('')   // vacío = usar 1RM; número = peso real × N reps
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
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-sheet"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-subtle)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '480px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          padding: '20px 20px',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Nueva meta
          </h3>
          <button onClick={onClose} style={{ color: 'var(--c-text-dim)', fontSize: '16px', lineHeight: 1, padding: '4px' }}>✕</button>
        </div>

        <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
          Tipo de meta
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
                color: type === opt.value ? '#fff' : 'var(--c-text-dim)',
                border: `1px solid ${type === opt.value ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                transition: 'all 150ms',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
          Nombre de la meta
        </p>
        <input
          className="input-field"
          placeholder={type === 'exercise_weight' ? 'Ej: Sentadilla 100kg' : 'Ej: Constancia este mes'}
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ marginBottom: '12px' }}
        />

        {type === 'exercise_weight' && (
          <>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Ejercicio
            </p>
            <select
              className="input-field"
              value={exerciseName}
              onChange={e => setExerciseName(e.target.value)}
              style={{ marginBottom: '12px' }}
            >
              <option value="">— Selecciona un ejercicio —</option>
              {exercises.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        )}

        <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
          {type === 'days_trained' ? 'Días objetivo (este mes)' : 'Peso objetivo'}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: type === 'exercise_weight' ? '12px' : '20px' }}>
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

        {/* Reps objetivo — solo para metas de peso. Vacío = comparar con 1RM estimado */}
        {type === 'exercise_weight' && (
          <>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Reps objetivo <span style={{ color: 'var(--c-text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(opcional — vacío = comparar 1RM)</span>
            </p>
            <input
              className="input-field"
              type="number"
              placeholder="Ej: 5"
              value={targetReps}
              onChange={e => setTargetReps(e.target.value)}
              style={{ marginBottom: '20px' }}
            />
          </>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !label.trim() || !targetValue}
          className="btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '11px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {saving
            ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} /><span>Guardando...</span></>
            : 'Guardar meta'
          }
        </button>
      </div>
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
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const { workouts, loading, error, createWorkout } = useWorkouts()
  const { goals, createGoal, deleteGoal } = useGoals()

  const firstName = profile?.name?.split(' ')[0] || ''
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState(false)

  // Entreno en curso: sin ended_at
  const activeWorkout = useMemo(() => workouts.find(w => !w.ended_at) || null, [workouts])

  // CTA: continuar si hay entreno activo, crear uno nuevo si no
  const handleStartWorkout = async () => {
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

    // Mejor 1RM de todos los tiempos (starLift — calculado pero disponible para futuros usos)
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
      return { label: 'LIFT HISTÓRICO', title: best.name, value: `${best.rm} ${best.unit}`, sub: '1RM estimado' }
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
      return { label: 'MÁS ENTRENADO ESTE MES', title: top[0], value: `${top[1]} ${top[1] === 1 ? 'vez' : 'veces'}`, sub: 'este mes' }
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
      return { label: 'MEJOR SESIÓN', title: best.name, value: fmt, sub: `volumen total · ${date}` }
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
      return { label: 'MÁS MEJORADO', title: topGain.name, value: `↑ ${topGain.gain}%`, sub: 'en los últimos 30 días' }
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
    if (pct >= 100) return 'oklch(55% 0.15 145)'
    if (pct >= 75)  return 'oklch(65% 0.18 60)'
    return 'var(--c-text-muted)'
  }

  const formatVolume = (v) => {
    if (!v) return '—'
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
    return v.toLocaleString()
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/*
        Wrapper:
        - Móvil: columna única, máx 480px centrado, padding lateral estándar
        - Desktop: sin max-width, padding generoso, aprovecha todo el ancho del main
      */}
      <div className="w-full px-4 pt-10 pb-10 max-w-[480px] mx-auto md:max-w-none md:px-8 md:py-8">

        {/* ── Header ── */}
        <div className="fade-in flex items-start justify-between mb-6 md:mb-8">
          <div>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              {getGreeting()}
            </p>
            <h1 style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {firstName || 'Resumen'}
            </h1>
            <p style={{ color: 'var(--c-text-ghost)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
              {dateStr}
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid var(--c-border-subtle)', padding: '6px 10px',
              borderRadius: '8px', marginTop: '4px',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Salir
          </button>
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

        {error && <div style={ERROR_STYLE}>Error al cargar entrenos.</div>}

        {/* ── CTA principal — solo en móvil ── */}
        {!loading && !error && (
          <div className="md:hidden mb-5">
            <button
              onClick={handleStartWorkout}
              disabled={startingWorkout}
              style={{
                width: '100%',
                background: activeWorkout ? 'var(--c-surface)' : 'var(--c-accent)',
                color: activeWorkout ? 'var(--c-accent)' : '#fff',
                border: activeWorkout ? '2px solid var(--c-accent)' : '2px solid transparent',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                transition: 'opacity 150ms',
                opacity: startingWorkout ? 0.6 : 1,
              }}
            >
              {startingWorkout
                ? 'Iniciando...'
                : activeWorkout
                  ? 'Continuar entreno'
                  : 'Empezar entreno'
              }
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && workouts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sin entrenos aún
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
              Usá el botón + para empezar.
            </p>
          </div>
        )}

        {/* ── Contenido principal ── */}
        {!loading && !error && workouts.length > 0 && (
          <>
            {/*
              Grid responsivo:
              - Móvil (sin grid): DOM order → Stats → [PR + Highlight + Metas] → Chart
              - Desktop (grid 2 cols): placement explícito →
                  Col 1 row 1: Stats
                  Col 2 rows 1–2: PR + Highlight + Metas
                  Col 1 row 2: Chart
            */}
            <div className="md:grid md:grid-cols-[1fr_360px] md:gap-x-6 md:items-start">

              {/* ── Stats — col 1, row 1 ── */}
              <div
                className="fade-in mb-4 md:mb-4 md:col-start-1 md:row-start-1"
                style={{ animationDelay: '40ms' }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <StatCard label="Este mes"     value={stats.thisMonth}              sub="días entrenados" />
                  <StatCard label="Esta semana"  value={stats.count}                  sub={stats.count === 1 ? 'entreno' : 'entrenos'} />
                  <StatCard label="Volumen"       value={formatVolume(stats.weekVolume)} sub="esta semana" />
                </div>
              </div>

              {/* ── Columna derecha: PR + Highlight + Metas — col 2, rows 1–2 ── */}
              <div
                className="fade-in md:col-start-2 md:row-start-1 md:row-span-2"
                style={{ animationDelay: '60ms', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
              >

                {/* PR de la semana */}
                <div style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)',
                  borderTop: stats.weekPR ? '3px solid var(--c-accent)' : '1px solid var(--c-border-subtle)',
                  borderRadius: '16px',
                  padding: '20px',
                }}>
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                    PR esta semana
                  </p>

                  {stats.weekPR ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        background: 'rgba(255,45,45,0.08)',
                        color: 'var(--c-accent)',
                        borderRadius: '999px',
                        padding: '3px 10px',
                        fontSize: '8px', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        marginBottom: '10px',
                      }}>
                        Nuevo récord
                      </span>
                      <p style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '8px' }}>
                        {stats.weekPR.exercise}
                      </p>
                      <p style={{ color: 'var(--c-text-dim)', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                        {stats.weekPR.weight} × {stats.weekPR.reps} reps
                      </p>
                      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 600 }}>
                        1RM estimado:{' '}
                        <span style={{ color: 'var(--c-text)', fontWeight: 800 }}>
                          {stats.weekPR.rm} {stats.weekPR.unit === 'lb' ? 'lb' : 'kg'}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
                        Sin récord esta semana
                      </p>
                      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
                        Seguís acumulando volumen.
                      </p>
                    </>
                  )}
                </div>

                {/* Highlight del día */}
                {todayHighlight && (
                  <div style={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-subtle)',
                    borderRadius: '16px',
                    padding: '20px',
                  }}>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                      {todayHighlight.label}
                    </p>
                    <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px' }}>
                      {todayHighlight.title}
                    </p>
                    <p style={{ color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' }}>
                      {todayHighlight.value}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 600 }}>
                      {todayHighlight.sub}
                    </p>
                  </div>
                )}

                {/* Metas */}
                <div style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)',
                  borderRadius: '16px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
                      title="Agregar meta"
                    >
                      +
                    </button>
                  </div>

                  {goals.length === 0 ? (
                    <button
                      onClick={() => setShowGoalModal(true)}
                      style={{
                        width: '100%',
                        background: 'var(--c-surface-2)',
                        border: '1px dashed var(--c-border)',
                        borderRadius: '12px', padding: '16px',
                        textAlign: 'center',
                        transition: 'border-color 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
                    >
                      <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Sin metas activas
                      </p>
                      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
                        Tocá para agregar tu primera meta
                      </p>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {goalProgress.map(goal => (
                        <div key={goal.id}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                                {goal.label}
                              </p>
                              <p style={{ color: getMotivationColor(goal.pct), fontSize: '10px', fontWeight: 600 }}>
                                {getMotivation(goal.pct)}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '2px 4px', marginLeft: '8px', flexShrink: 0, transition: 'color 120ms' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
                              title="Eliminar meta"
                            >
                              ✕
                            </button>
                          </div>
                          {/* Barra de progreso — 8px para mayor peso visual */}
                          <div style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', marginBottom: '6px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${goal.pct}%`,
                              background: goal.pct >= 100 ? 'oklch(55% 0.15 145)' : 'var(--c-accent)',
                              borderRadius: '999px',
                              transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                            }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 600 }}>
                              {goal.type === 'days_trained'
                                ? `${goal.current} / ${goal.target_value} días este mes`
                                : goal.target_reps
                                  ? `${goal.current} / ${goal.target_value} ${goal.unit} × ${goal.target_reps} reps`
                                  : `${goal.current} / ${goal.target_value} ${goal.unit} (1RM est.)`
                              }
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: goal.pct >= 100 ? 'oklch(55% 0.15 145)' : 'var(--c-text-dim)' }}>
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

              {/* ── Gráfico semanal — col 1, row 2 ── */}
              <div
                className="fade-in md:col-start-1 md:row-start-2 mb-4 md:mb-0"
                style={{ animationDelay: '100ms' }}
              >
                <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                  Progreso — esta semana
                </p>
                <WeeklyChart chartData={stats.chartData} height={160} />
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
