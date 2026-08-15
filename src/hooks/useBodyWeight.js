import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from './useLang'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'

// Body-weight log. Backed by the shared SWR cache so every mount of this hook
// sees the same list: logging a weight from the "+" quick-add updates the home
// chip and the Profile sheet at once, without a refetch or a reload.
//
// `logs` is oldest → newest (the chart reads it in that order); `latestLog` is
// the entry to show when you want "today's weight".
//
// Con `targetUserId` lee la báscula de un cliente: lo pide la ficha del
// entrenador para poder pintar el progreso de una meta de peso corporal, que
// sin los registros no se puede calcular. Es solo lectura — `addLog` escribe
// siempre sobre la propia cuenta (el peso se registra en la báscula y en la
// app de quien se pesa, no desde la ficha de otro).
export function useBodyWeight(targetUserId = null) {
  const { locale } = useLang()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)

  const ownerId = targetUserId || user?.id
  const key = ownerId ? `body-weight:${ownerId}` : null

  const fetcher = async () => {
    const { data, error } = await supabase
      .from('body_weight_logs')
      .select('*')
      .eq('user_id', ownerId)
      .order('logged_at', { ascending: true })
    if (error) throw error
    return data || []
  }

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)
  const logs = data || []

  // `loggedAt` deja fechar el registro en un día que no es hoy — lo pide la
  // hoja del día del calendario, donde se anota el peso del martes el jueves.
  // Sin él, la báscula del martes se guardaría con la fecha de hoy y la curva
  // de peso contaría dos jueves y ningún martes.
  const addLog = useCallback(async (weight, unit = 'kg', note = null, loggedAt = null) => {
    if (!user?.id || !weight) return null
    // Mirando la báscula de otra persona no se escribe: el insert iría a la
    // cuenta propia y la caché que se actualiza es la del cliente, así que el
    // registro aparecería en la ficha equivocada.
    if (targetUserId) return null
    setAdding(true)
    try {
      const { data: row, error: insertErr } = await supabase
        .from('body_weight_logs')
        .insert({
          user_id: user.id, weight: parseFloat(weight), unit, note,
          ...(loggedAt ? { logged_at: loggedAt } : {}),
        })
        .select()
        .single()
      if (insertErr) throw insertErr
      mutateCache(key, prev =>
        [...(prev || []), row].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
      )
      return row
    } catch (err) {
      console.error('Error adding weight log:', err)
      return null
    } finally {
      setAdding(false)
    }
  }, [user?.id, key, targetUserId])

  const deleteLog = useCallback(async (id) => {
    if (targetUserId) return
    try {
      const { error: deleteErr } = await supabase.from('body_weight_logs').delete().eq('id', id)
      if (deleteErr) throw deleteErr
      mutateCache(key, prev => (prev || []).filter(l => l.id !== id))
    } catch (err) {
      console.error('Error deleting weight log:', err)
    }
  }, [key, targetUserId])

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null

  // Chart-ready data (last 30 entries)
  const chartData = logs.slice(-30).map(log => ({
    date: new Date(log.logged_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    peso: log.weight,
    unit: log.unit,
    id: log.id,
  }))

  return {
    logs, chartData, latestLog,
    loading, adding,
    error: error ? (error.message || 'Error inesperado') : null,
    addLog, deleteLog, refetch,
  }
}
