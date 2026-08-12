import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'

// Calcula edad a partir de fecha de nacimiento
export function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function useProfile() {
  const { user } = useAuth()
  const key = user ? `profile:${user.id}` : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetcher = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    return data || {}
  }, [user])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const profile = data || null
  const fetchProfile = refetch

  // Sella la zona horaria del dispositivo en el perfil. No es cosmético: el
  // conector MCP necesita saber qué día es "hoy" PARA ESTA PERSONA — con el
  // servidor en UTC, una cena registrada desde Claude a las 8pm de Bogotá caía
  // en mañana. Silencioso e idempotente; la caché compartida evita repetirlo.
  useEffect(() => {
    if (!user || !data) return
    let tz = null
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { /* sin Intl */ }
    if (!tz || data.timezone === tz) return
    supabase.from('profiles')
      .upsert({ id: user.id, timezone: tz, updated_at: new Date().toISOString() })
      .then(({ error: err }) => {
        if (!err) mutateCache(key, prev => ({ ...(prev || {}), timezone: tz }))
      })
  }, [user, data, key])
  const error = loadError ? (loadError.message || 'Error inesperado') : null

  const saveProfile = async (updates) => {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ ...updates, id: user.id, updated_at: new Date().toISOString() })

      if (error) throw error
      mutateCache(key, prev => ({ ...(prev || {}), ...updates }))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const age = profile?.birth_date ? calcAge(profile.birth_date) : null

  return { profile, loading, saving, error, saveError, saveSuccess, saveProfile, fetchProfile, age }
}
