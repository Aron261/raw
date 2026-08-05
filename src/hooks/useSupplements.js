import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'
import { toLocalISODate } from '../lib/calendar'

// El stack de suplementos y el checklist de hoy.
//
// Las tablas existían desde hace tiempo (supabase/longevity.sql) sin una sola
// pantalla que las usara. Esto es lo mínimo que las hace valer: qué tomas y
// qué llevas tomado hoy.
//
// La fecha se calcula en LOCAL, no en UTC: a las 19:00 en Bogotá ya es el día
// siguiente en UTC, así que un toISOString() partiría el día por la mitad y
// haría reaparecer el checklist a media tarde. Se reutiliza la misma función
// que la nutrición para que las dos pantallas coincidan en dónde empieza el día.
export function useSupplements(date = null) {
  const { user } = useAuth()
  const day = date || toLocalISODate(new Date())
  const key = user ? `supplements:${user.id}:${day}` : null
  const [error, setError] = useState(null)

  const fetcher = useCallback(async () => {
    const [{ data: stack, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
      supabase.from('supplements').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('sort_order').order('created_at'),
      supabase.from('supplement_logs').select('supplement_id')
        .eq('user_id', user.id).eq('taken_on', day),
    ])
    if (e1) throw e1
    if (e2) throw e2
    const tomados = new Set((logs || []).map(l => l.supplement_id))
    return (stack || []).map(s => ({ ...s, taken: tomados.has(s.id) }))
  }, [user, day])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const supplements = data || []

  // Optimista: marcar es el gesto que se repite cada mañana y no puede esperar
  // a que vuelva el servidor.
  const setTaken = async (id, taken) => {
    setError(null)
    const antes = supplements
    mutateCache(key, prev => (prev || []).map(s => (s.id === id ? { ...s, taken } : s)))
    try {
      if (taken) {
        const { error: err } = await supabase.from('supplement_logs')
          .upsert({ user_id: user.id, supplement_id: id, taken_on: day },
                   { onConflict: 'supplement_id,taken_on' })
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('supplement_logs').delete()
          .eq('user_id', user.id).eq('supplement_id', id).eq('taken_on', day)
        if (err) throw err
      }
    } catch (err) {
      mutateCache(key, antes)   // devolver la casilla a donde estaba
      setError(err.message || 'No se pudo guardar')
    }
  }

  const addSupplement = async ({ name, dose, timing, note }) => {
    setError(null)
    const { data: row, error: err } = await supabase.from('supplements').insert({
      user_id: user.id,
      name: String(name).trim(),
      dose: dose?.trim() || null,
      timing: timing?.length ? timing : [],
      note: note?.trim() || null,
      sort_order: supplements.length,
    }).select().maybeSingle()
    if (err) { setError(err.message); throw err }
    mutateCache(key, prev => [...(prev || []), { ...row, taken: false }])
    return row
  }

  // Baja lógica y no borrado: los registros de haberlo tomado son historial y
  // un delete se los llevaría por cascada. Dejar de tomar algo no es no
  // haberlo tomado nunca.
  const removeSupplement = async (id) => {
    setError(null)
    const antes = supplements
    mutateCache(key, prev => (prev || []).filter(s => s.id !== id))
    const { error: err } = await supabase.from('supplements')
      .update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    if (err) { mutateCache(key, antes); setError(err.message); throw err }
  }

  return {
    supplements,
    loading,
    error: error || (loadError ? (loadError.message || 'Error inesperado') : null),
    refetch,
    setTaken,
    addSupplement,
    removeSupplement,
  }
}
