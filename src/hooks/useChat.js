import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useChat(otherUserId) — conversación 1-a-1 entre el usuario actual y otherUserId.
// Resuelve quién es entrenador y quién cliente desde el vínculo activo, carga el
// historial, escucha mensajes nuevos en vivo (Realtime) y permite enviar.
export function useChat(otherUserId) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherName, setOtherName] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // Par (trainer_id, client_id) que identifica la conversación
  const convoRef = useRef(null)

  const init = useCallback(async () => {
    if (!user || !otherUserId) return
    setLoading(true)
    setError(null)
    try {
      // 1. Resolver el vínculo activo entre ambos (en cualquier dirección)
      const { data: links, error: linkErr } = await supabase
        .from('trainer_clients')
        .select('trainer_id, client_id, status')
        .eq('status', 'active')
        .or(
          `and(trainer_id.eq.${user.id},client_id.eq.${otherUserId}),` +
          `and(trainer_id.eq.${otherUserId},client_id.eq.${user.id})`
        )
        .limit(1)
      if (linkErr) throw linkErr
      if (!links || links.length === 0) {
        throw new Error('No tienes una conversación activa con este usuario')
      }
      const convo = { trainer_id: links[0].trainer_id, client_id: links[0].client_id }
      convoRef.current = convo

      // 2. Nombre del otro participante
      const { data: prof } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', otherUserId)
        .maybeSingle()
      setOtherName(prof?.name || 'Usuario')

      // 3. Historial
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('trainer_id', convo.trainer_id)
        .eq('client_id', convo.client_id)
        .order('created_at', { ascending: true })
      if (msgErr) throw msgErr
      setMessages(msgs || [])
    } catch (err) {
      console.error('Error loading chat:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user, otherUserId])

  useEffect(() => { init() }, [init])

  // Suscripción Realtime a mensajes nuevos de esta conversación
  useEffect(() => {
    const convo = convoRef.current
    if (!convo) return

    const channel = supabase
      .channel(`chat:${convo.trainer_id}:${convo.client_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${convo.client_id}`,
        },
        (payload) => {
          const m = payload.new
          // Confirmar que pertenece a esta conversación
          if (m.trainer_id !== convo.trainer_id) return
          setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loading]) // se rearma cuando convoRef ya está resuelto

  const sendMessage = async (body) => {
    const text = (body || '').trim()
    const convo = convoRef.current
    if (!text || !convo || !user) return
    setSending(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('messages')
        .insert({
          trainer_id: convo.trainer_id,
          client_id: convo.client_id,
          sender_id: user.id,
          body: text,
        })
        .select('id, sender_id, body, created_at')
        .single()
      if (err) throw err
      // Optimista: añadimos de una (Realtime deduplica por id)
      setMessages(prev => (prev.some(x => x.id === data.id) ? prev : [...prev, data]))
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err.message || 'No se pudo enviar')
      throw err
    } finally {
      setSending(false)
    }
  }

  return { messages, otherName, loading, sending, error, sendMessage }
}
