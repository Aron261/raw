// Etched content surface. `accent` flips it to the drenched Action-Pink block
// (with ink text) used for the day's single most important action.
export default function Card({ as: Tag = 'div', accent = false, style, children, ...rest }) {
  return (
    <Tag
      style={{
        background: accent ? 'var(--c-action)' : 'var(--c-surface)',
        color: accent ? 'var(--c-on-action)' : 'var(--c-text)',
        border: accent ? '1px solid transparent' : '1px solid var(--c-border-subtle)',
        borderRadius: '16px',
        padding: '16px',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
