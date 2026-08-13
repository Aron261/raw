import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Genera un código de invitación corto y legible (sin caracteres ambiguos).
function generateCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

// useTrainer — estado del lado entrenador:
//   · isTrainer (flag del perfil) + toggle
//   · lista de clientes vinculados (con su perfil)
//   · generación / listado / borrado de códigos de invitación
//   · revocar un cliente
export function useTrainer() {
  const { user } = useAuth()
  const [isTrainer, setIsTrainer] = useState(false)
  const [clients, setClients] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      // 1. Flag is_trainer del perfil
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('is_trainer')
        .eq('id', user.id)
        .maybeSingle()
      if (profErr) throw profErr
      setIsTrainer(!!prof?.is_trainer)

      // 2. Vínculos entrenador → cliente (activos y pendientes)
      const { data: links, error: linksErr } = await supabase
        .from('trainer_clients')
        .select('id, client_id, status, created_at')
        .eq('trainer_id', user.id)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false })
      if (linksErr) throw linksErr

      // 3. Perfiles de esos clientes (un entrenador activo puede leerlos vía RLS)
      const clientIds = (links || []).map(l => l.client_id)
      let profilesById = {}
      if (clientIds.length > 0) {
        const { data: profs, error: psErr } = await supabase
          .from('profiles')
          .select('id, name, level, goal')
          .in('id', clientIds)
        if (psErr) throw psErr
        profilesById = Object.fromEntries((profs || []).map(p => [p.id, p]))
      }

      setClients(
        (links || []).map(l => ({
          linkId: l.id,
          clientId: l.client_id,
          status: l.status,
          createdAt: l.created_at,
          profile: profilesById[l.client_id] || {},
        }))
      )

      // 4. Códigos de invitación sin usar
      const { data: invs, error: invErr } = await supabase
        .from('trainer_invites')
        .select('id, code, expires_at, used_by, used_at, created_at')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })
      if (invErr) throw invErr
      setInvites(invs || [])
    } catch (err) {
      console.error('Error fetching trainer data:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Activar / desactivar el rol de entrenador en el perfil.
  const toggleTrainer = async (value) => {
    if (!user) return
    setError(null)
    try {
      // upsert (no update) para crear la fila de perfil si el usuario aún no la tiene
      const { error: err } = await supabase
        .from('profiles')
        .upsert({ id: user.id, is_trainer: value, updated_at: new Date().toISOString() })
      if (err) throw err
      setIsTrainer(value)
    } catch (err) {
      console.error('Error toggling trainer role:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Crear un código de invitación nuevo (válido 14 días). Retorna el código.
  const createInvite = async () => {
    if (!user) throw new Error('Usuario no autenticado')
    setError(null)
    const code = generateCode()
    const expires = new Date()
    expires.setDate(expires.getDate() + 14)
    try {
      const { data, error: err } = await supabase
        .from('trainer_invites')
        .insert({ trainer_id: user.id, code, expires_at: expires.toISOString() })
        .select()
        .single()
      if (err) throw err
      await fetchAll()
      return data.code
    } catch (err) {
      console.error('Error creating invite:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const deleteInvite = async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('trainer_invites').delete().eq('id', id)
      if (err) throw err
      await fetchAll()
    } catch (err) {
      console.error('Error deleting invite:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Revocar el vínculo con un cliente (status = 'revoked').
  const revokeClient = async (linkId) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('trainer_clients')
        .update({ status: 'revoked' })
        .eq('id', linkId)
      if (err) throw err
      await fetchAll()
    } catch (err) {
      console.error('Error revoking client:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Un código vencido no es «activo»: seguía listado y el entrenador lo
  // compartía solo para que muriera en el canje con «Código inválido».
  const activeInvites = invites.filter(i =>
    !i.used_by && (!i.expires_at || new Date(i.expires_at) > new Date()))

  return {
    isTrainer,
    clients,
    invites,
    activeInvites,
    loading,
    error,
    fetchAll,
    toggleTrainer,
    createInvite,
    deleteInvite,
    revokeClient,
  }
}
