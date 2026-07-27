import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { shareUrl } from '../lib/share'

// useRoutineShare(routineId) — el lado del dueño de un enlace compartido.
//   · share: la fila viva de routine_shares (o null si la rutina no está compartida)
//   · createLink(): genera el enlace, o devuelve el que ya existía
//   · revokeLink(): lo desactiva; quien lo tenga deja de ver el plan
//
// El enlace muestra el plan en vivo, así que no hay nada que "actualizar" tras
// editar la rutina: solo existe o no existe.
export function useRoutineShare(routineId) {
  const { user } = useAuth()
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)

  const fetchShare = useCallback(async () => {
    if (!routineId || !user) { setLoading(false); return }
    setLoading(true)
    try {
      // RLS ya limita la tabla a los enlaces propios.
      const { data, error: err } = await supabase
        .from('routine_shares')
        .select('id, routine_id, token, import_count, last_import_at, created_at')
        .eq('routine_id', routineId)
        .is('revoked_at', null)
        .maybeSingle()
      if (err) throw err
      setShare(data || null)
    } catch (err) {
      console.error('Error loading routine share:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [routineId, user])

  useEffect(() => { fetchShare() }, [fetchShare])

  // create_routine_share es idempotente: si ya había enlace vivo devuelve ese
  // mismo, así que pulsar "Compartir" dos veces no genera dos enlaces.
  const createLink = async () => {
    if (!routineId) return null
    setWorking(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('create_routine_share', { p_routine_id: routineId })
      if (err) throw err
      await fetchShare()
    } catch (err) {
      console.error('Error creating routine share:', err)
      setError(err.message || 'No se pudo crear el enlace')
      throw err
    } finally {
      setWorking(false)
    }
  }

  const revokeLink = async () => {
    if (!share) return
    setWorking(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('routine_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', share.id)
      if (err) throw err
      setShare(null)
    } catch (err) {
      console.error('Error revoking routine share:', err)
      setError(err.message || 'No se pudo desactivar el enlace')
      throw err
    } finally {
      setWorking(false)
    }
  }

  return {
    share,
    url: share ? shareUrl(share.token) : '',
    loading,
    working,
    error,
    createLink,
    revokeLink,
    refetch: fetchShare,
  }
}
