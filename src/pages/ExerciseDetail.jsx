import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import Layout from '../components/Layout'
import PRBadge from '../components/PRBadge'
import { useExercisePR, calc1RM } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'

// Custom tooltip for the recharts chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border px-3 py-2 rounded-sm text-xs">
      <p className="text-text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white font-bold">{payload[0].value} 1RM</p>
    </div>
  )
}

export default function ExerciseDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Decode the exercise name from the URL
  const exerciseName = decodeURIComponent(name)

  const { prSets, allTimePR, loading } = useExercisePR(exerciseName, user?.id)

  // Build chart data: date label + best 1RM
  const chartData = prSets.map(session => ({
    date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    '1RM': session.best1RM,
    fullDate: session.date
  }))

  // Find the all-time best set across all sessions
  const allTimeBest1RM = allTimePR?.best1RM || 0

  return (
    <Layout>
      <div className="px-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 pt-8 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="text-text-muted text-xs uppercase tracking-widest active:opacity-60 shrink-0"
          >
            ←
          </button>
          <h1 className="text-white text-xl font-black uppercase tracking-tighter flex-1 truncate">
            {exerciseName}
          </h1>
        </div>

        {/* All-time PR callout */}
        {allTimePR && (
          <div className="flex items-center gap-3 bg-accent-red/10 border border-accent-red/30 px-4 py-3 rounded-sm mb-6 mt-4">
            <PRBadge />
            <div>
              <span className="text-text-muted text-xs uppercase tracking-widest block">All-Time Best 1RM</span>
              <span className="text-white font-black text-xl">
                {allTimePR.best1RM}
                <span className="text-text-muted text-sm font-normal ml-1">{allTimePR.unit}</span>
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-text-muted text-xs uppercase tracking-widest animate-pulse">Loading...</span>
          </div>
        )}

        {!loading && prSets.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-sm">
            <p className="text-text-muted text-sm uppercase tracking-widest">No data yet.</p>
            <p className="text-text-muted text-xs mt-2">Log this exercise to see your progression.</p>
          </div>
        )}

        {!loading && prSets.length > 0 && (
          <>
            {/* Progression Chart */}
            <div className="mb-8">
              <h2 className="text-text-muted text-xs uppercase tracking-widest mb-4">1RM Progression</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {/* Chart props use resolved hex values — CSS vars don't work in SVG attributes */}
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#888888', fontSize: 10 }}
                      axisLine={{ stroke: '#2A2A2A' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#888888', fontSize: 10 }}
                      axisLine={{ stroke: '#2A2A2A' }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="1RM"
                      stroke="#FF2D2D"
                      strokeWidth={2}
                      dot={{ fill: '#FF2D2D', r: 3, strokeWidth: 0 }}
                      activeDot={{ fill: '#FF2D2D', r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* History by session */}
            <div>
              <h2 className="text-text-muted text-xs uppercase tracking-widest mb-4">History</h2>
              <div className="space-y-4 pb-8">
                {[...prSets].reverse().map((session, idx) => {
                  const sessionDate = new Date(session.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                  const isAllTimePR = session.best1RM === allTimeBest1RM

                  return (
                    <div key={session.workoutId} className="card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-text-muted text-xs uppercase tracking-widest">{sessionDate}</span>
                        {isAllTimePR && <PRBadge />}
                      </div>

                      {/* Sets in this session */}
                      <div className="space-y-1">
                        {[...session.sets]
                          .sort((a, b) => a.set_number - b.set_number)
                          .map(set => {
                            const set1RM = calc1RM(set.weight, set.reps)
                            const isSetPR = isAllTimePR && set1RM === session.best1RM

                            return (
                              <div key={set.id} className="flex items-center gap-3 text-sm">
                                <span className="text-text-muted w-6 text-xs">{set.set_number}</span>
                                <span className="text-white font-bold">
                                  {set.reps} × {set.weight}
                                  <span className="text-text-muted font-normal ml-1 text-xs">{session.unit}</span>
                                </span>
                                <span className="text-text-muted text-xs ml-auto">~{set1RM} 1RM</span>
                                {isSetPR && <PRBadge />}
                              </div>
                            )
                          })}
                      </div>

                      {/* Session best */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-text-muted text-xs">
                          Best: <span className="text-white font-bold">{session.best1RM} 1RM</span>
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
