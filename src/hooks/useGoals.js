import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useGoals(targetUserId?) — sin argumento opera sobre el usuario actual.
// Con targetUserId, un entrenador lee y gestiona las metas de ese cliente;
// las que cree quedan marcadas con assigned_by = entrenador.
//
// Las metas cumplidas no se borran: se sellan con `completed_at` y salen de
// `open` para entrar en `completed`. Antes la única salida de una meta lograda
// era el botón de eliminar, o sea que celebrarla y perderla eran el mismo
// gesto.
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

  // Marcar cumplida / reabrir. La fila se actualiza en memoria antes de que
  // vuelva el servidor: sellar una meta que acabas de lograr no puede tardar
  // en verse, y el refetch de después corrige si algo falló.
  const setCompleted = useCallback(async (id, completed = true) => {
    const completed_at = completed ? new Date().toISOString() : null
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, completed_at } : g)))
    try {
      const { error: err } = await supabase.from('goals').update({ completed_at }).eq('id', id)
      if (err) throw err
    } catch (err) {
      console.error('Error updating goal:', err)
      setError(err.message || 'Error inesperado')
      await fetchGoals()
    }
  }, [fetchGoals])

  const completeGoal = useCallback((id) => setCompleted(id, true), [setCompleted])
  const reopenGoal = useCallback((id) => setCompleted(id, false), [setCompleted])

  const { open, completed } = useMemo(() => ({
    open: goals.filter(g => !g.completed_at),
    // Lo último logrado primero: un archivo se lee de lo más reciente hacia
    // atrás.
    completed: goals
      .filter(g => g.completed_at)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)),
  }), [goals])

  return {
    goals, open, completed,
    loading, error,
    createGoal, deleteGoal, completeGoal, reopenGoal, fetchGoals,
  }
}
