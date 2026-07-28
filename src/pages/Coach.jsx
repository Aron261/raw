import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useTrainer } from '../hooks/useTrainer'
import { useCoachFeed } from '../hooks/useCoachFeed'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Sheet, Button } from '../components/ui'

// "hace 2 h" / "ayer" / "hace 3 d" — a coach scans by recency, not calendar.
function relativeDate(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return mins <= 1 ? 'ahora' : `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

const fmtVol = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString('es-CO'))

// ── Feed row: one client workout ───────────────────────────────────────────
function FeedRow({ item, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
        padding: '12px 14px', background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)', borderRadius: '12px', marginBottom: '6px',
        minHeight: '44px', cursor: 'pointer', transition: 'border-color 150ms var(--ease-out)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
    >
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-action-text)', fontSize: '13px', fontWeight: 900,
      }}>
        {item.clientName.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.clientName}
          </span>
          {item.isPR && (
            <span style={{ flexShrink: 0, background: 'var(--c-record)', color: 'var(--c-record-ink)', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 5px', borderRadius: '2px' }}>
              PR
            </span>
          )}
        </div>
        <span style={{ display: 'block', color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name} · {item.volume > 0 ? `${fmtVol(item.volume)} kg` : `${item.exerciseCount} ej.`}
        </span>
      </div>
      <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.02em' }}>
        {relativeDate(item.startedAt)}
      </span>
    </button>
  )
}

// Badge rojo con la cantidad de mensajes sin leer
function UnreadBadge({ count }) {
  if (!count) return null
  return (
    <span style={{
      minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
      background: 'var(--c-accent)', color: 'var(--c-on-action)',
      fontSize: '10px', fontWeight: 800, lineHeight: '18px', textAlign: 'center',
      display: 'inline-block', flexShrink: 0,
    }}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

const SECTION_LABEL = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px',
}

// ── Modal: generar / mostrar código de invitación ─────────────────────────
function InviteModal({ onClose, onCreate, activeInvites, onDelete }) {
  const [code, setCode]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const newCode = await onCreate()
      setCode(newCode)
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard no disponible */ }
  }

  return (
    <Sheet title="Invitar cliente" onClose={onClose} maxHeight="85dvh">

        {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

        <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginBottom: '16px', lineHeight: 1.5 }}>
          Genera un código y compártelo con tu cliente. Él lo ingresa en su perfil
          (sección «Entrenador») para vincularse contigo.
        </p>

        {code ? (
          <div style={{
            padding: '20px', background: 'var(--c-surface)', borderRadius: '14px',
            border: '1px solid var(--c-accent-border)', textAlign: 'center', marginBottom: '16px',
          }}>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
              Código generado
            </p>
            <p style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, letterSpacing: '0.1em', marginBottom: '14px' }}>
              {code}
            </p>
            <Button variant="secondary" full onClick={() => copy(code)}>
              {copied ? '✓ Copiado' : 'Copiar código'}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            full
            size="lg"
            loading={saving}
            disabled={saving}
            onClick={handleCreate}
            style={{ marginBottom: '16px' }}
          >
            {saving ? 'Generando...' : 'Generar código'}
          </Button>
        )}

        {activeInvites.length > 0 && (
          <div>
            <p style={SECTION_LABEL}>Códigos activos ({activeInvites.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeInvites.map(inv => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
                }}>
                  <span style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '0.08em' }}>
                    {inv.code}
                  </span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => copy(inv.code)}
                      style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => onDelete(inv.id)}
                      aria-label="Eliminar código"
                      style={{ color: 'var(--c-text-ghost)', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </Sheet>
  )
}

// ── Card de cliente ────────────────────────────────────────────────────────
function ClientCard({ client, onOpen, onRevoke, onChat, unread }) {
  const [confirm, setConfirm] = useState(false)
  const name = client.profile?.name || 'Cliente'
  const initial = name.charAt(0).toUpperCase()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 16px', background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)', borderRadius: '14px', marginBottom: '6px',
    }}>
      <button
        onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textAlign: 'left' }}
        {...pressProps(0.99)}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
          background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'var(--c-action-text)', fontSize: '15px', fontWeight: 900 }}>{initial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </p>
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            {client.profile?.level && (
              <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>{client.profile.level}</span>
            )}
            {client.profile?.goal && (
              <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {client.profile.goal}</span>
            )}
          </div>
        </div>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <UnreadBadge count={unread} />
        <button
          onClick={() => onChat(client.clientId)}
          aria-label="Chat"
          style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-accent-border)', padding: '5px 10px', borderRadius: '8px' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dim)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Chat
        </button>
        {confirm ? (
          <button
            onClick={() => onRevoke(client.linkId)}
            style={{ color: 'var(--c-action-text)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Confirmar
          </button>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            onMouseLeave={() => setConfirm(false)}
            aria-label="Revocar cliente"
            style={{ color: 'var(--c-text-ghost)', fontSize: '13px', lineHeight: 1, padding: '4px 6px', transition: 'color 150ms var(--ease-out)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Coach() {
  const navigate = useNavigate()
  const {
    isTrainer, clients, activeInvites, loading, error,
    createInvite, deleteInvite, revokeClient,
  } = useTrainer()
  const { counts } = useUnreadCounts()

  const [showInvite, setShowInvite] = useState(false)
  const [actionError, setActionError] = useState(null)

  const handleRevoke = async (linkId) => {
    setActionError(null)
    try { await revokeClient(linkId) } catch (e) { setActionError(e.message) }
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const { feed, loading: feedLoading } = useCoachFeed(activeClients)

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="fade-in" style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <button
              onClick={() => navigate('/')}
              className="md:hidden"
              style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0, padding: '6px 4px 6px 0', marginTop: '2px' }}
              aria-label="Volver al menú"
            >
              ←
            </button>
            <div>
              <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
                Clientes
              </h1>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
                Panel de entrenador
              </p>
            </div>
          </div>
        </div>

        {/* Aviso si el rol no está activo */}
        {!loading && !isTrainer && (
          <div className="fade-in" style={{
            padding: '16px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
            borderRadius: '14px', marginBottom: '20px',
          }}>
            <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Activa el modo entrenador
            </p>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5 }}>
              Ve a tu <button onClick={() => navigate('/profile')} style={{ color: 'var(--c-action-text)', fontWeight: 700 }}>perfil</button> y
              activa «Soy entrenador» para empezar a invitar clientes.
            </p>
          </div>
        )}

        {/* Botón invitar */}
        <div className="fade-in" style={{ marginBottom: '28px', animationDelay: '20ms' }}>
          <Button
            variant="primary"
            full
            onClick={() => setShowInvite(true)}
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            + Invitar cliente
          </Button>
        </div>

        {(error || actionError) && (
          <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{error || actionError}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: '70px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        )}

        {/* Actividad reciente — qué han entrenado los clientes, lo más nuevo
            arriba, con el PR marcado. La razón de ser del panel: actuar, no
            solo mirar una lista. */}
        {!loading && activeClients.length > 0 && (feedLoading || feed.length > 0) && (
          <section className="fade-in" style={{ marginBottom: '28px', animationDelay: '30ms' }}>
            <p style={SECTION_LABEL}>Actividad reciente</p>
            {feedLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: '58px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '12px', opacity: 1 - i * 0.25 }} />
                ))}
              </div>
            ) : (
              feed.slice(0, 12).map((item, i) => (
                <div key={item.workoutId} className="stagger-item" style={{ '--i': i }}>
                <FeedRow
                  item={item}
                  onOpen={() => navigate(`/coach/cliente/${item.clientId}`)}
                />
                </div>
              ))
            )}
          </section>
        )}

        {/* Lista de clientes */}
        {!loading && (
          <>
            {activeClients.length > 0 ? (
              <section className="fade-in" style={{ animationDelay: '40ms' }}>
                <p style={SECTION_LABEL}>Clientes ({activeClients.length})</p>
                {activeClients.map((c, i) => (
                  <div key={c.linkId} className="stagger-item" style={{ '--i': i }}>
                  <ClientCard
                    client={c}
                    unread={counts[c.clientId] || 0}
                    onOpen={() => navigate(`/coach/cliente/${c.clientId}`)}
                    onChat={(id) => navigate(`/chat/${id}`)}
                    onRevoke={handleRevoke}
                  />
                  </div>
                ))}
              </section>
            ) : (
              <div className="fade-in" style={{
                textAlign: 'center', padding: '48px 20px',
                background: 'var(--c-surface)', border: '2px dashed var(--c-border)',
                borderRadius: '16px', animationDelay: '40ms',
              }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Sin clientes todavía
                </p>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '8px' }}>
                  Genera un código de invitación y compártelo para empezar.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreate={createInvite}
          onDelete={deleteInvite}
          activeInvites={activeInvites}
        />
      )}
    </Layout>
  )
}
