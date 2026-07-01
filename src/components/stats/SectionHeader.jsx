// Stronger section header for stats modules — replaces the repeated 10px mono
// uppercase kicker. Archivo 800 sentence-case gives each section real weight and
// varies the page's cadence. Optional subtitle + right-aligned control slot.
export default function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.4, marginTop: '3px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
