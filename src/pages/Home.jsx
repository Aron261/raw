import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { useWorkouts } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { hoverColor, ERROR_STYLE } from '../lib/ui'

// ── Date helpers ────────────────────────────────────────────────────────
function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = (day + 6) % 7  // days since Monday
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const dateStr = new Date().toLocaleDateString('es-CO', {
  weekday: 'long', month: 'long', day: 'numeric',
})

// ── Stat card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '14px',
      padding: '14px 12px',
      minWidth: 0,
    }}>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ color: 'var(--c-text)', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', marginTop: '4px', fontWeight: 600 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Custom tooltip for chart ───────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value || 0
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: '8px', padding: '6px 10px',
      fontSize: '10px', fontWeight: 700, color: 'var(--c-text)',
    }}>
      {label}: {val > 0 ? `${(val / 1000).toFixed(1)}k kg` : '—'}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────
export default function Home() {
  const { user, signOut } = useAuth()
  const { workouts, loading, error, deleteWorkout, duplicateWorkout } = useWorkouts()
  const navigate = useNavigate()

  // ── Weekly stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!workouts.length) return { count: 0, streak: 0, weekVolume: 0, chartData: [] }

    const monday = getMondayOfWeek()

    // Workouts this week
    const thisWeek = workouts.filter(w => new Date(w.started_at) >= monday)

    // Volume this week (lb or kg — raw number)
    let weekVolume = 0
    for (const w of thisWeek) {
      for (const we of w.workout_exercises || []) {
        for (const s of we.sets || []) {
          weekVolume += (s.weight || 0) * (s.reps || 0)
        }
      }
    }

    // Streak: consecutive days going back from today with at least 1 workout
    const workoutDays = new Set(
      workouts.map(w => {
        const d = new Date(w.started_at)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
    )
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    while (workoutDays.has(cursor.getTime())) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    // Chart: volume per day this week (Mon–Sun)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const chartData = DAY_LABELS.map((day, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      // Don't show future days
      const isFuture = date > today
      if (isFuture) return { day, vol: 0, future: true }

      const dayWorkouts = workouts.filter(w => {
        const d = new Date(w.started_at)
        d.setHours(0, 0, 0, 0)
        return d.getTime() === date.getTime()
      })
      const vol = dayWorkouts.reduce((sum, w) => {
        return sum + (w.workout_exercises || []).reduce((s2, we) =>
          s2 + (we.sets || []).reduce((s3, s) => s3 + (s.weight || 0) * (s.reps || 0), 0), 0)
      }, 0)
      return { day, vol, future: false }
    })

    return { count: thisWeek.length, streak, weekVolume: Math.round(weekVolume), chartData }
  }, [workouts])

  const recentWorkout = workouts[0]

  // Format volume for display
  const formatVolume = (v) => {
    if (!v) return '—'
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
    return v.toLocaleString()
  }

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* ── Header ── */}
        <div className="fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '40px', paddingBottom: '24px' }}>
          <div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              {dateStr}
            </p>
            <h1 style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
              Resumen
            </h1>
          </div>
          <button
            onClick={signOut}
            style={{
              color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid var(--c-border-subtle)', padding: '6px 10px',
              borderRadius: '8px', marginTop: '4px',
              transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Salir
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div className="fade-in" style={{ display: 'flex', gap: '8px', marginBottom: '24px', animationDelay: '40ms' }}>
          <StatCard
            label="Esta semana"
            value={stats.count}
            sub={stats.count === 1 ? 'entreno' : 'entrenos'}
          />
          <StatCard
            label="Racha"
            value={stats.streak || '—'}
            sub={stats.streak ? (stats.streak === 1 ? 'día' : 'días') : 'sin racha'}
          />
          <StatCard
            label="Volumen"
            value={formatVolume(stats.weekVolume)}
            sub="esta semana"
          />
        </div>

        {/* ── Weekly chart ── */}
        <div className="fade-in" style={{ marginBottom: '28px', animationDelay: '80ms' }}>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            Progreso — esta semana
          </p>
          <div style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: '16px',
            padding: '16px 8px 8px',
          }}>
            {stats.chartData.every(d => d.vol === 0) ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--c-text-muted)', fontSize: '11px' }}>
                Sin entrenos registrados esta semana
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={stats.chartData} barSize={20} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: 'var(--c-text-dim)', fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--c-border-subtle)' }} />
                  <Bar dataKey="vol" radius={[6, 6, 0, 0]}>
                    {stats.chartData.map((entry, i) => {
                      const isToday = i === ((new Date().getDay() + 6) % 7)
                      return (
                        <Cell
                          key={i}
                          fill={entry.future ? 'transparent' : entry.vol > 0
                            ? (isToday ? 'var(--c-accent)' : 'var(--c-border)')
                            : 'var(--c-border-subtle)'}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Entreno reciente ── */}
        <div className="fade-in" style={{ marginBottom: '32px', animationDelay: '120ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Recientes
            </p>
            {workouts.length > 1 && (
              <button
                onClick={() => navigate('/history')}
                style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                {...hoverColor('var(--c-text)', 'var(--c-accent)')}
              >
                Ver todos →
              </button>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(2)].map((_, i) => (
                <div key={i} style={{ height: '80px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', opacity: 1 - i * 0.3 }} />
              ))}
            </div>
          )}

          {error && <div style={ERROR_STYLE}>Error al cargar entrenos.</div>}

          {!loading && !error && workouts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sin entrenos aún
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
                Usa el botón + para empezar.
              </p>
            </div>
          )}

          {!loading && !error && workouts.slice(0, 3).map((workout, i) => (
            <div key={workout.id} className="stagger-item" style={{ animationDelay: `${i * 50}ms`, marginBottom: '8px' }}>
              <WorkoutCard workout={workout} onDelete={deleteWorkout} onDuplicate={duplicateWorkout} />
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}
