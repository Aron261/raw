// All-time volume distribution across muscle groups, shown as proportional
// horizontal bars (relative to the most-trained group).
function formatVolume(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

export default function MuscleBalanceModule({ data }) {
  const groups = data?.muscleBalance || []
  if (groups.length === 0) return null
  const max = groups[0].volume || 1

  return (
    <section style={{ marginBottom: '32px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        Balance muscular
      </p>
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        {groups.map(g => (
          <div key={g.group}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.group}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>
                {formatVolume(g.volume)} kg
              </span>
            </div>
            <div style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: '100%',
                transformOrigin: 'left center',
                transform: `scaleX(${Math.max(0.02, g.volume / max)})`,
                background: 'var(--c-action)',
                borderRadius: '999px',
                transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
