export default function PRBadge({ small = false }) {
  return (
    <span
      className="pr-badge-enter"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--c-accent)',
        color: 'var(--c-text)',
        fontSize: small ? '8px' : '9px',
        fontWeight: 900,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: small ? '1px 4px' : '2px 5px',
        borderRadius: '2px',
        lineHeight: 1.2,
        flexShrink: 0,
      }}
    >
      PR
    </span>
  )
}
