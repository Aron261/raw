// Cabecera de un módulo de estadísticas: subtítulo y control a la derecha.
//
// El TÍTULO ya no vive aquí: lo pone StatSection, que es la fila que se pulsa
// para plegar. Cuando estaba en los dos sitios el nombre salía dos veces
// seguidas. Se deja opcional por si algún módulo lo necesita suelto.
export default function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
      <div style={{ minWidth: 0 }}>
        {title && (
          <h2 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {title}
          </h2>
        )}
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
