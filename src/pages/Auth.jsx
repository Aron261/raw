import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { ERROR_STYLE, pressProps } from '../lib/ui'

// SVG disco de pesas — look oscuro/metálico, fiel al referente
function WeightDisc({ size = 172 }) {
  const cx = 100, cy = 100

  // 8 tornillos distribuidos uniformemente
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const rad = (i * 45 * Math.PI) / 180
    return { x: cx + 60 * Math.cos(rad), y: cy + 60 * Math.sin(rad) }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Gradiente radial para simular metal */}
        <radialGradient id="plateGrad" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#4A4A4A" />
          <stop offset="60%" stopColor="#1C1C1C" />
          <stop offset="100%" stopColor="#0E0E0E" />
        </radialGradient>

        {/* Borde exterior plateado */}
        <radialGradient id="rimGrad" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#D0D0D0" />
          <stop offset="50%" stopColor="#A0A0A0" />
          <stop offset="100%" stopColor="#787878" />
        </radialGradient>

        {/* Sombra drop */}
        <filter id="discShadow" x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="10" floodColor="#000000" floodOpacity="0.22" />
        </filter>

        {/* Hub interior */}
        <radialGradient id="hubGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#383838" />
          <stop offset="100%" stopColor="#111111" />
        </radialGradient>
      </defs>

      {/* ── Sombra base ── */}
      <ellipse cx="102" cy="106" rx="88" ry="86" fill="rgba(0,0,0,0.18)" />

      {/* ── Aro exterior plateado ── */}
      <circle cx={cx} cy={cy} r="95" fill="url(#rimGrad)" filter="url(#discShadow)" />

      {/* ── Paso a oscuro ── */}
      <circle cx={cx} cy={cy} r="91" fill="#1A1A1A" />

      {/* ── Cuerpo del disco ── */}
      <circle cx={cx} cy={cy} r="88" fill="url(#plateGrad)" />

      {/* ── Surco exterior (iluminado arriba) ── */}
      <circle cx={cx} cy={cy} r="82" fill="none" stroke="#404040" strokeWidth="3" />
      <circle cx={cx} cy={cy} r="82" fill="none" stroke="#555555" strokeWidth="1"
        strokeDasharray="252" strokeDashoffset="126" />

      {/* ── Plano intermedio ── */}
      <circle cx={cx} cy={cy} r="79" fill="#252525" />

      {/* ── Surco intermedio ── */}
      <circle cx={cx} cy={cy} r="74" fill="none" stroke="#404040" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="74" fill="none" stroke="#5A5A5A" strokeWidth="1"
        strokeDasharray="220" strokeDashoffset="110" />

      {/* ── Zona central oscura ── */}
      <circle cx={cx} cy={cy} r="71" fill="#1E1E1E" />

      {/* ── 8 tornillos ── */}
      {bolts.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r="5.5" fill="#141414" stroke="#4A4A4A" strokeWidth="1" />
          {/* ranura del tornillo */}
          <line
            x1={b.x - 2.5 * Math.cos((i * 45 + 45) * Math.PI / 180)}
            y1={b.y - 2.5 * Math.sin((i * 45 + 45) * Math.PI / 180)}
            x2={b.x + 2.5 * Math.cos((i * 45 + 45) * Math.PI / 180)}
            y2={b.y + 2.5 * Math.sin((i * 45 + 45) * Math.PI / 180)}
            stroke="#555555" strokeWidth="1" strokeLinecap="round"
          />
        </g>
      ))}

      {/* ── Surco interior ── */}
      <circle cx={cx} cy={cy} r="44" fill="none" stroke="#333333" strokeWidth="2" />

      {/* ── Hub central ── */}
      <circle cx={cx} cy={cy} r="41" fill="url(#hubGrad)" />
      <circle cx={cx} cy={cy} r="38" fill="none" stroke="#404040" strokeWidth="1" />

      {/* ── Agujero central ── */}
      <circle cx={cx} cy={cy} r="16" fill="#0A0A0A" stroke="#2A2A2A" strokeWidth="1.5" />

      {/* ── Texto RAW ── */}
      <text
        x="100" y="109"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFFFFF"
        fontSize="22"
        fontWeight="900"
        fontFamily="Anton, 'Arial Narrow', sans-serif"
        letterSpacing="4"
        style={{ textShadow: 'none' }}
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
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        {/* Disco principal */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <WeightDisc size={180} />
        </div>

        {/* Tagline */}
        <p style={{
          color: 'var(--c-text-dim)',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.32em',
          marginBottom: '0',
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
