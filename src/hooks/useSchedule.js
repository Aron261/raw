import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource } from '../lib/swr'

// useSchedule() — sesiones planificadas del usuario (capa libre del calendario).
//
// Trae TODAS las sesiones del usuario y las cachea (SWR) como useRoutines: el
// volumen es bajo y así navegar entre meses no dispara refetch por-mes. La
// fecha se guarda como `date` (YYYY-MM-DD local), no timestamp, para que un
// plan del día no se corra a mañana por UTC.
export function useSchedule() {
  const { user } = useAuth()
  const ownerId = user?.id
  const key = ownerId ? `schedule:${ownerId}` : null

  const fetcher = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('scheduled_sessions')
      .select('id, date, kind, title, routine_id, routine_day_id, notes, status, sort_order')
      .eq('user_id', ownerId)
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true })
    if (err) throw err
    return data || []
  }, [ownerId])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const sessions = data || []

  // date: 'YYYY-MM-DD' local · kind requerido · el resto opcional.
  const createSession = async (s) => {
    if (!ownerId) throw new Error('Usuario no autenticado')
    const { error: err } = await supabase
      .from('scheduled_sessions')
      .insert({
        user_id: ownerId,
        date: s.date,
        kind: s.kind || 'strength',
        title: s.title?.trim() || null,
        routine_id: s.routine_id ?? null,
        routine_day_id: s.routine_day_id ?? null,
        notes: s.notes?.trim() || null,
        status: s.status || 'planned',
      })
    if (err) throw err
    await refetch()
  }

  const updateSession = async (id, updates) => {
    const { error: err } = await supabase
      .from('scheduled_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', ownerId)
    if (err) throw err
    await refetch()
  }

  const deleteSession = async (id) => {
    const { error: err } = await supabase
      .from('scheduled_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId)
    if (err) throw err
    await refetch()
  }

  return {
    sessions,
    loading,
    error: loadError ? (loadError.message || 'Error inesperado') : null,
    refetch,
    createSession,
    updateSession,
    deleteSession,
  }
}
