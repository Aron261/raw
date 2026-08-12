// Comparar una serie con la misma serie de la sesión anterior.
//
// PRODUCT.md pide "comparación honesta: la superaste / la igualaste / te
// quedaste corto", pero la app nunca llegó a compararlas: guardaba la serie
// anterior para pintarla de fantasma en el input y para decidir cuántas filas
// dibujar, y ahí se quedaba. Registrabas 80×5 sin que nadie dijera que la
// semana pasada habían sido 77,5. Esto es esa comparación.
//
// Módulo puro y sin dependencias: es la única parte que decide si progresaste,
// así que tiene que poder probarse sola.

// Epley. La definición canónica de la app: hooks/useWorkout la reexporta y
// todo el mundo la importa de allí, así que no hay dos fórmulas compitiendo.
export function calc1RM(weight, reps) {
  const w = Number(weight)
  const r = Number(reps)
  if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}

const round1 = (n) => Math.round(n * 10) / 10

// ── Unidades ──────────────────────────────────────────────────────────────
// Cada workout_exercise carga su unidad (kg o lb) y el toggle existe por
// ejercicio, así que CUALQUIER comparación entre sesiones puede cruzar
// unidades. El volumen ya convertía; el camino del récord no: 100 lb (~45 kg)
// le "ganaba" a 90 kg y la app celebraba un récord falso. Todo lo que compare
// pesos de sesiones distintas pasa por aquí primero.
export const KG_PER_LB = 0.453592

export function weightInKg(weight, unit) {
  const w = Number(weight) || 0
  return unit === 'lb' ? w * KG_PER_LB : w
}

// Pasa un peso de una unidad a otra, redondeado a 0,1 (lo que pinta la app).
// Sin unidad de origen se asume la de destino: los datos viejos sin unit no
// deben moverse.
export function convertWeight(weight, fromUnit, toUnit) {
  const w = Number(weight) || 0
  if (!fromUnit || !toUnit || fromUnit === toUnit) return w
  const kg = weightInKg(w, fromUnit)
  return round1(toUnit === 'lb' ? kg / KG_PER_LB : kg)
}

// 1RM estimado en kilos, venga la serie en la unidad que venga. Es la forma
// comparable del récord: dos sesiones solo se pueden ordenar en la misma vara.
export function calc1RMKg(weight, reps, unit) {
  return calc1RM(weightInKg(weight, unit), reps)
}

/**
 * Compara { reps, weight } contra la misma serie de la vez anterior.
 *
 * El eje lo elige lo que de verdad cambió, porque es lo que el levantador
 * reconoce: si las reps son las mismas, la noticia es el peso; si el peso es el
 * mismo, son las reps. Cuando se mueven las dos a la vez (85×3 después de 80×5)
 * ninguna de las dos cuenta la historia sola, así que decide el 1RM estimado.
 *
 * Devuelve null cuando no hay nada honesto que comparar — sin serie anterior no
 * se inventa un veredicto.
 */
export function compareSet(current, previous) {
  if (!current || !previous) return null

  const cr = Number(current.reps)
  const cw = Number(current.weight)
  const pr = Number(previous.reps)
  const pw = Number(previous.weight)

  // Sin reps no hay serie. El peso sí puede ser 0: dominadas, fondos, abdominales.
  if (!(cr > 0) || !(pr > 0)) return null
  if (!Number.isFinite(cw) || !Number.isFinite(pw)) return null

  if (cr === pr && cw === pw) return { verdict: 'matched', axis: 'same', delta: 0 }

  if (cr === pr) {
    const d = round1(cw - pw)
    return { verdict: d > 0 ? 'beat' : 'short', axis: 'weight', delta: d }
  }

  if (cw === pw) {
    const d = cr - pr
    return { verdict: d > 0 ? 'beat' : 'short', axis: 'reps', delta: d }
  }

  const c = calc1RM(cw, cr)
  const p = calc1RM(pw, pr)
  const d = round1(c - p)
  if (d === 0) return { verdict: 'matched', axis: 'e1rm', delta: 0 }
  return { verdict: d > 0 ? 'beat' : 'short', axis: 'e1rm', delta: d }
}

const num = (n, locale = 'es-CO') => Math.abs(n).toLocaleString(locale, { maximumFractionDigits: 1 })

/**
 * La etiqueta corta que va en la fila. Vive junto a la unidad de la serie, así
 * que el eje "peso" no repite kg dos veces si no hace falta — pero sí lo dice,
 * porque una fila con "+2,5" suelto se confunde con reps.
 */
export function formatDelta(cmp, unit = 'kg', t = (s) => s, locale = 'es-CO') {
  if (!cmp) return null
  if (cmp.verdict === 'matched') return '='
  const sign = cmp.delta > 0 ? '+' : '−'
  if (cmp.axis === 'reps') {
    return `${sign}${num(cmp.delta, locale)} ${t(Math.abs(cmp.delta) === 1 ? 'rep' : 'reps')}`
  }
  if (cmp.axis === 'e1rm') return `${sign}${num(cmp.delta, locale)} ${unit} 1RM`
  return `${sign}${num(cmp.delta, locale)} ${unit}`
}

/**
 * Lo que oye quien no ve la pantalla. El signo y el color no le llegan, así que
 * la frase tiene que decir el veredicto con palabras.
 */
export function describeDelta(cmp, unit = 'kg', t = (s) => s, locale = 'es-CO') {
  if (!cmp) return null
  if (cmp.verdict === 'matched') return t('Igual que la vez anterior')
  const tail = t(cmp.delta > 0 ? 'más que la vez anterior' : 'menos que la vez anterior')
  if (cmp.axis === 'reps') {
    return `${num(cmp.delta, locale)} ${t(Math.abs(cmp.delta) === 1 ? 'repetición' : 'repeticiones')} ${tail}`
  }
  if (cmp.axis === 'e1rm') return `${num(cmp.delta, locale)} ${unit} ${t('de 1RM estimado')} ${tail}`
  return `${num(cmp.delta, locale)} ${unit} ${tail}`
}
