// Espejo mínimo de src/lib/nutrients.js para la Edge Function.
//
// Una función de Deno no puede importar de src/, así que hay dos copias de la
// lista de claves. Es una duplicación real y se paga con un test de paridad en
// guardrails.test.js, que lee los dos archivos como texto y compara claves y
// unidades. Sin ese test, las dos listas se separan en silencio y el servidor
// empieza a descartar un nutriente que la app sí pinta.
//
// Aquí solo va lo que el servidor necesita para filtrar entradas: clave,
// unidad y máximo plausible. Las etiquetas, los decimales y la dirección
// (piso/techo) son cosa de la interfaz.

export const MICROS: Record<string, { unit: 'g' | 'mg' | 'mcg'; max: number }> = {
  azucar:         { unit: 'g',   max: 500 },
  grasa_saturada: { unit: 'g',   max: 300 },
  sodio:          { unit: 'mg',  max: 30000 },
  colesterol:     { unit: 'mg',  max: 5000 },
  fibra:          { unit: 'g',   max: 200 },
  potasio:        { unit: 'mg',  max: 30000 },
  calcio:         { unit: 'mg',  max: 10000 },
  hierro:         { unit: 'mg',  max: 500 },
  magnesio:       { unit: 'mg',  max: 5000 },
  zinc:           { unit: 'mg',  max: 500 },
  omega3:         { unit: 'g',   max: 100 },
  vitamina_c:     { unit: 'mg',  max: 10000 },
  vitamina_b12:   { unit: 'mcg', max: 5000 },
  vitamina_a:     { unit: 'mcg', max: 10000 },
  vitamina_d:     { unit: 'mcg', max: 1000 },
  folato:         { unit: 'mcg', max: 5000 },
}

export const MICRO_KEYS = Object.keys(MICROS)

/** Lista de claves con su unidad, para meterla en la descripción de una herramienta. */
export const MICRO_HINT = MICRO_KEYS.map(k => `${k}(${MICROS[k].unit})`).join(', ')

/**
 * Solo claves conocidas, solo números finitos y positivos, recortados al
 * máximo plausible. Los ceros se descartan: una clave ausente significa
 * «desconocido», y guardar dieciséis ceros arruinaría la cuenta de cuántas
 * comidas traen datos de verdad.
 */
export function sanitizeMicros(input: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  const src = input as Record<string, unknown>
  for (const key of MICRO_KEYS) {
    const v = Number(src[key])
    if (!Number.isFinite(v) || v <= 0) continue
    out[key] = Math.min(v, MICROS[key].max)
  }
  return out
}

/** Suma micros de varias filas. Una clave ausente en todas no aparece. */
export function sumMicros(list: unknown[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of list) {
    if (!m || typeof m !== 'object') continue
    const src = m as Record<string, unknown>
    for (const key of MICRO_KEYS) {
      const v = Number(src[key])
      if (!Number.isFinite(v) || v === 0) continue
      out[key] = Math.round(((out[key] || 0) + v) * 100) / 100
    }
  }
  return out
}

/** Cuántas filas traen algún micro. */
export const countCovered = (list: unknown[]): number =>
  list.filter(m => m && typeof m === 'object' &&
    MICRO_KEYS.some(k => Number((m as Record<string, unknown>)[k]) > 0)).length
