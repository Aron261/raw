// Contexto para el generador de rutinas: librería curada + perfil + análisis
// del historial. Se monta solo cuando se abre un wizard de recomendación.

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource } from '../lib/swr'
import { analyzeHistory } from '../lib/engine'

const LIBRARY_COLUMNS = 'id, name, muscle_group, category, movement_pattern, primary_muscles, secondary_muscles, equipment, difficulty, is_compound, tracking_type, substitution_group, best_rep_min, best_rep_max, coaching_notes, is_active'

const HISTORY_WORKOUTS = 40

export function useGenerationContext(level = 'Intermedio') {
  const { user } = useAuth()
  const key = user ? `generation-context:${user.id}` : null

  const fetcher = useCallback(async () => {
    const [libraryRes, workoutsRes] = await Promise.all([
      supabase
        .from('exercises_library')
        .select(LIBRARY_COLUMNS)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('workouts')
        .select(`
          id, started_at, ended_at,
          workout_exercises (
            unit,
            exercises ( name, muscle_group ),
            sets ( weight, reps )
          )
        `)
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(HISTORY_WORKOUTS),
    ])

    if (libraryRes.error) throw libraryRes.error
    if (workoutsRes.error) throw workoutsRes.error

    return {
      library: libraryRes.data || [],
      workouts: workoutsRes.data || [],
    }
  }, [user?.id])

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)

  // El análisis es barato (decenas de filas); se recalcula con el nivel elegido
  // en el wizard, que puede diferir del guardado en el perfil.
  const history = data?.workouts?.length
    ? analyzeHistory(data.workouts, { level })
    : null

  return {
    library: data?.library || [],
    history,
    hasHistory: Boolean(data?.workouts?.length),
    loading,
    error,
    refetch,
  }
}
