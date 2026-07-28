import { useState } from 'react'
import { Sheet, Button } from './ui'
import { ERROR_STYLE } from '../lib/ui'
import { supabase } from '../lib/supabase'
import { useRoutineShare } from '../hooks/useRoutineShare'
import { useProfile } from '../hooks/useProfile'
import { useTrainer } from '../hooks/useTrainer'
import { shareMessage, routineToInput } from '../lib/share'
import { useLang } from '../hooks/useLang'

const eyebrow = {
  fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
}

// Enviar una copia a un cliente vinculado, sin pasar por el enlace.
//
// Un entrenador no quiere mandarle un enlace a su cliente para que lo abra y lo
// guarde: quiere que el ciclo aparezca ya en su app. La copia se escribe en la
// cuenta del cliente con la misma RPC que usa useRoutines cuando un entrenador
// opera sobre un cliente (create_routine_tree con user_id), así que hereda su
// RLS —solo vínculos activos— y queda marcada con assigned_by = entrenador.
// Se llama a la RPC aquí en vez de montar un useRoutines por cliente.
function AssignToClients({ routine }) {
  const { t } = useLang()
  const { clients, loading } = useTrainer()
  const [sendingId, setSendingId] = useState(null)
  const [sentIds, setSentIds] = useState([])
  const [error, setError] = useState(null)

  const active = (clients || []).filter(c => c.status === 'active')
  if (loading || active.length === 0) return null

  const send = async (client) => {
    setSendingId(client.clientId)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('create_routine_tree', {
        p: { ...routineToInput(routine), user_id: client.clientId },
      })
      if (err) throw err
      setSentIds(prev => [...prev, client.clientId])
    } catch (e) {
      setError(e.message || 'No se pudo enviar la rutina')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--c-border-subtle)' }}>
      <p style={{ ...eyebrow, marginBottom: '6px' }}>{t('Enviar a un cliente')}</p>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
        {t('La copia aparece directamente en su app, lista para empezar.')}
      </p>

      {error && <div style={{ ...ERROR_STYLE, marginBottom: '12px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {active.map(c => {
          const name = c.profile?.name || 'Cliente'
          const sent = sentIds.includes(c.clientId)
          return (
            <div key={c.clientId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              padding: '8px 12px', background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
            }}>
              <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <button
                onClick={() => send(c)}
                disabled={sendingId === c.clientId}
                aria-label={sent ? `Enviar otra copia a ${name}` : `Enviar a ${name}`}
                style={{
                  flexShrink: 0, minHeight: '44px', padding: '0 12px', borderRadius: '8px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: sent ? 'var(--c-text-dim)' : 'var(--c-accent)',
                  border: `1px solid ${sent ? 'var(--c-border-subtle)' : 'var(--c-accent-border)'}`,
                  background: 'transparent',
                  opacity: sendingId === c.clientId ? 0.6 : 1,
                }}
              >
                {sendingId === c.clientId ? 'Enviando...' : sent ? '✓ Enviada' : 'Enviar'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Hoja de compartir: genera el enlace de un ciclo o rutina y lo entrega.
//
// El estado tiene dos caras y solo dos: la rutina no está compartida (hay un
// botón para generar el enlace) o lo está (está el enlace, quién lo ha guardado
// y cómo desactivarlo). No hay caducidades ni lista de invitados: el enlace es
// el permiso, y desactivarlo es la única forma de retirarlo.
export default function ShareRoutineSheet({ routine, onClose }) {
  const { t } = useLang()
  const { share, url, loading, working, error, createLink, revokeLink } = useRoutineShare(routine?.id)
  // El perfil viene de la caché compartida; useTrainer (que sí consulta) solo se
  // monta si esta persona entrena a alguien.
  const { profile } = useProfile()
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [localError, setLocalError] = useState(null)

  const isCycle = routine?.type === 'cycle'
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* sin portapapeles: el enlace sigue a la vista para copiarlo a mano */ }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: routine?.name,
        text: shareMessage({ name: routine?.name }, url),
        url,
      })
    } catch { /* cancelar el diálogo del sistema no es un error */ }
  }

  const handleCreate = async () => {
    setLocalError(null)
    try { await createLink() } catch (e) { setLocalError(e.message) }
  }

  const handleRevoke = async () => {
    setLocalError(null)
    try {
      await revokeLink()
      setConfirmRevoke(false)
    } catch (e) { setLocalError(e.message) }
  }

  const imports = share?.import_count ?? 0

  return (
    <Sheet
      title={isCycle ? 'Compartir ciclo' : 'Compartir rutina'}
      subtitle={routine?.name}
      onClose={onClose}
      maxHeight="88dvh"
    >
      {(error || localError) && (
        <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError || error}</div>
      )}

      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.55, marginBottom: '18px' }}>
        Quien abra el enlace verá los días y los ejercicios, y podrá guardar una copia
        en su cuenta. No verá tus entrenos, tus cargas ni tu perfil.
      </p>

      {loading ? (
        <div className="skeleton" aria-hidden="true" style={{ height: '52px', borderRadius: '12px' }} />
      ) : !share ? (
        <Button variant="primary" full size="lg" loading={working} disabled={working} onClick={handleCreate}>
          {working ? 'Generando...' : 'Crear enlace'}
        </Button>
      ) : (
        <>
          {/* El enlace, legible y completo: quien lo manda debe poder verlo entero. */}
          <div style={{
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '12px',
          }}>
            <p style={{ ...eyebrow, marginBottom: '6px' }}>{t('Enlace')}</p>
            <p style={{
              fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)', fontSize: '11px',
              lineHeight: 1.45, wordBreak: 'break-all',
            }}>
              {url}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {canNativeShare && (
              <Button variant="primary" full size="lg" onClick={nativeShare}>
                {t('Compartir')}
              </Button>
            )}
            <Button variant="secondary" full size={canNativeShare ? 'md' : 'lg'} onClick={copy}>
              {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
            </Button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            padding: '12px 0', borderTop: '1px solid var(--c-border-subtle)',
          }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
              {imports === 0
                ? 'Nadie la ha guardado todavía.'
                : `${imports} ${imports === 1 ? 'persona la ha guardado' : 'personas la han guardado'}.`}
            </p>
          </div>

          {/* Desactivar es la única forma de retirar el enlace, así que se pide
              confirmación: quien ya lo tenga dejará de ver el plan. */}
          {confirmRevoke ? (
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-action-border)',
              borderRadius: '12px', padding: '14px',
            }}>
              <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 600, lineHeight: 1.5, marginBottom: '12px' }}>
                El enlace dejará de funcionar para todo el mundo. Las copias que ya se
                guardaron siguen siendo suyas.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="danger" full loading={working} disabled={working} onClick={handleRevoke}>
                  {t('Desactivar')}
                </Button>
                <Button variant="secondary" full disabled={working} onClick={() => setConfirmRevoke(false)}>
                  {t('Cancelar')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRevoke(true)}
              style={{
                width: '100%', minHeight: '44px',
                color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              {t('Desactivar enlace')}
            </button>
          )}
        </>
      )}

      {/* El enlace sirve para cualquiera; a un cliente vinculado se le puede
          mandar la copia directamente, sin que tenga que abrir nada. */}
      {profile?.is_trainer && <AssignToClients routine={routine} />}
    </Sheet>
  )
}
