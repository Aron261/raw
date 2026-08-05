import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ERROR_STYLE } from '../lib/ui'
import { Button, Logo } from '../components/ui'
import { useLang } from '../hooks/useLang'

// Pantalla de destino del enlace de recuperación. supabase-js procesa el token
// del hash de la URL al cargar y abre una sesión de recuperación, así que aquí
// solo pedimos y guardamos la contraseña nueva.
export default function ResetPassword() {
  const { t } = useLang()
  const { user, loading, setNewPassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError(t('La contraseña debe tener al menos 6 caracteres.')); return }
    if (password !== confirm) { setError(t('Las contraseñas no coinciden.')); return }
    setSaving(true)
    try {
      await setNewPassword(password)
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1400)
    } catch (err) {
      setError(err.message || t('No se pudo actualizar la contraseña.'))
    } finally {
      setSaving(false)
    }
  }

  const shell = (children) => (
    <div className="fade-in" style={{ minHeight: '100dvh', background: 'var(--c-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <Logo size={72} />
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '32px', letterSpacing: '-0.04em', color: 'var(--c-text)', lineHeight: 1 }}>RAW</span>
      </div>
      <div style={{ width: '100%', maxWidth: '340px' }}>{children}</div>
    </div>
  )

  // Aún procesando el token del enlace
  if (loading) {
    return shell(
      <p className="animate-pulse" style={{ textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '12px', letterSpacing: '-0.01em' }}>
        {t('Verificando enlace…')}
      </p>
    )
  }

  // Sin sesión de recuperación → enlace inválido o expirado
  if (!user) {
    return shell(
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>
          {t('El enlace no es válido o expiró. Solicita uno nuevo.')}
        </div>
        <Button variant="primary" full size="lg" onClick={() => navigate('/login', { replace: true })}>
          {t('Volver a iniciar sesión')}
        </Button>
      </div>
    )
  }

  return shell(
    <>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
          {t('Nueva contraseña')}
        </h2>
        <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>
          {t('Elige una contraseña nueva para tu cuenta.')}
        </p>
      </div>

      {error && <div className="fade-in" style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{error}</div>}

      {done ? (
        <div style={{ textAlign: 'center', color: 'var(--c-success)', fontSize: '13px', fontWeight: 700 }}>
          ✓ Contraseña actualizada. Entrando…
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            aria-label={t('Nueva contraseña')}
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="input-field" placeholder="Nueva contraseña" required minLength={6}
            autoComplete="new-password" autoFocus
          />
          <input
            aria-label={t('Repite la contraseña')}
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="input-field" placeholder="Repite la contraseña" required minLength={6}
            autoComplete="new-password"
          />
          <Button type="submit" variant="primary" full size="lg" loading={saving} disabled={saving} style={{ marginTop: '4px' }}>
            {t(saving ? 'Guardando…' : 'Guardar contraseña')}
          </Button>
        </form>
      )}
    </>
  )
}
