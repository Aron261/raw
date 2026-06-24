// A hero metric over a quiet caption. The number is the content (Number-As-Hero).
export default function Stat({ label, value, color = 'var(--c-text)', size = 28, style }) {
  return (
    <div style={style}>
      <p style={{
        fontFamily: 'var(--font-sans)', color,
        fontSize: `${size}px`, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums', marginBottom: '4px',
      }}>
        {value}
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, lineHeight: 1.3 }}>
        {label}
      </p>
    </div>
  )
}
