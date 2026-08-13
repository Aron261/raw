import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { useLang } from '../hooks/useLang'

// Helpers puros: reciben t y locale. Meterles el hook —o un t() suelto— los
// rompe, porque se llaman por mensaje dentro del map.
function formatTime(iso, locale = 'es-CO') {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(iso, t = (x) => x, locale = 'es-CO') {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, today)) return t('Hoy')
  if (same(d, yest)) return t('Ayer')
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Chat() {
  const { t, locale } = useLang()
  const { otherId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { messages, otherName, loading, sending, error, sendMessage } = useChat(otherId)

  const [text, setText] = useState('')
  const [sendError, setSendError] = useState(null)
  const bottomRef = useRef(null)

  // Auto-scroll al final cuando llegan/envían mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!text.trim() || sending) return
    const body = text
    setText('')
    setSendError(null)
    try {
      await sendMessage(body)
    } catch (err) {
      setText(body) // restaurar si falla
      setSendError(err.message)
    }
  }

  return (
    <div className="min-h-dvh bg-background" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
        borderBottom: '1px solid var(--c-border-subtle)',
        background: 'var(--c-bg-glass)', backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} aria-label="Volver" style={{ color: 'var(--c-text)', fontSize: '20px', lineHeight: 1, padding: '2px 6px' }}>←</button>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'var(--c-action-text)', fontSize: '14px', fontWeight: 900 }}>
            {(otherName || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {loading ? '...' : otherName}
        </p>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {error && <div style={ERROR_STYLE}>{error}</div>}

        {!loading && !error && messages.length === 0 && (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '20px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>{t('Esta conversación está vacía.')}</p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px' }}>{t('Escribe el primer mensaje abajo.')}</p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id
          const prev = messages[i - 1]
          const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          return (
            <div key={m.id}>
              {showDay && (
                <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', background: 'var(--c-surface-2)', padding: '3px 10px', borderRadius: 'var(--r-xl)' }}>
                    {dayLabel(m.created_at, t, locale)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  background: mine ? 'var(--c-accent)' : 'var(--c-surface)',
                  color: mine ? 'var(--c-on-action)' : 'var(--c-text)',
                  border: mine ? 'none' : '1px solid var(--c-border-subtle)',
                  borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '9px 13px',
                }}>
                  <p style={{ fontSize: '14px', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
                  <p style={{ fontSize: '9px', marginTop: '3px', textAlign: 'right', color: mine ? 'rgba(255,255,255,0.7)' : 'var(--c-text-ghost)' }}>
                    {formatTime(m.created_at, locale)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: '8px', alignItems: 'flex-end',
        padding: '10px 12px max(10px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--c-border-subtle)', background: 'var(--c-surface)',
        flexShrink: 0,
      }}>
        <textarea
          aria-label={t('Escribe un mensaje')}
          value={text}
          maxLength={4000}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="input-field"
          style={{ flex: 1, resize: 'none', maxHeight: '120px', fontSize: '14px', padding: '10px 12px' }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          style={{
            flexShrink: 0, background: 'var(--c-accent)', color: 'var(--c-on-action)',
            border: 'none', borderRadius: 'var(--r-md)', padding: '10px 16px',
            fontSize: '13px', fontWeight: 800, opacity: sending || !text.trim() ? 0.5 : 1,
          }}
          {...pressProps(0.96)}
        >
          {sending ? '...' : t('Enviar')}
        </button>
      </form>

      {sendError && <div style={{ ...ERROR_STYLE, margin: '0 12px 8px' }}>{sendError}</div>}
    </div>
  )
}
