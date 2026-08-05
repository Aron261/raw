import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'

// Qué asistentes tienen acceso a esta cuenta, y cómo cortarlo.
//
// Autorizar un conector era de ida: no había pantalla que dijera qué está
// conectado ni forma de revocarlo desde la app. Los datos viven en el esquema
// `auth`, que PostgREST no expone, así que todo pasa por dos RPC
// SECURITY DEFINER (supabase/oauth_connections.sql) que filtran por auth.uid().
export function useOAuthConnections() {
  const { user } = useAuth()
  const key = user ? `oauth-connections:${user.id}` : null
  const [revoking, setRevoking] = useState(null)
  const [revokeError, setRevokeError] = useState(null)

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_oauth_connections')
    if (error) throw error
    return data || []
  }, [])

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)

  const revoke = async (consentId) => {
    setRevoking(consentId)
    setRevokeError(null)
    try {
      const { error: err } = await supabase.rpc('revoke_oauth_connection', { p_consent_id: consentId })
      if (err) throw err
      // Fuera de la lista al momento: la fila ya no representa nada vivo.
      mutateCache(key, (prev) => (prev || []).filter(c => c.id !== consentId))
    } catch (err) {
      setRevokeError(err.message || 'No se pudo revocar')
      throw err
    } finally {
      setRevoking(null)
    }
  }

  return {
    connections: data || [],
    loading,
    error: error ? (error.message || 'Error inesperado') : null,
    refetch,
    revoke,
    revoking,
    revokeError,
  }
}
