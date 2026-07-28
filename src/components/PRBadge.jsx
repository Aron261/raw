export default function PRBadge({ small = false }) {
  return (
    <span
      className="pr-badge-enter"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--c-record)',
        color: 'var(--c-record-ink)',
        fontSize: small ? '8px' : '9px',
        fontWeight: 900,
        letterSpacing: '-0.01em',
        padding: small ? '1px 4px' : '2px 5px',
        borderRadius: '4px',
        lineHeight: 1.2,
        flexShrink: 0,
      }}
    >
      PR
    </span>
  )
}
