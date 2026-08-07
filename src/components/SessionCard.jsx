import { KINDS } from '../lib/calendar'
import { formatSessionLog } from '../lib/schedule'
import { useLang } from '../hooks/useLang'

// ── SessionCard ──────────────────────────────────────────────────────────
// Una sesión que no es de fuerza, en el historial. Deliberadamente más ligera
// que WorkoutCard: no tiene series que desplegar, ni volumen, ni PR — tiene
// tres cifras y una fecha. Darle el mismo peso visual que a un entreno de
// fuerza mentiría sobre lo que hay dentro.
export default function SessionCard({ session, onClick }) {
  const { t, locale } = useLang()
  const meta = KINDS[session.kind] || KINDS.note
  const log = formatSessionLog(session, { locale, t })

  const date = new Date(`${session.date}T00:00:00`)
    .toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })

  return (
    <button
      onClick={() => onClick?.(session)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: '11px',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
        borderLeft: `2px solid ${meta.color}`,
        borderRadius: 'var(--r-sm)', padding: '13px 14px',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {session.title || t(meta.label)}
        </p>
        <p style={{
          fontFamily: 'var(--font-sans)', color: 'var(--c-text-muted)',
          fontSize: '10.5px', letterSpacing: '-0.01em', marginTop: '2px',
        }}>
          {t(meta.label)}{log ? ` · ${log}` : ''}
        </p>
      </div>
      <span style={{
        flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '10.5px',
        fontWeight: 700, color: 'var(--c-text-muted)', fontVariantNumeric: 'tabular-nums',
      }}>
        {date}
      </span>
    </button>
  )
}
