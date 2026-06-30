import { useNavigate } from 'react-router-dom'

// Every exercise ranked by best estimated 1RM. Each row taps into the
// existing /exercise/:name detail page (which decodes the param).
export default function AllLiftsModule({ data }) {
  const navigate = useNavigate()
  const lifts = data?.allLifts || []
  if (lifts.length === 0) return null

  return (
    <section style={{ marginBottom: '32px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        Mis levantamientos
      </p>
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        {lifts.map((lift, i) => (
          <button
            key={lift.name}
            onClick={() => navigate(`/exercise/${encodeURIComponent(lift.name)}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
              padding: '13px 16px', textAlign: 'left',
              background: 'transparent',
              borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
            }}
          >
            {/* Rank */}
            <span style={{ width: '20px', flexShrink: 0, color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
              {i + 1}
            </span>

            {/* Name */}
            <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lift.name}
            </span>

            {/* Best 1RM */}
            <span style={{ flexShrink: 0, textAlign: 'right' }}>
              <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '14px' }}>
                {lift.best1RM}
                <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{lift.unit}</span>
              </span>
              <span style={{ display: 'block', color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1px' }}>
                1RM est.
              </span>
            </span>

            {/* Chevron */}
            <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '15px', lineHeight: 1 }}>›</span>
          </button>
        ))}
      </div>
    </section>
  )
}
