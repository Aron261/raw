import Eyebrow from './Eyebrow'

// Labelled form field wrapper. Pair with the `.input-field` class (or any control)
// as children. `hint` renders muted helper text below.
export default function Field({ label, hint, children, style }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      {label && <Eyebrow style={{ marginBottom: '6px' }}>{label}</Eyebrow>}
      {children}
      {hint && <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px', lineHeight: 1.4 }}>{hint}</p>}
    </div>
  )
}
