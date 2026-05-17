import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Progress() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    const fetchExercises = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch all exercises the user has logged (with at least one set)
        const { data, error: fetchError } = await supabase
          .from('exercises')
          .select(`
            id, name, created_at,
            workout_exercises (
              id,
              sets ( id, weight, reps )
            )
          `)
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (fetchError) throw fetchError

        // Only include exercises that have at least one set recorded
        const filtered = (data || []).filter(ex =>
          ex.workout_exercises?.some(we => we.sets?.length > 0)
        )

        setExercises(filtered)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchExercises()
  }, [user])

  return (
    <Layout>
      <div className="px-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="pt-8 pb-6">
          <h1 className="text-white text-3xl font-black uppercase tracking-tighter">Progress</h1>
          <p className="text-text-muted text-xs uppercase tracking-widest mt-1">
            {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} tracked
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-surface rounded-sm animate-pulse border border-border" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm px-4 py-3 rounded-sm">
            Failed to load exercises: {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && exercises.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-sm">
            <p className="text-text-muted text-sm uppercase tracking-widest">No data yet.</p>
            <p className="text-text-muted text-xs mt-2">Log sets in a workout to track progression.</p>
          </div>
        )}

        {/* Exercise list */}
        {!loading && !error && exercises.length > 0 && (
          <div className="space-y-2 pb-8">
            {exercises.map(exercise => {
              // Count total sets logged for this exercise
              const totalSets = exercise.workout_exercises?.reduce(
                (sum, we) => sum + (we.sets?.length || 0), 0
              ) || 0
              const sessionCount = exercise.workout_exercises?.length || 0

              return (
                <button
                  key={exercise.id}
                  onClick={() => navigate(`/exercise/${encodeURIComponent(exercise.name)}`)}
                  className="w-full card flex items-center justify-between text-left hover:border-white/20 transition-colors active:opacity-80"
                >
                  <div>
                    <span className="text-white font-bold uppercase tracking-tight text-sm">
                      {exercise.name}
                    </span>
                    <span className="text-text-muted text-xs block mt-0.5">
                      {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} · {totalSets} sets
                    </span>
                  </div>
                  <span className="text-text-muted text-xs">→</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
