import { useId } from 'react'

/*
 * El lenguaje de las gráficas.
 *
 * Antes cada pantalla resolvía su gráfica a mano: rejillas punteadas en las
 * dos direcciones, ejes con línea, un punto en cada dato y tooltips que eran
 * una caja gris. Se leía como una hoja de cálculo, no como parte de la app —
 * era el sitio donde más se notaba que el diseño no había llegado.
 *
 * Las reglas, que valen para las seis:
 *
 * · Rejilla solo horizontal, y discreta. Las verticales no ayudan a comparar
 *   alturas y llenan el fondo de ruido.
 * · Sin líneas de eje. El dato marca dónde está el suelo.
 * · Un punto por serie, no doce: el último. Es el que dice dónde estás; los
 *   demás ya los dibuja la línea.
 * · Relleno bajo la línea, degradado a nada. Da cuerpo a la tendencia sin
 *   inventarse un segundo color.
 * · El tooltip es una superficie del sistema (.material), no una caja aparte.
 */

// ── Ejes y rejilla ──────────────────────────────────────────────────────
/*
 * Fábricas de props, no componentes.
 *
 * Recharts identifica a sus hijos POR TIPO: recorre children buscando XAxis,
 * YAxis, CartesianGrid… Un envoltorio propio —por fino que sea— es un tipo
 * que no reconoce, así que lo ignora: el eje no se dibuja Y, peor, tampoco
 * entra en el cálculo de la escala. El síntoma es una gráfica sin ejes ni
 * rejilla y con la serie aplastada contra un borde.
 *
 * Por eso esto devuelve props para esparcir sobre los componentes de
 * recharts de verdad, en vez de envolverlos.
 */
export function axisProps(colors, { size = 10 } = {}) {
  return {
    tick: { fill: colors.axis, fontSize: size, fontWeight: 600, fontFamily: 'Archivo, system-ui, sans-serif' },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  }
}

// Rejilla solo horizontal: las verticales no ayudan a comparar alturas.
// Sin strokeDasharray — un "0" no pinta nada y el punteado es textura sin
// información.
export function gridProps(colors) {
  return { stroke: colors.grid, vertical: false }
}

// ── Relleno bajo la línea ───────────────────────────────────────────────
/*
 * Recharts necesita que el degradado viva en un <defs> con id, y el id tiene
 * que ser único por gráfica o dos en la misma página comparten relleno. useId
 * lo resuelve; el hook se llama en el componente padre y el id viaja a las
 * dos piezas (defs y Area) para que sea el mismo.
 */
export function useAreaFillId() {
  return `area-${useId().replace(/:/g, '')}`
}

export function AreaFillDefs({ id, colors }) {
  /*
   * Va FUERA del gráfico, no como hijo suyo: recharts filtra sus children por
   * tipo y este componente no es uno de los que reconoce, así que dentro
   * sencillamente no se renderiza y el fill quedaba apuntando a un id que no
   * existía (relleno invisible, sin ningún error).
   *
   * Los ids de degradado son globales al documento, así que un <svg> de tamaño
   * cero al lado sirve igual y no depende de lo que recharts decida pintar.
   */
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={colors.line} stopOpacity={0.22} />
          <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── El punto del final ──────────────────────────────────────────────────
/*
 * Un dot por dato convierte la línea en un collar. Este renderer pinta solo
 * el último —relleno, con un aro del color del fondo para que se despegue de
 * la línea— y devuelve null para el resto. Recharts espera un elemento o
 * null, nunca undefined.
 */
export function lastPointDot(colors, surface = 'var(--c-surface)') {
  return function Dot(props) {
    const { cx, cy, index, points } = props
    if (index !== (points?.length ?? 0) - 1) return null
    if (cx == null || cy == null) return null
    return (
      <g key={`last-${index}`}>
        <circle cx={cx} cy={cy} r={6} fill={surface} />
        <circle cx={cx} cy={cy} r={4} fill={colors.line} />
      </g>
    )
  }
}

// ── Tooltip ─────────────────────────────────────────────────────────────
/*
 * Una superficie del sistema. `format` recibe el valor crudo y devuelve lo
 * que se pinta, para que cada gráfica ponga su unidad sin duplicar la caja.
 */
export function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div
      className="material material-raised"
      style={{ padding: '9px 12px', borderRadius: 'var(--r-sm)', pointerEvents: 'none' }}
    >
      {label != null && (
        <p style={{
          color: 'var(--c-text-muted)', fontSize: '10.5px', fontWeight: 700,
          letterSpacing: '-0.01em', marginBottom: '3px',
        }}>
          {label}
        </p>
      )}
      <p style={{
        color: 'var(--c-text)', fontSize: '15px', fontWeight: 900,
        letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {format ? format(value) : value}
      </p>
    </div>
  )
}
