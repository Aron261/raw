import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { ERROR_STYLE } from '../lib/ui'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { prompt, install, isInstalled, isIOS } = useInstallPrompt()

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
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/', { replace: true })
      } else {
        const { data } = await signUp(email, password)
        if (data?.user?.identities?.length === 0) {
          setError('This email is already registered. Please sign in.')
        } else if (data?.session) {
          navigate('/', { replace: true })
        } else {
          setMessage('Account created. Check your email to confirm, then sign in.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
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
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1
          style={{
            fontSize: 'clamp(72px, 20vw, 120px)',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            color: 'var(--c-text)',
            userSelect: 'none',
          }}
        >
          RAW
        </h1>
        <p
          style={{
            color: 'var(--c-text-dim)',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            marginTop: '10px',
          }}
        >
          Workout Logger
        </p>
      </div>

      {/* ── Install banner ── */}
      {!isInstalled && (prompt || isIOS) && (
        <div
          className="fade-in"
          style={{
            width: '100%',
            maxWidth: '340px',
            marginBottom: '32px',
            border: '1px solid var(--c-border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Android / Chrome */}
          {prompt && (
            <button
              onClick={install}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '14px 16px',
                background: 'var(--c-surface)',
                transition: `background 150ms var(--ease-out)`,
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

          {/* iOS / Safari */}
          {isIOS && (
            <div style={{ padding: '14px 16px', background: 'var(--c-surface)' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Instalar en iPhone
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
                Toca <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>Compartir</span> {' '}
                <span style={{ fontSize: '13px' }}>⎋</span> y luego{' '}
                <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>"Agregar a pantalla de inicio"</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: '4px',
            padding: '3px',
            marginBottom: '20px',
          }}
        >
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                borderRadius: '2px',
                transition: `background 200ms var(--ease-out), color 200ms var(--ease-out)`,
                background: mode === m ? 'var(--c-surface-2)' : 'transparent',
                color: mode === m ? 'var(--c-text)' : 'var(--c-text-dim)',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {error && (
          <div className="fade-in" style={{ ...ERROR_STYLE, marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {message && (
          <div
            className="fade-in"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-secondary)',
              fontSize: '12px',
              padding: '10px 12px',
              borderRadius: '3px',
              marginBottom: '14px',
              lineHeight: 1.4,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label
              style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}
            >
              Password
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ marginTop: '4px', padding: '14px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading
              ? <><span className="spinner" /><span>Loading...</span></>
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
