import { useLang } from '../../hooks/useLang'

// Un módulo de estadísticas, plegable.
//
// La página llegó a seis módulos abiertos a la vez —tres con gráfico, todos del
// mismo peso visual— y había que recorrerla entera para saber si algo iba mal.
// Seis cosas igual de importantes son seis cosas sin jerarquía.
//
// Plegado, cada módulo deja su cifra clave en una línea: la página se ojea de
// una pantalla y se abre lo que interese. Arrancan abiertos los dos que
// contestan «¿cómo voy ahora?»; el histórico se abre si lo pides.
//
// El contenido se DESMONTA al plegar, no se esconde con CSS: dentro hay
// gráficos de recharts que miden su contenedor, y un contenedor de ancho cero
// los deja rotos al volver a abrirlos.
export default function StatSection({ label, summary, open, onToggle, children }) {
  const { t } = useLang()

  return (
    <section style={{ borderBottom: '1px solid var(--c-border-subtle)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          // 44px de alto de toque: es la fila que se pulsa todo el rato.
          padding: '16px 2px', minHeight: '44px',
          background: 'transparent', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontFamily: 'var(--font-sans)', color: 'var(--c-text)',
            fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {t(label)}
          </span>
          {/* La cifra solo acompaña cuando está plegado: abierto, el propio
              módulo la enseña en grande y repetirla sería ruido. */}
          {!open && summary && (
            <span style={{
              display: 'block', color: 'var(--c-text-muted)', fontSize: '11.5px',
              fontWeight: 500, marginTop: '3px', fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {summary}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0, color: 'var(--c-text-dim)', fontSize: '13px', lineHeight: 1,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 180ms var(--ease-out)',
          }}
        >
          ▾
        </span>
      </button>

      {open && <div style={{ paddingBottom: '4px' }}>{children}</div>}
    </section>
  )
}
