import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useInvites — lado cliente:
//   · canjear un código de invitación de un entrenador (redeem_invite RPC)
//   · listar los entrenadores que me siguen
//   · desvincular un entrenador
export function useInvites() {
  const { user } = useAuth()
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redeeming, setRedeeming] = useState(false)

  const fetchTrainers = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: links, error: linksErr } = await supabase
        .from('trainer_clients')
        .select('id, trainer_id, status, created_at')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (linksErr) throw linksErr

      const trainerIds = (links || []).map(l => l.trainer_id)
      let profilesById = {}
      if (trainerIds.length > 0) {
        const { data: profs, error: psErr } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', trainerIds)
        if (psErr) throw psErr
        profilesById = Object.fromEntries((profs || []).map(p => [p.id, p]))
      }

      setTrainers(
        (links || []).map(l => ({
          linkId: l.id,
          trainerId: l.trainer_id,
          profile: profilesById[l.trainer_id] || {},
        }))
      )
    } catch (err) {
      console.error('Error fetching trainers:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchTrainers() }, [fetchTrainers])

  // Canjear un código. La función RPC (SECURITY DEFINER) valida y crea el vínculo.
  const redeemCode = async (code) => {
    if (!code?.trim()) throw new Error('Ingresa un código')
    setRedeeming(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('redeem_invite', { p_code: code.trim() })
      if (err) throw err
      await fetchTrainers()
    } catch (err) {
      console.error('Error redeeming code:', err)
      setError(err.message || 'Error inesperado')
      throw err
    } finally {
      setRedeeming(false)
    }
  }

  // Desvincular un entrenador (el cliente elimina su propio vínculo).
  const removeTrainer = async (linkId) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('trainer_clients').delete().eq('id', linkId)
      if (err) throw err
      await fetchTrainers()
    } catch (err) {
      console.error('Error removing trainer:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  return { trainers, loading, error, redeeming, redeemCode, removeTrainer, fetchTrainers }
}
