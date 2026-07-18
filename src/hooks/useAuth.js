import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { outbox } from '../lib/outbox'

// Auth context
export const AuthContext = createContext(null)

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Provider component (used in App.jsx)
export function useAuthProvider() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    // Never carry one account's unsynced writes into the next session on a
    // shared device — the same reason authed REST isn't service-worker cached.
    try { await outbox.clear() } catch { /* best-effort */ }
  }

  // Envía el correo de recuperación. El enlace lleva a /reset-password, donde
  // supabase-js procesa el token del hash y abre una sesión de recuperación.
  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  // Cambia la contraseña del usuario con sesión activa. Reautentica primero con
  // la contraseña actual para no permitir cambios desde una sesión secuestrada.
  const updatePassword = async (currentPassword, newPassword) => {
    if (!user?.email) throw new Error('Sesión no disponible')
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (reauthErr) throw new Error('La contraseña actual no es correcta')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // Fija una contraseña nueva usando la sesión de recuperación (sin la actual).
  const setNewPassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // Cambia el email. Supabase envía confirmación al correo nuevo (y al viejo);
  // el cambio no surte efecto hasta confirmar.
  const updateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
  }

  // Elimina la cuenta y todos los datos (RPC SECURITY DEFINER) y cierra sesión.
  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_own_account')
    if (error) throw error
    await supabase.auth.signOut()
    try { await outbox.clear() } catch { /* best-effort */ }
    setUser(null)
  }

  return {
    user, loading, signIn, signUp, signOut,
    sendPasswordReset, updatePassword, setNewPassword, updateEmail, deleteAccount,
  }
}
