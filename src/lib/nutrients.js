/*
 * El vocabulario de micronutrientes, en un sitio.
 *
 * Esta lista es un contrato con tres partes que no se hablan entre sí: las
 * columnas `micros jsonb` de Postgres, la pantalla de nutrición y el servidor
 * MCP (que tiene su propio espejo mínimo en supabase/functions/mcp/nutrients.ts
 * porque una Edge Function de Deno no puede importar de src/). Un test de
 * paridad compara los dos.
 *
 * Tres reglas que sostienen todo lo demás:
 *
 *   1. CLAVES ASCII SIN ACENTOS. `azucar`, no `azúcar`. Una clave JSONB con
 *      marcas combinantes es una trampa: la misma palabra puede llegar en NFC
 *      o en NFD y `micros->>'azúcar'` falla silenciosamente contra la otra. El
 *      texto acentuado vive en `label`, que además es la clave de i18n.
 *
 *   2. UNA UNIDAD CANÓNICA POR CLAVE, PARA SIEMPRE. Sumar nunca mira unidades.
 *      Un alimento que reporta 1,2 g de sodio se convierte a mg en el borde de
 *      entrada (herramienta MCP o EntrySheet); jamás se guarda en gramos.
 *
 *   3. UNA CLAVE AUSENTE SIGNIFICA DESCONOCIDO, NO CERO. Para la aritmética se
 *      trata como cero —una barra de progreso no tiene un tercer estado—, y por
 *      eso la pantalla está obligada a mostrar cuántas comidas del día traen
 *      datos. Sin ese dato, «el sodio de hoy» es en realidad «el sodio que
 *      conocemos» y la app miente en voz baja.
 *
 * `dir` es el campo que más peso carga. Decide si el objetivo es un piso o un
 * techo, si la barra pinta el exceso como logro o como alerta, y la copia que
 * lo acompaña. Sin él la interfaz felicita a alguien por 4.800 mg de sodio.
 */

// `priority` son los nueve que se ven sin abrir nada, en la propia pantalla del
// día. No es una jerarquía nutricional: es la lista que Pedro pidió seguir de
// cerca. Los otros siete siguen guardándose y contando igual, solo que viven a
// un toque de distancia, en la hoja completa.
export const NUTRIENTS = [
  // Techos: los cuatro que vienen de etiqueta, y por eso los más fiables.
  { key: 'azucar',         label: 'Azúcar',         unit: 'g',   decimals: 1, dir: 'ceiling', max: 500 },
  { key: 'grasa_saturada', label: 'Grasa saturada', unit: 'g',   decimals: 1, dir: 'ceiling', max: 300 },
  { key: 'sodio',          label: 'Sodio',          unit: 'mg',  decimals: 0, dir: 'ceiling', max: 30000 },
  { key: 'colesterol',     label: 'Colesterol',     unit: 'mg',  decimals: 0, dir: 'ceiling', max: 5000 },

  // Pisos.
  { key: 'fibra',          label: 'Fibra',          unit: 'g',   decimals: 1, dir: 'floor',   max: 200,   priority: true },
  { key: 'potasio',        label: 'Potasio',        unit: 'mg',  decimals: 0, dir: 'floor',   max: 30000, priority: true },
  { key: 'calcio',         label: 'Calcio',         unit: 'mg',  decimals: 0, dir: 'floor',   max: 10000, priority: true },
  { key: 'hierro',         label: 'Hierro',         unit: 'mg',  decimals: 1, dir: 'floor',   max: 500,   priority: true },
  { key: 'magnesio',       label: 'Magnesio',       unit: 'mg',  decimals: 0, dir: 'floor',   max: 5000 },
  { key: 'zinc',           label: 'Zinc',           unit: 'mg',  decimals: 1, dir: 'floor',   max: 500 },
  { key: 'omega3',         label: 'Omega-3',        unit: 'g',   decimals: 2, dir: 'floor',   max: 100,   priority: true },
  { key: 'vitamina_c',     label: 'Vitamina C',     unit: 'mg',  decimals: 0, dir: 'floor',   max: 10000, priority: true },
  { key: 'vitamina_b12',   label: 'Vitamina B12',   unit: 'mcg', decimals: 1, dir: 'floor',   max: 5000,  priority: true },
  { key: 'vitamina_a',     label: 'Vitamina A',     unit: 'mcg', decimals: 0, dir: 'floor',   max: 10000, priority: true },
  { key: 'vitamina_d',     label: 'Vitamina D',     unit: 'mcg', decimals: 1, dir: 'floor',   max: 1000 },
  { key: 'folato',         label: 'Folato',         unit: 'mcg', decimals: 0, dir: 'floor',   max: 5000,  priority: true },
]

export const MICRO_KEYS = NUTRIENTS.map(n => n.key)
export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map(n => [n.key, n]))

/** Los que no hay que pasarse. Van primero en pantalla: son los más fiables. */
export const CEILINGS = NUTRIENTS.filter(n => n.dir === 'ceiling')
/** Los que hay que alcanzar. */
export const FLOORS = NUTRIENTS.filter(n => n.dir === 'floor')
/** Los que se ven sin abrir nada, en la pantalla del día. */
export const PRIORITY = NUTRIENTS.filter(n => n.priority)

// ── Aritmética ───────────────────────────────────────────────────────────

const roundTo = (v, d) => {
  const f = 10 ** d
  return Math.round(v * f) / f
}

/** Redondeo de macros: un decimal. Nadie come 0,04 g de proteína. */
export const round1 = (v) => Math.round(v * 10) / 10

/**
 * Suma una lista de objetos de micros. Una clave que no aparece en ninguno
 * tampoco aparece en el resultado: lo desconocido no se convierte en cero.
 */
export function sumMicros(list) {
  const out = {}
  for (const m of list || []) {
    if (!m) continue
    for (const key of MICRO_KEYS) {
      const v = Number(m[key])
      if (!Number.isFinite(v) || v === 0) continue
      out[key] = (out[key] || 0) + v
    }
  }
  for (const key of Object.keys(out)) {
    out[key] = roundTo(out[key], NUTRIENT_BY_KEY[key].decimals)
  }
  return out
}

/** Suma binaria, para acumular sin construir un array. */
export const addMicros = (a, b) => sumMicros([a, b])

/**
 * Escala por un multiplicador (media porción, dos porciones). Itera las claves
 * canónicas y no las del objeto: así una escritura defectuosa del MCP no
 * propaga basura. Las claves ausentes se saltan — lo desconocido sigue
 * desconocido por mucho que se multiplique.
 */
export function scaleMicros(micros, m) {
  const out = {}
  if (!micros) return out
  for (const key of MICRO_KEYS) {
    const v = Number(micros[key])
    if (!Number.isFinite(v) || v === 0) continue
    const scaled = roundTo(v * m, NUTRIENT_BY_KEY[key].decimals)
    if (scaled > 0) out[key] = scaled
  }
  return out
}

/**
 * Filtro de entrada: solo claves conocidas, solo números finitos y positivos,
 * recortados al máximo plausible de cada nutriente.
 *
 * Descarta los ceros a propósito. Para la aritmética `{fibra: 0}` y la clave
 * ausente son lo mismo, pero para contar cuántas comidas traen datos son cosas
 * muy distintas — y un modelo bienintencionado rellenando las dieciséis claves
 * con ceros arruinaría esa cuenta.
 */
export function sanitizeMicros(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const key of MICRO_KEYS) {
    const n = NUTRIENT_BY_KEY[key]
    const v = Number(input[key])
    if (!Number.isFinite(v) || v <= 0) continue
    const clamped = roundTo(Math.min(v, n.max), n.decimals)
    if (clamped > 0) out[key] = clamped
  }
  return out
}

/** Las claves con valor, en el orden del registro (no en el de inserción). */
export function nonZeroKeys(micros) {
  if (!micros) return []
  return MICRO_KEYS.filter(k => Number(micros[k]) > 0)
}

/** «1.240 mg», con los decimales que le tocan a ese nutriente. */
export function formatNutrient(key, value, locale = 'es-CO') {
  const n = NUTRIENT_BY_KEY[key]
  if (!n) return String(value)
  const v = Number(value) || 0
  return `${v.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: n.decimals,
  })} ${n.unit}`
}

/**
 * Escala una comida entera. Los macros conservan el redondeo de siempre (kcal
 * entero, macros a un decimal) y cada micro usa el suyo.
 *
 * Existe para que EntrySheet no tenga que mantener veinte estados de texto:
 * los cuatro macros siguen siendo campos editables y los micros viajan juntos
 * en un objeto.
 */
export function scaleFood(base, m) {
  return {
    kcal:      Math.round(Number(base?.kcal || 0) * m),
    protein_g: round1(Number(base?.protein_g || 0) * m),
    carbs_g:   round1(Number(base?.carbs_g || 0) * m),
    fat_g:     round1(Number(base?.fat_g || 0) * m),
    micros:    scaleMicros(base?.micros, m),
  }
}
