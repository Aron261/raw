// Fuerza relativa: qué vale una marca para el cuerpo que la levanta.
//
// «Mis levantamientos» ordenaba por 1RM absoluto, así que arriba salía siempre
// el peso muerto y abajo siempre el curl. Eso no es un ranking de logro, es la
// lista ordenada por qué ejercicio mueve más hierro — y no cambia nunca por
// mucho que mejores. Un banca de 100 kg pesando 78 dice una cosa; el mismo
// banca pesando 110 dice otra.
//
// Aquí la marca se divide por el peso corporal y, en los básicos, se compara
// contra estándares publicados para dar un nivel.
//
// ⚠️ Sobre los números: son aproximaciones de las tablas de fuerza que circulan
// (tipo strengthlevel.com), redondeadas. No son una medición ni una verdad
// clínica: sirven para situarte, no para discutir. Por eso el nivel solo se da
// en los ejercicios donde el estándar significa algo, y el resto enseña la
// razón sin etiqueta — inventarle un nivel a un crossover en polea sería
// precisión falsa.

// Múltiplos de peso corporal por nivel, para hombre. Orden: el umbral MÍNIMO
// para entrar en cada nivel.
const MALE = {
  squat:     [0.75, 1.25, 1.75, 2.25, 2.75],
  bench:     [0.50, 0.75, 1.25, 1.75, 2.00],
  deadlift:  [1.00, 1.50, 2.00, 2.50, 3.00],
  ohp:       [0.35, 0.55, 0.80, 1.10, 1.40],
  row:       [0.50, 0.75, 1.00, 1.35, 1.75],
  // En dominadas la carga es el cuerpo entero más el lastre, así que el
  // múltiplo arranca en 1: hacer una ya es mover tu peso.
  pullup:    [1.00, 1.20, 1.50, 1.80, 2.20],
}

// Las mujeres levantan menos en absoluto pero la proporción no baja igual en
// todos los patrones: el tren inferior aguanta mejor la comparación que el
// empuje horizontal. Un solo factor sería más simple y más falso.
const FEMALE_FACTOR = {
  squat: 0.80, bench: 0.68, deadlift: 0.82, ohp: 0.66, row: 0.72, pullup: 0.80,
}

export const LEVELS = ['Principiante', 'Novato', 'Intermedio', 'Avanzado', 'Élite']

// Qué patrón es cada ejercicio. Se casa por subcadena sobre el nombre
// normalizado, en el orden de esta lista: lo más específico primero, porque
// «sentadilla búlgara» contiene «sentadilla» pero no es una sentadilla con
// barra y no se puede medir con su vara.
const PATTERNS = [
  // Excluidos explícitos: llevan el nombre de un básico pero no lo son.
  { pattern: null, match: ['bulgara', 'búlgara', 'goblet', 'hack', 'sissy', 'smith', 'pistol'] },
  { pattern: null, match: ['rumano', 'piernas rigidas', 'piernas rígidas', 'sumo con mancuern'] },
  { pattern: null, match: ['unilateral', 'en maquina', 'en máquina', 'maquina', 'máquina', 'polea'] },

  { pattern: 'squat',    match: ['sentadilla con barra', 'sentadilla frontal', 'back squat', 'front squat'] },
  { pattern: 'bench',    match: ['press de banca con barra', 'press banca', 'bench press'] },
  { pattern: 'deadlift', match: ['peso muerto convencional', 'peso muerto con barra', 'deadlift'] },
  { pattern: 'ohp',      match: ['press militar con barra', 'press militar de pie', 'overhead press'] },
  { pattern: 'pullup',   match: ['dominadas', 'pull up', 'pull-up', 'chin up'] },
  { pattern: 'row',      match: ['remo con barra', 'barbell row', 'remo pendlay'] },
]

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim()

/**
 * El patrón de fuerza de un ejercicio, o null si no es un básico medible.
 * Devolver null es la respuesta correcta y frecuente: la mayoría de ejercicios
 * de una rutina real son accesorios sin estándar.
 */
export function patternOf(exerciseName) {
  const n = norm(exerciseName)
  if (!n) return null
  for (const { pattern, match } of PATTERNS) {
    if (match.some(m => n.includes(norm(m)))) return pattern
  }
  return null
}

/** Los umbrales de un patrón para un sexo dado. */
export function thresholds(pattern, sex = 'Masculino') {
  const base = MALE[pattern]
  if (!base) return null
  if (sex !== 'Femenino') return base
  const f = FEMALE_FACTOR[pattern] ?? 0.75
  return base.map(v => Math.round(v * f * 100) / 100)
}

/**
 * El nivel que corresponde a una razón peso/corporal, o null si el ejercicio
 * no tiene estándar. Por debajo del primer umbral no hay etiqueta: «peor que
 * principiante» no es información útil, es un juicio.
 */
export function levelFor(ratio, pattern, sex = 'Masculino') {
  const t = thresholds(pattern, sex)
  if (!t || !(ratio > 0)) return null
  let level = null
  for (let i = 0; i < t.length; i++) {
    if (ratio >= t[i]) level = LEVELS[i]
  }
  return level
}

/**
 * Cuánto falta para el siguiente nivel, en múltiplos de peso corporal.
 * Devuelve null en Élite (no hay siguiente) y cuando no hay estándar.
 */
export function nextLevel(ratio, pattern, sex = 'Masculino') {
  const t = thresholds(pattern, sex)
  if (!t || !(ratio > 0)) return null
  const i = t.findIndex(v => ratio < v)
  if (i === -1) return null
  return { level: LEVELS[i], ratio: t[i], gap: Math.round((t[i] - ratio) * 100) / 100 }
}

/**
 * Ranking de fuerza relativa.
 *
 * @param lifts  [{ name, best1RMKg }] — en kilos, que es la vara común
 * @param opts   { bodyWeightKg, sex }
 * @returns ordenado de mayor a menor razón, con nivel donde lo haya
 */
export function rankByRelativeStrength(lifts, { bodyWeightKg, sex = 'Masculino' } = {}) {
  // Sin báscula no hay fuerza relativa: dividir por un peso inventado daría un
  // ranking con aspecto de dato y sin dato dentro.
  if (!(bodyWeightKg > 0)) return []

  return (lifts || [])
    .filter(l => l?.best1RMKg > 0)
    .map(l => {
      const pattern = patternOf(l.name)
      // En dominadas lo que se mueve es el cuerpo más el lastre; medir solo el
      // lastre diría que quien hace dominadas a peso corporal levanta cero.
      const loadKg = pattern === 'pullup' ? l.best1RMKg + bodyWeightKg : l.best1RMKg
      const ratio = Math.round((loadKg / bodyWeightKg) * 100) / 100
      return {
        ...l,
        pattern,
        ratio,
        level: levelFor(ratio, pattern, sex),
        next: nextLevel(ratio, pattern, sex),
      }
    })
    .sort((a, b) => {
      // Los que tienen estándar van primero: son los que el ranking sabe
      // interpretar. Dentro de cada bloque, por razón.
      if (!!a.pattern !== !!b.pattern) return a.pattern ? -1 : 1
      return b.ratio - a.ratio
    })
}
