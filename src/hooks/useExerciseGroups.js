import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { isLegacyGroup, guessLegGroup } from '../lib/muscleGroups'

// The user's exercises with their effective muscle-group classification.
// Precedence: own exercises.muscle_group → library → unclassified.
// `needsAttention` = unclassified OR tagged with a legacy group (e.g. "Pierna"
// after the leg split) — both should be re-assigned in the exercise manager.
export function useExerciseGroups() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [libGroups, setLibGroups] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data: own } = await supabase
      .from('exercises')
      .select('id, name, muscle_group')
      .eq('user_id', user.id)
      .order('name')
    const list = own || []
    const names = [...new Set(list.map(e => e.name))]
    const lib = {}
    if (names.length > 0) {
      const { data } = await supabase
        .from('exercises_library')
        .select('name, muscle_group')
        .in('name', names)
      ;(data || []).forEach(e => { lib[e.name] = e.muscle_group })
    }
    setRows(list)
    setLibGroups(lib)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const exercises = rows.map(e => {
    const ownGroup = e.muscle_group || null
    const libGroup = libGroups[e.name] || null
    const effective = ownGroup || libGroup || null
    const isLegacy = isLegacyGroup(effective)
    const isUnclassified = !effective
    return {
      id: e.id,
      name: e.name,
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

  return { exercises, needsAttention, loading, classify, refresh: load }
}
