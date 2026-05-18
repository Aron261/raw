import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { ERROR_STYLE, pressProps } from '../lib/ui'

// SVG del disco de pesas — versión gris/plata sobre fondo blanco
function WeightDisc({ size = 160 }) {
  const cx = 100, cy = 100

  // 6 tornillos alrededor del centro
  const bolts = [0, 60, 120, 180, 240, 300].map(deg => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + 42 * Math.cos(rad), y: cy + 42 * Math.sin(rad) }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Sombra suave */}
      <circle cx="100" cy="104" r="90" fill="rgba(0,0,0,0.06)" />

      {/* Borde exterior */}
      <circle cx={cx} cy={cy} r="94" fill="#EAEAEA" stroke="#D4D4D4" strokeWidth="2" />

      {/* Cuerpo del disco */}
      <circle cx={cx} cy={cy} r="86" fill="#F0F0F0" />

      {/* Surco exterior */}
      <circle cx={cx} cy={cy} r="78" fill="none" stroke="#D8D8D8" strokeWidth="3" />

      {/* Área interior */}
      <circle cx={cx} cy={cy} r="72" fill="#E8E8E8" />

      {/* Surco interior */}
      <circle cx={cx} cy={cy} r="62" fill="none" stroke="#D0D0D0" strokeWidth="2" />

      {/* Plano central */}
      <circle cx={cx} cy={cy} r="56" fill="#EFEFEF" />

      {/* Hub central */}
      <circle cx={cx} cy={cy} r="22" fill="#DCDCDC" stroke="#C8C8C8" strokeWidth="1.5" />

      {/* Agujero central */}
      <circle cx={cx} cy={cy} r="10" fill="#C4C4C4" stroke="#B8B8B8" strokeWidth="1" />

      {/* Tornillos */}
      {bolts.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="4.5" fill="#DADADА" stroke="#C8C8C8" strokeWidth="1" />
      ))}

      {/* Texto RAW centrado */}
      <text
        x="100"
        y="107"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1A1A1A"
        fontSize="26"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="3"
      >
        RAW
      </text>
    </svg>
  )
}

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
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        {/* Disco */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <WeightDisc size={148} />
        </div>

        {/* Nombre */}
        <h1
          style={{
            fontSize: 'clamp(52px, 16vw, 80px)',
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

        {/* Línea roja divisora */}
        <div style={{
          width: '48px', height: '2px',
          background: 'var(--c-accent)',
          margin: '10px auto 8px',
          borderRadius: '1px',
        }} />

        {/* Tagline */}
        <p style={{
          color: 'var(--c-text-dim)',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.28em',
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

        {/* Mode toggle */}
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              marginTop: '4px', padding: '14px',
              fontSize: '12px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
            {...pressProps(0.97)}
          >
            {loading
              ? <><span className="spinner" /><span>Cargando...</span></>
              : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
