import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { useWorkouts } from '../hooks/useWorkout'


export default function History() {
  const { workouts, loading, error, fetchWorkouts, deleteWorkout, duplicateWorkout } = useWorkouts()

  // Group workouts by month (Spanish, capitalized)
  const grouped = workouts.reduce((acc, workout) => {
    const date = new Date(workout.started_at)
    const raw = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    const key = raw.charAt(0).toUpperCase() + raw.slice(1)
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})

  return (
    <Layout>
      <div className="px-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="pt-10 pb-6">
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '30px', letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.02 }}>
            Historial
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
            {workouts.length} {workouts.length === 1 ? 'entreno registrado' : 'entrenos registrados'}
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-24" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px' }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)', color: 'var(--c-action-text)', fontSize: '13px', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px' }}>
            <span>No pudimos cargar tu historial.</span>
            <button onClick={fetchWorkouts} style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-action-border)', borderRadius: '8px', padding: '6px 12px', background: 'transparent' }}>
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && workouts.length === 0 && (
          <div className="text-center py-16" style={{ border: '1px dashed var(--c-border)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '14px', fontWeight: 600 }}>Sin entrenos aún</p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px' }}>Empieza tu primera sesión desde el inicio.</p>
          </div>
        )}

        {/* Workouts grouped by month */}
        {!loading && !error && (
          <div className="pb-8">
            {Object.entries(grouped).map(([month, monthWorkouts]) => (
              <div key={month} className="mb-8">
                <h2 style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>{month}</h2>
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
