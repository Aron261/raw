// Progreso de metas.
//
// Vivía dentro de Training.jsx, atado a los hooks de esa pantalla, y por eso el
// entrenador veía las metas de su cliente como texto muerto ("Objetivo: 100
// kg") sin barra ni porcentaje: la cuenta no existía fuera de la portada. Aquí
// es un módulo puro — entra la meta y el contexto, sale el progreso — así que
// las dos pantallas cuentan lo mismo y la cuenta se puede probar sola.
//
// Tres decisiones que este módulo cambia respecto a lo que hacía la portada:
//
// 1. Se compara en la unidad DE LA META, no en la del perfil. El modal deja
//    elegir kg o lb por meta y luego se pintaba `goal.unit` mientras el
//    progreso se calculaba en la unidad del perfil: una meta en libras con el
//    perfil en kilos mostraba el objetivo, el actual y la unidad en tres varas
//    distintas, con un error de 2,2×.
//
// 2. El progreso se mide desde donde arrancaste, no desde cero. Si ya haces
//    sentadilla de 90 kg y te propones 100, la barra marcaba 90 % el primer
//    día: el 90 % ya estaba hecho antes de proponerte nada, y los 10 kg que sí
//    son la meta se quedaban sin señal. Con `start_value` la barra mide el
//    trabajo que te propusiste, no el que ya tenías.
//
// 3. Una meta se puede llegar tarde. Con `target_date` hay ritmo: cuánto
//    debería llevar hoy quien vaya a tiempo, y si vas por detrás.

import { calc1RMKg, convertWeight } from './progress'
import { mondayOf, toLocalISODate } from './calendar'

export const GOAL_TYPES = ['exercise_weight', 'days_trained', 'sessions_per_week', 'body_weight']

// Metas que se miden contra una ventana que se reinicia sola (el mes en curso,
// la semana en curso). No se "cumplen" para siempre: se cumplen ESTE mes.
export const RECURRING_TYPES = ['days_trained', 'sessions_per_week']
export const isRecurring = (goal) => RECURRING_TYPES.includes(goal?.type)

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const DAY_MS = 86400000

// ── Progreso normalizado ──────────────────────────────────────────────────
// (actual − inicio) / (objetivo − inicio). Sirve igual para subir (sentadilla
// 90 → 100) que para bajar (peso corporal 82 → 76): cuando la meta va hacia
// abajo el denominador también es negativo y el cociente vuelve a ser el
// trabajo hecho sobre el trabajo propuesto.
//
// Sin inicio (metas creadas antes de que existiera la columna) se mide desde
// cero, que es lo que hacía la app: preferimos que una meta vieja siga
// contando lo mismo a inventarle un punto de partida que nadie registró.
export function progressPct(current, target, start = null) {
  const c = num(current) ?? 0
  const tgt = num(target)
  if (tgt == null) return 0
  const s = num(start) ?? 0
  const span = tgt - s
  // Objetivo igual al inicio: no hay trabajo que medir. Está cumplida si ya
  // estás en el valor, y si no, no hay barra que llenar.
  if (span === 0) return c === tgt ? 100 : 0
  const pct = ((c - s) / span) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

// ── Ritmo ─────────────────────────────────────────────────────────────────
// Con fecha objetivo, la pregunta deja de ser "cuánto llevo" y pasa a ser
// "cuánto debería llevar hoy". `expectedPct` es la parte del plazo que ya
// gastaste; ir por debajo de eso es ir atrasado.
//
// El margen de 5 puntos evita que una meta marque "atrasado" el mismo día que
// la creas por un redondeo de un día.
export function computePace(goal, pct, now = new Date()) {
  if (!goal?.target_date) return null
  const end = startOfDay(new Date(`${goal.target_date}T00:00:00`))
  if (Number.isNaN(end.getTime())) return null

  const today = startOfDay(now)
  const startedAt = goal.created_at ? startOfDay(new Date(goal.created_at)) : today
  const daysLeft = Math.round((end - today) / DAY_MS)
  const totalDays = Math.max(1, Math.round((end - startedAt) / DAY_MS))
  const elapsed = Math.max(0, Math.round((today - startedAt) / DAY_MS))
  const expectedPct = Math.max(0, Math.min(100, Math.round((elapsed / totalDays) * 100)))

  return {
    daysLeft,
    expectedPct,
    overdue: daysLeft < 0 && pct < 100,
    onTrack: pct >= expectedPct - 5,
  }
}

// ── Cálculo por tipo ──────────────────────────────────────────────────────

// Mejor marca en un ejercicio, en la unidad de la meta.
//
// Con `target_reps` la marca es el peso real levantado a esas reps o más (una
// meta de "100 kg × 5" no se cumple con un single de 105). Sin reps objetivo se
// compara el 1RM estimado, que es como se lee "quiero llegar a 100".
function bestForExercise(goal, workouts, unit) {
  const wantedReps = num(goal.target_reps)
  const name = (goal.exercise_name || '').toLowerCase()
  if (!name) return 0

  let best = 0
  ;(workouts || []).forEach(w => {
    if (!w.ended_at) return
    ;(w.workout_exercises || []).forEach(we => {
      if ((we.exercises?.name || '').toLowerCase() !== name) return
      ;(we.sets || []).forEach(s => {
        if (wantedReps) {
          if ((num(s.reps) ?? 0) < wantedReps) return
          const weight = convertWeight(num(s.weight) ?? 0, we.unit || 'kg', unit)
          if (weight > best) best = weight
        } else {
          const rm = convertWeight(calc1RMKg(s.weight, s.reps, we.unit), 'kg', unit)
          if (rm > best) best = rm
        }
      })
    })
  })
  return best
}

// Días DISTINTOS entrenados en el mes en curso. Contaba entrenos, no días, así
// que dos sesiones un martes sumaban dos al contador de una meta que se pinta
// como "x / 20 días este mes".
function daysTrainedThisMonth(workouts, now) {
  const days = new Set()
  ;(workouts || []).forEach(w => {
    if (!w.ended_at) return
    const d = new Date(w.started_at)
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      days.add(toLocalISODate(d))
    }
  })
  return days.size
}

// Días distintos entrenados en la semana en curso (lunes → hoy). La semana de
// la app empieza el lunes en todas partes (calendario, racha); esto no
// inventa una semana propia.
function daysTrainedThisWeek(workouts, now) {
  const monday = startOfDay(mondayOf(now))
  const days = new Set()
  ;(workouts || []).forEach(w => {
    if (!w.ended_at) return
    const d = new Date(w.started_at)
    if (startOfDay(d) >= monday) days.add(toLocalISODate(d))
  })
  return days.size
}

// Peso corporal actual, en la unidad de la meta.
function currentBodyWeight(logs, unit) {
  const list = (logs || []).filter(l => num(l.weight) != null)
  if (!list.length) return null
  // `logs` llega de useBodyWeight ordenado de viejo a nuevo, pero no se confía:
  // el último por fecha es el actual venga como venga la lista.
  const latest = list.reduce((a, b) =>
    new Date(b.logged_at) > new Date(a.logged_at) ? b : a
  )
  return convertWeight(num(latest.weight), latest.unit || 'kg', unit)
}

// Punto de partida de una meta de peso: el que se guardó al crearla y, si es
// una meta vieja sin él, el registro más cercano a su fecha de creación. Sin
// inicio no hay dirección — una meta de bajar de 82 a 76 mediría "38 %
// cumplido" solo por pesar 76 · 2.
function inferredBodyWeightStart(goal, logs, unit) {
  const stored = num(goal.start_value)
  if (stored != null) return stored

  const list = (logs || []).filter(l => num(l.weight) != null)
  if (!list.length) return null

  const created = goal.created_at ? new Date(goal.created_at) : null
  const before = created
    ? list.filter(l => new Date(l.logged_at) <= created)
    : []
  const pick = before.length
    ? before.reduce((a, b) => (new Date(b.logged_at) > new Date(a.logged_at) ? b : a))
    : list.reduce((a, b) => (new Date(b.logged_at) < new Date(a.logged_at) ? b : a))

  return convertWeight(num(pick.weight), pick.unit || 'kg', unit)
}

// La unidad en la que se mide una meta. 'días' no es una unidad de peso: las
// metas de frecuencia se cuentan en días y cualquier conversión sobre ellas
// sería absurda, así que caen a kg y nunca se convierten.
const goalUnit = (goal) => (goal?.unit && goal.unit !== 'días' ? goal.unit : 'kg')

/**
 * Lo que vale HOY la métrica de una meta, en la unidad de la meta.
 *
 * Se exporta aparte porque el modal de crear la necesita antes de que la meta
 * exista: `start_value` es esto mismo medido en el instante de crearla. Sin
 * ese sello, el progreso volvería a contarse desde cero.
 */
export function currentValue(goal, ctx = {}) {
  const { workouts = [], bodyWeightLogs = [], now = new Date() } = ctx
  const unit = goalUnit(goal)

  switch (goal?.type) {
    case 'exercise_weight':   return bestForExercise(goal, workouts, unit)
    case 'days_trained':      return daysTrainedThisMonth(workouts, now)
    case 'sessions_per_week': return daysTrainedThisWeek(workouts, now)
    case 'body_weight':       return currentBodyWeight(bodyWeightLogs, unit)
    default:                  return 0
  }
}

/**
 * Progreso de una meta.
 *
 * @param goal  fila de `goals`
 * @param ctx   { workouts, bodyWeightLogs, now }
 * @returns la meta con { current, start, pct, reached, remaining, pace }
 *          — `current` y `remaining` en `goal.unit`.
 */
export function computeGoalProgress(goal, ctx = {}) {
  const { bodyWeightLogs = [], now = new Date() } = ctx
  const unit = goalUnit(goal)
  const target = num(goal?.target_value) ?? 0

  const measured = currentValue(goal, ctx)
  let current = measured ?? 0
  let start = num(goal?.start_value)

  if (isRecurring(goal)) {
    // Una meta recurrente arranca de cero cuando arranca su ventana: su punto
    // de partida no es un número que se guarde, es el día 1 (o el lunes).
    start = 0
  } else if (goal?.type === 'body_weight') {
    start = inferredBodyWeightStart(goal, bodyWeightLogs, unit)
    // Sin báscula todavía no hay nada que medir: la meta se queda en 0 % en
    // vez de fingir que pesas cero y que ya bajaste todo lo que querías.
    if (measured == null) current = start ?? 0
  }

  const pct = progressPct(current, target, start)
  const reached = target !== 0 && pct >= 100

  // Lo que falta, siempre en positivo y en la dirección que tenga la meta.
  const remaining = Math.max(0, Math.abs(target - current))

  return {
    ...goal,
    current: Math.round(current * 10) / 10,
    start: start == null ? null : Math.round(start * 10) / 10,
    pct,
    reached,
    remaining: Math.round(remaining * 10) / 10,
    pace: computePace(goal, pct, now),
  }
}

// ── Familias ──────────────────────────────────────────────────────────────
// Una meta de sentadilla y una de "4 días por semana" no son la misma clase de
// compromiso: una mide una marca que sube sola una vez al mes, la otra un
// hábito que se gana cada semana. Mezclarlas en una lista ordenada por
// porcentaje comparaba números que no significan lo mismo — un 90 % de
// sentadilla es estar a 10 kg, un 90 % de constancia es haber ido casi todos
// los días. Se leen mejor separadas.
export const GOAL_KIND = {
  exercise_weight:   'strength',
  body_weight:       'body',
  sessions_per_week: 'consistency',
  days_trained:      'consistency',
}

// Dónde vive cada familia. Una meta se mide donde se actúa sobre ella: la
// sentadilla y la constancia se miran desde Entreno, porque lo que las mueve es
// entrenar; el peso corporal se mira desde Nutrición, porque lo que lo mueve es
// lo que comes. Tenerlas juntas en la portada obligaba a leer una meta de
// báscula en la pantalla donde no puedes hacer nada al respecto.
export const GOAL_HOME = {
  strength:    'training',
  consistency: 'training',
  body:        'nutrition',
}

// El orden en que se leen: lo que levantas, lo que pesas, lo que apareces.
export const KIND_ORDER = ['strength', 'body', 'consistency']
export const KIND_LABEL = {
  strength:    'Fuerza',
  body:        'Cuerpo',
  consistency: 'Constancia',
}

/**
 * Las metas agrupadas por familia, cada grupo ya con su progreso y ordenado.
 * Los grupos vacíos no salen: un encabezado sobre nada es ruido.
 *
 * Con `home` solo salen las familias que viven en esa pantalla (ver GOAL_HOME).
 */
export function groupGoals(goals, ctx = {}, { home = null } = {}) {
  const computed = computeGoals(goals, ctx)
  return KIND_ORDER
    .filter(kind => !home || GOAL_HOME[kind] === home)
    .map(kind => ({
      kind,
      label: KIND_LABEL[kind],
      goals: computed.filter(g => GOAL_KIND[g.type] === kind),
    }))
    .filter(group => group.goals.length > 0)
}

/** Los tipos de meta que se crean y se miden en una pantalla. */
export const typesForHome = (home) =>
  Object.keys(GOAL_KIND).filter(type => GOAL_HOME[GOAL_KIND[type]] === home)

// Todas las metas con su progreso, ordenadas como se leen: primero lo que
// sigue en juego (y dentro de eso, lo más cerca de caer), al final lo cumplido.
export function computeGoals(goals, ctx = {}) {
  return (goals || [])
    .map(g => computeGoalProgress(g, ctx))
    .sort((a, b) => {
      const aDone = a.completed_at || a.reached
      const bDone = b.completed_at || b.reached
      if (!!aDone !== !!bDone) return aDone ? 1 : -1
      return b.pct - a.pct
    })
}

// ── Texto ─────────────────────────────────────────────────────────────────
// Lo que decía antes ("Apenas empiezas. Suma tu próximo entreno.") es la clase
// de ánimo que PRODUCT.md descarta: la app no arenga, informa. Un dato dice
// más y no envejece — faltan 7,5 kg, quedan 12 días.
//
// Devuelve claves en español (así funciona i18n aquí) con los números ya
// interpolados por quien llama.
export function goalStatus(goal) {
  if (goal.completed_at || goal.reached) return { key: 'Cumplida', tone: 'done' }
  if (goal.pace?.overdue) return { key: 'Fuera de plazo', tone: 'late' }
  if (goal.pace && !goal.pace.onTrack) return { key: 'Vas por detrás del plazo', tone: 'late' }
  if (goal.pace) return { key: 'En plazo', tone: 'ok' }
  return null
}
