const fmt = (n, locale = 'es-CO', decimals = 0) =>
  Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals })

// Barra de progreso de un nutriente contra su objetivo.
//
// `overIsGood` invierte la lectura del exceso. Por defecto pasarse es una
// alerta, que es lo correcto para las calorías y para un techo como el sodio.
// Pero para un piso —fibra, hierro, potasio— pasarse ES el objetivo cumplido,
// y pintarlo de rojo enseñaría exactamente lo contrario de lo que se quiere.
//
// `decimals` existe porque hay objetivos que viven por debajo del entero: el
// omega-3 son 1,6 g y redondeado saldría «2 / 2 g», o sea una barra que nunca
// dice nada.
//
// `locale` por defecto es es-CO, que es como se comportó siempre. Los micros sí
// lo pasan: con decimales y miles a la vez, «3.400 mg» en una interfaz en
// inglés canta.
export default function MacroBar({ label, current, target, unit = 'g', overIsGood = false, decimals = 0, locale = 'es-CO' }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const over = target > 0 && current > target
  const alert = over && !overIsGood
  const done = over && overIsGood
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '5px' }}>
        {label}
      </p>
      <p className="tnum" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: alert ? 'var(--c-action-text)' : 'var(--c-text)', marginBottom: '6px' }}>
        {fmt(current, locale, decimals)}<span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}> / {fmt(target, locale, decimals)} {unit}</span>
      </p>
      <div
        style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      >
        <div style={{
          height: '100%', width: '100%',
          transformOrigin: 'left center',
          transform: `scaleX(${pct / 100})`,
          background: alert ? 'var(--c-action)' : done ? 'var(--c-success)' : 'var(--c-data)',
          borderRadius: '999px',
          transition: 'transform 500ms var(--ease-out)',
        }} />
      </div>
    </div>
  )
}
