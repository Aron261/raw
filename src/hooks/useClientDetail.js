import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcAge } from './useProfile'

// useClientDetail(clientId) — trae el perfil de un cliente para la vista del
// entrenador. Las rutinas, metas y progreso se cargan en la página componiendo
// useRoutines(clientId) / useGoals(clientId) / useDashboard(clientId).
export function useClientDetail(clientId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()
      if (err) throw err
      setProfile(data || {})
    } catch (err) {
      console.error('Error fetching client profile:', err)
      setError(err.message || 'Error inesperado')
      setProfile({})
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const age = profile?.birth_date ? calcAge(profile.birth_date) : null

  return { profile, age, loading, error }
}
