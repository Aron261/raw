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

  const checkApproval = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('beta_approved')
        .eq('id', user.id)
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
  }, [user])

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
