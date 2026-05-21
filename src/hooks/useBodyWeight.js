import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useBodyWeight() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('body_weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true })

      if (fetchErr) throw fetchErr
      setLogs(data || [])
    } catch (err) {
      console.error('Error fetching weight logs:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Add a new weight entry
  const addLog = useCallback(async (weight, unit = 'kg', note = null) => {
    if (!user?.id || !weight) return null
    setAdding(true)
    setError(null)
    try {
      const { data, error: insertErr } = await supabase
        .from('body_weight_logs')
        .insert({ user_id: user.id, weight: parseFloat(weight), unit, note })
        .select()
        .single()

      if (insertErr) throw insertErr
      // Optimistic: append and re-sort
      setLogs(prev => [...prev, data].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at)))
      return data
    } catch (err) {
      console.error('Error adding weight log:', err)
      setError(err.message || 'Error inesperado')
      return null
    } finally {
      setAdding(false)
    }
  }, [user?.id])

  // Delete an entry
  const deleteLog = useCallback(async (id) => {
    setError(null)
    try {
      const { error: deleteErr } = await supabase
        .from('body_weight_logs')
        .delete()
        .eq('id', id)

      if (deleteErr) throw deleteErr
      setLogs(prev => prev.filter(l => l.id !== id))
    } catch (err) {
      console.error('Error deleting weight log:', err)
      setError(err.message || 'Error inesperado')
    }
  }, [])

  // Latest weight entry
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null

  // Chart-ready data (last 30 entries)
  const chartData = logs.slice(-30).map(log => ({
    date: new Date(log.logged_at).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    peso: log.weight,
    unit: log.unit,
    id: log.id,
  }))

  return { logs, chartData, latestLog, loading, adding, error, addLog, deleteLog, refetch: fetchLogs }
}
