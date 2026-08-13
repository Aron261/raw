import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { ERROR_STYLE, pressProps } from '../lib/ui'
import { Button, Logo } from '../components/ui'
import { useLang } from '../hooks/useLang'

// Los errores de Supabase Auth llegan en inglés técnico ('Invalid login
// credentials'). En la pantalla más sensible de la app no se muestra jerga de
// proveedor: se traducen los conocidos y el resto cae en un genérico honesto.
function authErrorMessage(err, t) {
  const m = err?.message || ''
  if (/invalid login credentials/i.test(m)) return t('Email o contraseña incorrectos.')
  if (/email not confirmed/i.test(m)) return t('Confirma tu email antes de entrar. Revisa tu bandeja.')
  if (/for security purposes|rate limit|too many/i.test(m)) return t('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
  if (/at least 6 characters/i.test(m)) return t('La contraseña debe tener al menos 6 caracteres.')
  return m || t('Algo salió mal.')
}

export default function Auth() {
  const { t } = useLang()
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { prompt, install, isInstalled, isIOS } = useInstallPrompt()

  // A dónde ir tras entrar. Lo usa /oauth/consent para volver al flujo de
  // autorización en vez de caer en la home. Solo se aceptan rutas internas
  // ("/algo"): un redirect a otro dominio sería un vector de phishing.
  const raw = searchParams.get('redirect')
  const redirectTo = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'

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
        setMessage(t('Si el email existe, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja.'))
      } else if (mode === 'login') {
        await signIn(email, password)
        navigate(redirectTo, { replace: true })
      } else {
        const { data } = await signUp(email, password)
        if (data?.user?.identities?.length === 0) {
          setError(t('Este email ya está registrado. Inicia sesión.'))
        } else if (data?.session) {
          navigate(redirectTo, { replace: true })
        } else {
          setMessage(t('Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.'))
          setMode('login')
        }
      }
    } catch (err) {
      setError(authErrorMessage(err, t))
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
    <div className="fade-in min-h-dvh lg:grid lg:grid-cols-2" style={{ background: 'var(--c-bg)' }}>

      {/* ── Panel de marca (solo PC) — el único bloque "drenched" del acceso:
             fondo acción con texto on-action (regla Ink-on-Pink) ── */}
      <div
        className="hidden lg:flex"
        style={{
          background: 'var(--c-action)', color: 'var(--c-on-action)',
          flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px', minHeight: '100dvh',
        }}
      >
        <span className="font-display" style={{ fontSize: '26px', lineHeight: 1 }}>RAW</span>
        <div>
          <p className="font-display" style={{ fontSize: 'clamp(44px, 4.5vw, 72px)', lineHeight: 1.04 }}>{t('Registra.')}<br />{t('Progresa.')}<br />{t('Nada más.')}</p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', marginTop: '20px' }}>
            We Do Gym
          </p>
        </div>
      </div>

      {/* ── Columna de acceso — en móvil es la pantalla completa ── */}
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px',
        }}
      >

      {/* ── Logo + Branding — en PC la marca vive en el panel izquierdo.
             display lo controlan las clases (flex / lg:hidden); no ponerlo
             inline o pisaría el lg:hidden. ── */}
      <div className="flex lg:hidden" style={{ textAlign: 'center', marginBottom: '36px', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <Logo size={96} />
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '42px', letterSpacing: '-0.04em', color: 'var(--c-text)', lineHeight: 1 }}>
          RAW
        </span>
        {/* Tagline */}
        <p style={{
          color: 'var(--c-text-dim)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '-0.01em',
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
            border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
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
                <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {t('Instalar en Android')}
                </p>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                  {t('Agrega RAW a tu pantalla de inicio')}
                </p>
              </div>
              <span style={{ color: 'var(--c-action-text)', fontSize: '18px', marginLeft: '12px' }}>↓</span>
            </button>
          )}

          {isIOS && (
            <div style={{ padding: '14px 16px', background: 'var(--c-surface)' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '6px' }}>
                {t('Instalar en iPhone')}
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
                {t('Toca')} <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>{t('Compartir')}</span>{' '}
                <span style={{ fontSize: '13px' }}>⎋</span> {t('y luego')}{' '}
                <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>"{t('Agregar a pantalla de inicio')}"</span>
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
            border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
            borderRadius: 'var(--r-md)',
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
                  fontSize: '10px', fontWeight: 800, letterSpacing: '-0.01em',
                  borderRadius: 'var(--r-sm)',
                  transition: 'background 200ms var(--ease-out), color 200ms var(--ease-out)',
                  background: mode === m ? 'var(--c-surface-2)' : 'transparent',
                  color: mode === m ? 'var(--c-text)' : 'var(--c-text-dim)',
                }}
              >
                {t(m === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}
              </button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
              {t('Restablecer contraseña')}
            </h2>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>
              {t('Ingresa tu email y te enviaremos un enlace para crear una nueva.')}
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
              borderRadius: 'var(--r-sm)',
              marginBottom: '14px',
              lineHeight: 1.4,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="auth-email" style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', display: 'block', marginBottom: '6px' }}>
              {t('Email')}
            </label>
            <input
              id="auth-email"
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
              <label htmlFor="auth-password" style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', display: 'block', marginBottom: '6px' }}>
                {t('Contraseña')}
              </label>
              <input
                id="auth-password"
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
            {t(loading ? 'Cargando...' : mode === 'reset' ? 'Enviar enlace' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}
          </Button>
        </form>

        {/* Enlaces contextuales */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('reset')}
              style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', background: 'transparent' }}
            >
              {t('¿Olvidaste tu contraseña?')}
            </button>
          )}
          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', background: 'transparent' }}
            >
              ← {t('Volver a iniciar sesión')}
            </button>
          )}
        </div>
      </div>

      </div>{/* /columna de acceso */}
    </div>
  )
}
