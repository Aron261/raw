// Small uppercase section label in the mono "instrument" voice (Mono-Eyebrow rule).
export default function Eyebrow({ as: Tag = 'p', color = 'var(--c-text-dim)', style, children, ...rest }) {
  return (
    <Tag
      style={{
        fontFamily: 'var(--font-mono)', color,
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
