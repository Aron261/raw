import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBetaGate } from '../hooks/useBetaGate'
import { ERROR_STYLE } from '../lib/ui'
import { Button, Logo } from '../components/ui'
import BetaGate from './BetaGate'
import { useLang } from '../hooks/useLang'

// Pantalla de autorización OAuth.
//
// Aquí aterriza alguien que está conectando su cuenta de RAW a una app externa
// (en la práctica, su propia cuenta de Claude). Supabase manda con
// ?authorization_id=... y espera que aprobemos o rechacemos esa autorización.
//
// Va montada FUERA de RequireAuth a propósito: RequireAuth renderiza <BetaGate />
// en el sitio en vez de navegar, y eso se comería el authorization_id de la URL.
// Por eso el control de sesión y de beta se hace aquí dentro, conservando la URL.

// Lo que de verdad puede hacer el conector. El "scope" de OAuth dice
// "openid email profile", que no le cuenta nada útil a nadie. Esta lista sí:
// es la que corresponde a las herramientas del servidor MCP y a la guardia de
// escritura de supabase/agent_audit.sql.
const CAN_READ = [
  'Tus entrenos registrados, series y progreso',
  'Tus rutinas y ciclos',
  'Tu perfil, objetivos y registros de peso',
  'Tu nutrición y tus alimentos guardados',
]

const CAN_WRITE = [
  'Crear y editar rutinas y ciclos',
  'Crear y borrar objetivos',
  'Registrar comidas y peso corporal',
]

const CANNOT = [
  'Registrar o modificar entrenos y series',
  'Cambiar tu perfil o tus objetivos de macros',
  'Ver datos de otras personas',
  'Modificar la app en sí',
]

function Section({ title, items, tone }) {
  const { t } = useLang()
  const color = tone === 'no' ? 'var(--c-text-muted)' : 'var(--c-text-secondary)'
  const mark = tone === 'no' ? '✕' : '✓'
  const markColor = tone === 'no' ? 'var(--c-text-muted)' : 'var(--c-accent)'
  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--c-text-dim)', marginBottom: '8px',
      }}>
        {title}
      </p>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map(item => (
          <li key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: markColor, fontSize: '11px', lineHeight: 1.5, flexShrink: 0 }}>{mark}</span>
            <span style={{ color, fontSize: '12px', lineHeight: 1.5 }}>{t(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function OAuthConsent() {
  const { t } = useLang()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const beta = useBetaGate()

  const authorizationId = params.get('authorization_id')

  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(null)   // 'approve' | 'deny' | null
  const [error, setError] = useState(null)

  const selfUrl = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId || '')}`

  // Sin sesión → al login, conservando a dónde volver.
  useEffect(() => {
    if (authLoading || user) return
    navigate(`/login?redirect=${encodeURIComponent(selfUrl)}`, { replace: true })
  }, [authLoading, user, navigate, selfUrl])

  const load = useCallback(async () => {
    if (!authorizationId || !user || !beta.approved) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (err) throw err
      // Si ya se había consentido antes, Supabase devuelve directamente a dónde ir.
      if (data && !data.authorization_id && data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      setDetails(data)
    } catch (err) {
      setError(err.message || t('No se pudo cargar la solicitud de autorización.'))
    } finally {
      setLoading(false)
    }
  }, [authorizationId, user, beta.approved])

  useEffect(() => { load() }, [load])

  const decide = async (action) => {
    setWorking(action)
    setError(null)
    try {
      const fn = action === 'approve'
        ? supabase.auth.oauth.approveAuthorization
        : supabase.auth.oauth.denyAuthorization
      const { data, error: err } = await fn(authorizationId)
      if (err) throw err
      if (data?.redirect_url) window.location.href = data.redirect_url
      else navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || t('No se pudo completar la autorización.'))
      setWorking(null)
    }
  }

  // ── Estados previos ─────────────────────────────────────────────────────

  if (authLoading || (!user && !authLoading)) return <Splash />

  // La puerta beta se aplica aquí dentro para no perder el authorization_id.
  if (beta.loading) return <Splash />
  if (!beta.approved) return <BetaGate />

  if (!authorizationId) {
    return (
      <Shell>
        <h1 style={H1}>{t('Solicitud incompleta')}</h1>
        <p style={P}>
          Falta el identificador de autorización. Vuelve a intentar la conexión desde la
          aplicación que quieres conectar.
        </p>
        <Button onClick={() => navigate('/')} variant="secondary" style={{ marginTop: '18px' }}>
          {t('Ir a RAW')}
        </Button>
      </Shell>
    )
  }

  if (loading) return <Splash />

  // Si no se pudo cargar la solicitud, NO se muestra la pantalla de consentimiento.
  // Ofrecer "Autorizar" aquí sería pedir que apruebes algo que no hemos podido
  // ni leer: no sabríamos qué app es ni a dónde te devolvería.
  if (!details) {
    return (
      <Shell>
        <h1 style={H1}>{t('No se pudo cargar la solicitud')}</h1>
        <p style={P}>
          No hemos podido verificar quién pide acceso, así que no se muestra nada que autorizar.
          Vuelve a intentarlo desde la aplicación que quieres conectar.
        </p>
        {error && <div style={{ ...ERROR_STYLE, marginTop: '14px' }}>{error}</div>}
        <Button onClick={() => navigate('/')} variant="secondary" style={{ marginTop: '18px' }}>
          Ir a RAW
        </Button>
      </Shell>
    )
  }

  const clientName = details?.client?.client_name || details?.client_name || t('Una aplicación externa')
  const redirectUri = details?.redirect_uri || details?.client?.redirect_uri

  return (
    <Shell>
      <h1 style={H1}>
        {t('Conectar RAW con')} <span style={{ color: 'var(--c-action-text)' }}>{clientName}</span>
      </h1>
      <p style={P}>
        Le darás acceso a tus datos de entrenamiento para que puedas planificar desde ahí.
        Puedes revocarlo cuando quieras.
      </p>

      <div style={{ height: '1px', background: 'var(--c-border-subtle)', margin: '20px 0' }} />

      <Section title={t('Podrá leer')} items={CAN_READ} />
      <Section title={t('Podrá escribir')} items={CAN_WRITE} />
      <Section title={t('No podrá')} items={CANNOT} tone="no" />

      {redirectUri && (
        <div style={{
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
          borderRadius: '10px', padding: '10px 12px', marginBottom: '18px',
        }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--c-text-dim)', marginBottom: '4px',
          }}>
            {t('Te devolverá a')}
          </p>
          {/* Se muestra tal cual: si no reconoces este destino, no autorices. */}
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--c-text-secondary)',
            wordBreak: 'break-all', lineHeight: 1.4,
          }}>
            {redirectUri}
          </p>
        </div>
      )}

      {error && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Button onClick={() => decide('approve')} disabled={!!working} loading={working === 'approve'}>
          {t('Autorizar')}
        </Button>
        <Button onClick={() => decide('deny')} disabled={!!working} variant="secondary">
          {t('Cancelar')}
        </Button>
      </div>

      <p style={{
        color: 'var(--c-text-dim)', fontSize: '10px', lineHeight: 1.5,
        marginTop: '16px', textAlign: 'center',
      }}>
        {t('Si no has sido tú quien inició esta conexión, cancela.')}
      </p>
    </Shell>
  )
}

// ── Presentación compartida ───────────────────────────────────────────────

const H1 = {
  color: 'var(--c-text)', fontSize: '17px', fontWeight: 800,
  letterSpacing: '-0.02em', marginBottom: '6px', lineHeight: 1.3,
}
const P = { color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.5 }

function Shell({ children }) {
  const { t } = useLang()
  return (
    <div className="min-h-dvh" style={{ background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Logo size={64} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '34px', letterSpacing: '0.02em', color: 'var(--c-text)', lineHeight: 1 }}>RAW</span>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {t('Autorización')}
          </p>
        </div>
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Splash() {
  const { t } = useLang()
  return (
    <div className="min-h-dvh" style={{ background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em' }} className="animate-pulse">
        RAW
      </span>
    </div>
  )
}
