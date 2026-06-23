import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { useWorkouts } from '../hooks/useWorkout'


export default function History() {
  const { workouts, loading, error, fetchWorkouts, deleteWorkout, duplicateWorkout } = useWorkouts()

  // Group workouts by month
  const grouped = workouts.reduce((acc, workout) => {
    const date = new Date(workout.started_at)
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})

  return (
    <Layout>
      <div className="px-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="pt-8 pb-6">
          <h1 className="text-white text-3xl font-black uppercase tracking-tighter">Historial de entrenos</h1>
          <p className="text-text-muted text-xs uppercase tracking-widest mt-1">
            {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'} logged
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse h-24 bg-surface" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm px-4 py-3 rounded-sm mb-4">
            <p>Failed to load history: {error}</p>
            <button onClick={fetchWorkouts} className="text-white underline mt-2 text-xs uppercase tracking-widest">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && workouts.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-sm">
            <p className="text-text-muted text-sm uppercase tracking-widest">No workouts yet.</p>
            <p className="text-text-muted text-xs mt-2">Start your first session from the home screen.</p>
          </div>
        )}

        {/* Workouts grouped by month */}
        {!loading && !error && (
          <div className="pb-8">
            {Object.entries(grouped).map(([month, monthWorkouts]) => (
              <div key={month} className="mb-8">
                <h2 className="text-text-muted text-xs uppercase tracking-widest mb-3">{month}</h2>
                <div className="space-y-3">
                  {monthWorkouts.map(workout => (
                    <WorkoutCard key={workout.id} workout={workout} onDelete={deleteWorkout} onDuplicate={duplicateWorkout} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
