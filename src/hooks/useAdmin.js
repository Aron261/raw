import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

// useAdmin — datos del panel de administración. El gate real vive en las RPC
// (cada una verifica is_admin() en el servidor); aquí isAdmin solo dirige la UI.
export function useAdmin() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const isAdmin = !!profile?.is_admin

  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user || !isAdmin) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [ov, us] = await Promise.all([
        supabase.rpc('admin_overview'),
        supabase.rpc('admin_list_users'),
      ])
      if (ov.error) throw ov.error
      if (us.error) throw us.error
      setOverview(ov.data)
      setUsers(us.data || [])
    } catch (err) {
      console.error('Admin load error:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => { load() }, [load])

  const setBeta = async (target, value) => {
    const { error } = await supabase.rpc('admin_set_beta', { target, value })
    if (error) throw error
    setUsers(prev => prev.map(u => u.id === target ? { ...u, beta_approved: value } : u))
  }

  const setAdmin = async (target, value) => {
    const { error } = await supabase.rpc('admin_set_admin', { target, value })
    if (error) throw error
    setUsers(prev => prev.map(u => u.id === target ? { ...u, is_admin: value } : u))
  }

  const deleteUser = async (target) => {
    const { error } = await supabase.rpc('admin_delete_user', { target })
    if (error) throw error
    setUsers(prev => prev.filter(u => u.id !== target))
    await load()
  }

  return { isAdmin, overview, users, loading, error, refetch: load, setBeta, setAdmin, deleteUser }
}
