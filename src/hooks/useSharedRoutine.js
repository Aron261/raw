import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// useSharedRoutine(token) — el lado de quien abre el enlace.
//
// Lee el plan por RPC (get_shared_routine, SECURITY DEFINER) porque quien llega
// aquí normalmente no tiene sesión: el token es su único permiso. La RPC
// devuelve null tanto si el token no existe como si el dueño lo desactivó, y la
// pantalla no distingue los dos casos a propósito.
export function useSharedRoutine(token) {
  const [shared, setShared] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_shared_routine', { p_token: token })
      if (err) throw err
      setShared(data || null)
    } catch (err) {
      console.error('Error loading shared routine:', err)
      setError(err.message || 'No se pudo abrir el enlace')
      setShared(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Contador para el dueño. Best-effort: si falla, la copia ya está guardada y
  // no se le dice nada a quien la guardó.
  const noteImport = useCallback(async () => {
    if (!token) return
    try {
      await supabase.rpc('note_shared_routine_import', { p_token: token })
    } catch { /* solo es un contador */ }
  }, [token])

  return { shared, loading, error, notFound: !loading && !error && !shared, reload: load, noteImport }
}
