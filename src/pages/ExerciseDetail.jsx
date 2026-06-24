import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import Layout from '../components/Layout'
import PRBadge from '../components/PRBadge'
import { useExercisePR, calc1RM } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

// Literal hex per theme — CSS vars don't resolve in recharts SVG attrs.
const CHART = {
  light: { line: '#2438FF', grid: '#D5D2C7', axis: '#5A584F' },
  dark:  { line: '#6E7BFF', grid: '#26271F', axis: '#A2A096' },
}

// Custom tooltip — light theme
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      padding: '8px 12px',
      borderRadius: '10px',
      fontSize: '11px',
    }}>
      <p style={{ color: 'var(--c-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontWeight: 700 }}>{payload[0].value} 1RM</p>
    </div>
  )
}

// Rep ranges to highlight in the PR table
const REP_RANGES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]

export default function ExerciseDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { resolved } = useTheme()
  const cc = CHART[resolved] || CHART.light

  const exerciseName = decodeURIComponent(name)
  const { prSets, allTimePR, loading } = useExercisePR(exerciseName, user?.id)

  // Chart: date + best 1RM per session
  const chartData = prSets.map(session => ({
    date: new Date(session.date).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    '1RM': session.best1RM,
  }))

  const allTimeBest1RM = allTimePR?.best1RM || 0

  // PR by rep range: for each rep count, best weight logged ever
  const prByReps = useMemo(() => {
    // Flatten all sets from all sessions
    const allSets = prSets.flatMap(session =>
      (session.sets || []).map(s => ({ ...s, unit: session.unit, date: session.date }))
    )

    // Best weight per rep count
    const bestByRep = {}
    for (const set of allSets) {
      if (!set.reps || !set.weight) continue
      const existing = bestByRep[set.reps]
      if (!existing || set.weight > existing.weight) {
        bestByRep[set.reps] = set
      }
    }

    // Keep only rep ranges we care about (that have data), sorted asc
    return REP_RANGES
      .filter(r => bestByRep[r])
      .map(r => ({ reps: r, ...bestByRep[r] }))
  }, [prSets])

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '8px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
          >
            ←
          </button>
          <h1 style={{ color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {exerciseName}
          </h1>
        </div>

        {/* All-time PR callout */}
        {allTimePR && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
            padding: '12px 16px', borderRadius: '14px', margin: '16px 0 24px',
          }}>
            <PRBadge />
            <div>
              <span style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>
                Mejor 1RM estimado
              </span>
              <span style={{ color: 'var(--c-text)', fontWeight: 900, fontSize: '22px' }}>
                {allTimePR.best1RM}
                <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '13px', marginLeft: '4px' }}>{allTimePR.unit}</span>
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }} className="animate-pulse">
              Cargando...
            </span>
          </div>
        )}

        {!loading && prSets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', border: '1px dashed var(--c-border)', borderRadius: '14px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sin datos aún</p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px' }}>Registra este ejercicio para ver tu progreso.</p>
          </div>
        )}

        {!loading && prSets.length > 0 && (
          <>
            {/* Progression chart */}
            <div style={{ marginBottom: '32px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                Progresión 1RM
              </p>
              <div style={{ height: '180px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {/* Hex values — CSS vars no funcionan en atributos SVG; ver CHART */}
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: cc.axis, fontSize: 10 }}
                      axisLine={{ stroke: cc.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: cc.axis, fontSize: 10 }}
                      axisLine={{ stroke: cc.grid }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="1RM"
                      stroke={cc.line}
                      strokeWidth={2}
                      dot={{ fill: cc.line, r: 3, strokeWidth: 0 }}
                      activeDot={{ fill: cc.line, r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PR by rep range */}
            {prByReps.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  Mejor peso por reps
                </p>
                <div style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                }}>
                  {prByReps.map((entry, i) => {
                    const dateStr = new Date(entry.date).toLocaleDateString('es', { month: 'short', day: 'numeric' })
                    const isFirst = i === 0
                    return (
                      <div
                        key={entry.reps}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderTop: isFirst ? 'none' : '1px solid var(--c-border-subtle)',
                        }}
                      >
                        {/* Rep badge */}
                        <div style={{
                          width: '36px', height: '36px',
                          background: 'var(--c-surface-2)',
                          borderRadius: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginRight: '12px',
                        }}>
                          <span style={{ color: 'var(--c-text)', fontWeight: 900, fontSize: '13px' }}>{entry.reps}</span>
                        </div>

                        {/* Label */}
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {entry.reps === 1 ? '1 rep' : `${entry.reps} reps`}
                          </span>
                        </div>

                        {/* Weight + date */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '15px' }}>
                            {entry.weight}
                            <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{entry.unit}</span>
                          </span>
                          <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '1px' }}>{dateStr}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Session history */}
            <div style={{ paddingBottom: '32px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                Historial
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...prSets].reverse().map(session => {
                  const sessionDate = new Date(session.date).toLocaleDateString('es', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })
                  const isAllTimePR = session.best1RM === allTimeBest1RM

                  return (
                    <div key={session.workoutId} style={{
                      background: 'var(--c-surface)',
                      border: `1px solid ${isAllTimePR ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
                      borderRadius: '14px',
                      padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {sessionDate}
                        </span>
                        {isAllTimePR && <PRBadge />}
                      </div>

                      {/* Sets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[...session.sets]
                          .sort((a, b) => a.set_number - b.set_number)
                          .map(set => {
                            const set1RM = calc1RM(set.weight, set.reps)
                            const isSetPR = isAllTimePR && set1RM === session.best1RM
                            return (
                              <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                                <span style={{ color: 'var(--c-text-muted)', width: '20px', fontSize: '11px' }}>{set.set_number}</span>
                                <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
                                  {set.reps} × {set.weight}
                                  <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{session.unit}</span>
                                </span>
                                <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginLeft: 'auto' }}>~{set1RM} 1RM</span>
                                {isSetPR && <PRBadge />}
                              </div>
                            )
                          })}
                      </div>

                      {/* Session best */}
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--c-border-subtle)' }}>
                        <span style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>
                          Mejor: <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{session.best1RM} 1RM</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
