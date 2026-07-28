// Small uppercase section label in the mono "instrument" voice (Mono-Eyebrow rule).
export default function Eyebrow({ as: Tag = 'p', color = 'var(--c-text-dim)', style, children, ...rest }) {
  return (
    <Tag
      style={{
        fontFamily: 'var(--font-sans)', color,
        fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
