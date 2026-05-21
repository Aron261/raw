import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (err) throw err
      setGoals(data || [])
    } catch (err) {
      console.error('Error fetching goals:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const createGoal = async (goalData) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('goals')
        .insert({ ...goalData, user_id: user.id })
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
