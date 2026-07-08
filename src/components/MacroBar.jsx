const fmt = (n) => Math.round(n).toLocaleString('es-CO')

// Barra de progreso de un macro (proteína / carbos / grasa) contra su objetivo.
export default function MacroBar({ label, current, target, unit = 'g' }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const over = target > 0 && current > target
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', marginBottom: '5px' }}>
        {label}
      </p>
      <p className="tnum" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: over ? 'var(--c-action-text)' : 'var(--c-text)', marginBottom: '6px' }}>
        {fmt(current)}<span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}> / {fmt(target)} {unit}</span>
      </p>
      <div
        style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      >
        <div style={{
          height: '100%', width: '100%',
          transformOrigin: 'left center',
          transform: `scaleX(${pct / 100})`,
          background: over ? 'var(--c-action)' : 'var(--c-data)',
          borderRadius: '999px',
          transition: 'transform 500ms var(--ease-out)',
        }} />
      </div>
    </div>
  )
}
