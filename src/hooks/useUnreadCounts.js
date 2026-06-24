import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useUnreadCounts — cuenta los mensajes sin leer del usuario actual, agrupados
// por el OTRO participante de cada conversación. Devuelve un mapa
// { otherUserId: cantidad }. Se actualiza en vivo (Realtime) y se puede
// refrescar manualmente (p. ej. al volver de un chat).
export function useUnreadCounts() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({})

  const fetchCounts = useCallback(async () => {
    if (!user) return
    // RLS limita esto a las conversaciones del usuario.
    const { data, error } = await supabase
      .from('messages')
      .select('trainer_id, client_id, sender_id')
      .is('read_at', null)
      .neq('sender_id', user.id)
    if (error) { console.error('Error fetching unread counts:', error); return }

    const map = {}
    for (const m of data || []) {
      const other = m.trainer_id === user.id ? m.client_id : m.trainer_id
      map[other] = (map[other] || 0) + 1
    }
    setCounts(map)
  }, [user])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  // En vivo: un mensaje entrante incrementa el contador del remitente.
  useEffect(() => {
    if (!user) return
    // Nombre de canal único por instancia: este hook se monta en varias
    // pantallas (Perfil, Coach, nav) y Supabase reusa el canal por topic, así
    // que un nombre fijo provoca `.on()` después de `.subscribe()` → crash.
    const channel = supabase
      .channel(`unread-counts:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (!m || m.sender_id === user.id) return
        if (m.trainer_id !== user.id && m.client_id !== user.id) return
        const other = m.trainer_id === user.id ? m.client_id : m.trainer_id
        setCounts(prev => ({ ...prev, [other]: (prev[other] || 0) + 1 }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return { counts, total, fetchCounts }
}
