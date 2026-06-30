import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// The user's exercises with their muscle-group classification, plus the library
// fallback. `unclassified` = exercises with no own group AND none in the library
// (these are what fall into the "Otros" bucket in the balance views).
export function useExerciseGroups() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState([])
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
    setExercises(list)
    setLibGroups(lib)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const unclassified = exercises.filter(e => !e.muscle_group && !libGroups[e.name])

  const classify = useCallback(async (exerciseId, group) => {
    const { error } = await supabase
      .from('exercises')
      .update({ muscle_group: group })
      .eq('id', exerciseId)
      .eq('user_id', user.id)
    if (error) throw error
    setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, muscle_group: group } : e)))
  }, [user?.id])

  return { exercises, unclassified, loading, classify, refresh: load }
}
