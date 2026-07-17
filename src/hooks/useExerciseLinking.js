import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/*
 * The lifter's exercises that no alias could resolve to the library, plus how
 * much history each one carries. These are the judgement calls the migration
 * deliberately refused to make: whether a "Chest Supported Row" is a machine
 * row or a chest-supported T-bar row is the lifter's to answer, not a
 * similarity score's — guessing would rewrite real training history.
 */
export function useUnlinkedExercises() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, workout_exercises(id, sets(id))')
      .eq('user_id', user.id)
      .is('library_id', null)
      .order('name')

    setRows((data || []).map(e => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscle_group,
      uses: (e.workout_exercises || []).length,
      sets: (e.workout_exercises || []).reduce((n, we) => n + (we.sets?.length || 0), 0),
    })))
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return { unlinked: rows, loading, refresh: load }
}

// Candidate library rows for a name, best first. Suggestion only.
export async function suggestLibraryMatches(name, limit = 5) {
  const { data, error } = await supabase.rpc('suggest_library_matches', {
    p_name: name,
    p_limit: limit,
  })
  if (error) throw error
  return data || []
}

// Adopt a library identity. If the lifter already has an exercise for that
// library row, this merges the two — history moves to whichever holds more
// logged sets. Recorded in exercise_merge_log either way.
export async function mergeExerciseIntoLibrary(exerciseId, libraryId) {
  const { data, error } = await supabase.rpc('merge_exercise_into_library', {
    p_exercise_id: exerciseId,
    p_library_id: libraryId,
  })
  if (error) throw error
  return data
}
