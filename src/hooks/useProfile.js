import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

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
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      setProfile(data || {})
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile({})
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

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
      setProfile(prev => ({ ...prev, ...updates }))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const age = profile?.birth_date ? calcAge(profile.birth_date) : null

  return { profile, loading, saving, saveError, saveSuccess, saveProfile, age }
}
