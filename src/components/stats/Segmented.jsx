// Shared segmented control (range toggle, sort toggle, etc.).
export default function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ display: 'flex', gap: '2px', background: 'var(--c-surface-2)', borderRadius: '8px', padding: '2px' }}>
      {options.map(o => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            style={{
              padding: '4px 9px', borderRadius: '6px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
              background: active ? 'var(--c-surface)' : 'transparent',
              color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'color 150ms',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
