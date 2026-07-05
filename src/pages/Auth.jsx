import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { ERROR_STYLE, pressProps } from '../lib/ui'
import { Button, Logo } from '../components/ui'

export default function Auth() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const { prompt, install, isInstalled, isIOS } = useInstallPrompt()

  // mode: 'login' | 'signup' | 'reset'
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email)
        setMessage('Si el email existe, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja.')
      } else if (mode === 'login') {
        await signIn(email, password)
        navigate('/', { replace: true })
      } else {
        const { data } = await signUp(email, password)
        if (data?.user?.identities?.length === 0) {
          setError('Este email ya está registrado. Inicia sesión.')
        } else if (data?.session) {
          navigate('/', { replace: true })
        } else {
          setMessage('Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(err.message || 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next) => {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  return (
    <div
      className="fade-in"
      style={{
        minHeight: '100dvh',
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      {/* ── Logo + Branding ── */}
      <div style={{ textAlign: 'center', marginBottom: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <Logo size={96} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '42px', letterSpacing: '0.03em', color: 'var(--c-text)', lineHeight: 1 }}>
          RAW
        </span>
        {/* Tagline */}
        <p style={{
          color: 'var(--c-text-dim)',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.32em',
          marginTop: '-4px',
        }}>
          We Do Gym
        </p>
      </div>

      {/* ── Install banner ── */}
      {!isInstalled && (prompt || isIOS) && (
        <div
          className="fade-in"
          style={{
            width: '100%', maxWidth: '340px', marginBottom: '28px',
            border: '1px solid var(--c-border-subtle)', borderRadius: '16px', overflow: 'hidden',
          }}
        >
          {prompt && (
            <button
              onClick={install}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '14px 16px',
                background: 'var(--c-surface)',
                transition: 'background 150ms var(--ease-out)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-surface)'}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Instalar en Android
                </p>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                  Agrega RAW a tu pantalla de inicio
                </p>
              </div>
              <span style={{ color: 'var(--c-accent)', fontSize: '18px', marginLeft: '12px' }}>↓</span>
            </button>
          )}

          {isIOS && (
            <div style={{ padding: '14px 16px', background: 'var(--c-surface)' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Instalar en iPhone
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
                Toca <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>Compartir</span>{' '}
                <span style={{ fontSize: '13px' }}>⎋</span> y luego{' '}
                <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>"Agregar a pantalla de inicio"</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Form ── */}
      <div style={{ width: '100%', maxWidth: '340px' }}>

        {/* Mode toggle — oculto en recuperación de contraseña */}
        {mode !== 'reset' && (
          <div style={{
            display: 'flex',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: '14px',
            padding: '3px',
            marginBottom: '20px',
          }}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                style={{
                  flex: 1, padding: '8px',
                  fontSize: '10px', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  borderRadius: '10px',
                  transition: 'background 200ms var(--ease-out), color 200ms var(--ease-out)',
                  background: mode === m ? 'var(--c-surface-2)' : 'transparent',
                  color: mode === m ? 'var(--c-text)' : 'var(--c-text-dim)',
                }}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
              Restablecer contraseña
            </h2>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>
              Ingresa tu email y te enviaremos un enlace para crear una nueva.
            </p>
          </div>
        )}

        {error && (
          <div className="fade-in" style={{ ...ERROR_STYLE, marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {message && (
          <div
            className="fade-in"
            style={{
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid var(--c-border-subtle)',
              color: 'var(--c-text-secondary)',
              fontSize: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              marginBottom: '14px',
              lineHeight: 1.4,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            full
            size="lg"
            loading={loading}
            disabled={loading}
            style={{ marginTop: '4px' }}
          >
            {loading ? 'Cargando...' : mode === 'reset' ? 'Enviar enlace' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Button>
        </form>

        {/* Enlaces contextuales */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('reset')}
              style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'transparent' }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'transparent' }}
            >
              ← Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
