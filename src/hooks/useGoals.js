import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useGoals(targetUserId?) — sin argumento opera sobre el usuario actual.
// Con targetUserId, un entrenador lee y gestiona las metas de ese cliente;
// las que cree quedan marcadas con assigned_by = entrenador.
export function useGoals(targetUserId = null) {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ownerId = targetUserId || user?.id
  const assignedBy = targetUserId ? (user?.id ?? null) : null

  const fetchGoals = useCallback(async () => {
    if (!ownerId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: true })
      if (err) throw err
      setGoals(data || [])
    } catch (err) {
      console.error('Error fetching goals:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const createGoal = async (goalData) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('goals')
        .insert({ ...goalData, user_id: ownerId, assigned_by: assignedBy })
      if (err) throw err
      await fetchGoals()
    } catch (err) {
      console.error('Error creating goal:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const deleteGoal = async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('goals').delete().eq('id', id)
      if (err) throw err
      await fetchGoals()
    } catch (err) {
      console.error('Error deleting goal:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  return { goals, loading, error, createGoal, deleteGoal, fetchGoals }
}
