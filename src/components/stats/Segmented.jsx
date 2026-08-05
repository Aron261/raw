// Shared segmented control (range toggle, sort toggle, etc.).
export default function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ display: 'flex', gap: '2px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-xs)', padding: '2px' }}>
      {options.map(o => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            style={{
              // 40px de alto de toque. El control mide 10px de texto a
              // propósito —es un filtro, no un CTA— pero era la navegación
              // principal de Progreso con ~19px de alto: se fallaba el tap.
              // El aire va dentro del botón, no alrededor, así que el chip se
              // ve igual de discreto y el blanco de la pestaña activa crece
              // hasta donde de verdad se puede pulsar.
              padding: '12px 14px', minHeight: '40px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-xs)',
              fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em',
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
