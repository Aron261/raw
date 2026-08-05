import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { isLegacyGroup, guessLegGroup } from '../lib/muscleGroups'
import { exerciseLabel } from '../lib/exercises'

// The user's exercises with their effective muscle-group classification.
// Precedence: own exercises.muscle_group → library → unclassified.
// The library is reached through library_id, not by name: a linked exercise
// may still be stored under whatever the lifter originally typed ("Bench
// Press"), so matching on the name would miss its classification.
// `needsAttention` = unclassified OR tagged with a legacy group (e.g. "Pierna"
// after the leg split) — both should be re-assigned in the exercise manager.
export function useExerciseGroups(lang = 'es') {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    // El error se descartaba, así que un fallo de red dejaba la lista vacía y
    // la pantalla decía que no hay ejercicios que revisar. Justo lo contrario
    // de lo que hace falta saber.
    const { data: own, error: err } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, library_id, library:exercises_library ( name, name_en, muscle_group )')
      .eq('user_id', user.id)
      .order('name')
    if (err) {
      setError(err.message || 'Error inesperado')
    } else {
      setRows(own || [])
      setError(null)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const exercises = rows.map(e => {
    const ownGroup = e.muscle_group || null
    const libGroup = e.library?.muscle_group || null
    const effective = ownGroup || libGroup || null
    const isLegacy = isLegacyGroup(effective)
    const isUnclassified = !effective
    return {
      id: e.id,
      name: exerciseLabel(e, lang),
      ownGroup,
      libGroup,
      effective,
      isLegacy,
      isUnclassified,
      needsAttention: isLegacy || isUnclassified,
      suggestion: (isLegacy || isUnclassified) ? guessLegGroup(e.name) : null,
    }
  })

  const needsAttention = exercises.filter(e => e.needsAttention)

  const classify = useCallback(async (exerciseId, group) => {
    const { error } = await supabase
      .from('exercises')
      .update({ muscle_group: group })
      .eq('id', exerciseId)
      .eq('user_id', user.id)
    if (error) throw error
    setRows(prev => prev.map(e => (e.id === exerciseId ? { ...e, muscle_group: group } : e)))
  }, [user?.id])

  return { exercises, needsAttention, loading, error, classify, refresh: load }
}
