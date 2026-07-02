import { useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'
import { toLocalISODate } from './useNutrition'

export const TIMING_OPTIONS = ['AM', 'PM', 'Pre-entreno', 'Con comida']

// Stack de suplementos + checklist de "tomado hoy".
export function useSupplements() {
  const { user } = useAuth()
  const today = toLocalISODate()

  const stackKey = user ? `supplements:${user.id}` : null
  const logsKey  = user ? `supp-logs:${user.id}:${today}` : null

  const stackFetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplements')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }, [user?.id])

  const logsFetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplement_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('taken_on', today)
    if (error) throw error
    return data || []
  }, [user?.id, today])

  const { data: stackData, loading: stackLoading, error: stackError, refetch } = useCachedResource(stackKey, stackFetcher)
  const { data: logsData } = useCachedResource(logsKey, logsFetcher)

  const stack = stackData || []
  const logs = logsData || []

  const active = useMemo(() => stack.filter(s => s.is_active), [stack])
  const paused = useMemo(() => stack.filter(s => !s.is_active), [stack])
  const takenIds = useMemo(() => new Set(logs.map(l => l.supplement_id)), [logs])
  const takenCount = useMemo(() => active.filter(s => takenIds.has(s.id)).length, [active, takenIds])

  const addSupplement = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('supplements')
      .insert({ user_id: user.id, sort_order: stack.length, ...fields })
      .select()
      .single()
    if (err) throw err
    mutateCache(stackKey, prev => [...(prev || []), row])
    return row
  }, [user?.id, stack.length, stackKey])

  const updateSupplement = useCallback(async (id, patch) => {
    const { data: row, error: err } = await supabase
      .from('supplements')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    mutateCache(stackKey, prev => (prev || []).map(s => (s.id === id ? row : s)))
    return row
  }, [stackKey])

  const deleteSupplement = useCallback(async (id) => {
    const { error: err } = await supabase.from('supplements').delete().eq('id', id)
    if (err) throw err
    mutateCache(stackKey, prev => (prev || []).filter(s => s.id !== id))
    mutateCache(logsKey, prev => (prev || []).filter(l => l.supplement_id !== id))
  }, [stackKey, logsKey])

  // Marcar / desmarcar "tomado hoy" — optimista en ambos sentidos.
  const toggleTaken = useCallback(async (supplementId) => {
    const existing = logs.find(l => l.supplement_id === supplementId)
    if (existing) {
      mutateCache(logsKey, prev => (prev || []).filter(l => l.id !== existing.id))
      const { error: err } = await supabase.from('supplement_logs').delete().eq('id', existing.id)
      if (err) { mutateCache(logsKey, prev => [...(prev || []), existing]); throw err }
    } else {
      const temp = { id: `temp-${supplementId}`, supplement_id: supplementId, taken_on: today }
      mutateCache(logsKey, prev => [...(prev || []), temp])
      const { data: row, error: err } = await supabase
        .from('supplement_logs')
        .insert({ user_id: user.id, supplement_id: supplementId, taken_on: today })
        .select()
        .single()
      if (err) { mutateCache(logsKey, prev => (prev || []).filter(l => l.id !== temp.id)); throw err }
      mutateCache(logsKey, prev => (prev || []).map(l => (l.id === temp.id ? row : l)))
    }
  }, [logs, logsKey, user?.id, today])

  return {
    stack, active, paused, takenIds, takenCount,
    loading: stackLoading, error: stackError, refetch,
    addSupplement, updateSupplement, deleteSupplement, toggleTaken,
  }
}
