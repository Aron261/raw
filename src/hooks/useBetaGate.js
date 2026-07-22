import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// useBetaGate — controla el acceso durante la beta.
//   · approved: si el usuario actual ya canjeó el código beta
//   · redeemCode(code): canjea el código compartido (RPC redeem_beta_code)
// El enforcement real vive en el RLS; esto solo dirige la UI.
export function useBetaGate() {
  const { user } = useAuth()
  const [approved, setApproved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState(null)

  // Depende del id, no del objeto `user`. supabase-js emite un objeto nuevo en
  // cada evento de sesión (TOKEN_REFRESHED, etc.) aunque sea la misma persona;
  // con el objeto como dependencia, cada refresco de token volvía a poner
  // loading = true, y RequireAuth cambia los hijos por <Splash /> mientras
  // tanto. Eso DESMONTA la pantalla: el calendario perdía el mes que mirabas
  // y cerraba la hoja del día a medio llenar. La aprobación de beta no cambia
  // porque se renueve un token; solo cuando cambia la persona.
  const userId = user?.id ?? null

  const checkApproval = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('beta_approved')
        .eq('id', userId)
        .maybeSingle()
      if (err) throw err
      setApproved(!!data?.beta_approved)
    } catch (err) {
      console.error('Error checking beta approval:', err)
      // Ante error, no aprobar (fail-closed): se queda en la pantalla del código
      setApproved(false)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { checkApproval() }, [checkApproval])

  const redeemCode = async (code) => {
    if (!code?.trim()) throw new Error('Ingresa el código')
    setRedeeming(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('redeem_beta_code', { p_code: code.trim() })
      if (err) throw err
      setApproved(true)
    } catch (err) {
      console.error('Error redeeming beta code:', err)
      setError(err.message || 'Código inválido')
      throw err
    } finally {
      setRedeeming(false)
    }
  }

  return { approved, loading, redeeming, error, redeemCode }
}
