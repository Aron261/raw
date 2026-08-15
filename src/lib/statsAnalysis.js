// Los números que contestan "¿cómo estoy entrenando AHORA?".
//
// Estadísticas era un escaparate de totales históricos: kilos levantados desde
// siempre, mejor 1RM de la vida, tonelaje repartido por músculo desde el primer
// día. Todo eso solo sube. Un número que solo sube no puede decirte que llevas
// tres semanas flojas, y por lo tanto no es un instrumento: es una vitrina.
//
// Aquí viven las dos preguntas que sí se pueden contestar mal —cada cuánto
// entrenas y en qué estás mejorando— con ventanas móviles que comparan lo
// reciente contra lo anterior. Módulo puro: entra la lista de entrenos, salen
// los números, y se puede probar sin base de datos.

import { calc1RM, calc1RMKg, weightInKg } from './progress'
import { mondayOf, toLocalISODate } from './calendar'

const DAY_MS = 86400000
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// Volumen de un entreno, en kilos. Repetido aquí (y no importado de
// hooks/useWorkout) para que este módulo no arrastre React.
export function workoutVolume(w) {
  return (w.workout_exercises || []).reduce((sum, we) => (
    sum + (we.sets || []).reduce(
      (s, set) => s + weightInKg(set.weight || 0, we.unit) * (set.reps || 0), 0
    )
  ), 0)
}

const finished = (workouts) => (workouts || []).filter(w => w.ended_at)

// ── Actividad por semana ──────────────────────────────────────────────────
// La semana, no el mes, es la unidad honesta de la fuerza: los programas se
// escriben en semanas y el mes en curso siempre está a medias, así que la
// barra del mes actual parecía un desplome hasta el día 25.
export function weeklyActivity(workouts, { weeks = 12, now = new Date(), locale = 'es-CO' } = {}) {
  const thisMonday = startOfDay(mondayOf(now))
  const buckets = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday.getTime() - i * 7 * DAY_MS)
    buckets.push({
      key: toLocalISODate(start),
      start,
      end: new Date(start.getTime() + 7 * DAY_MS),
      label: start.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      sessions: 0,
      volume: 0,
      current: i === 0,
    })
  }

  finished(workouts).forEach(w => {
    const d = startOfDay(new Date(w.started_at))
    const b = buckets.find(x => d >= x.start && d < x.end)
    if (!b) return
    b.sessions += 1
    b.volume += workoutVolume(w)
  })

  return buckets.map(({ start, end, ...rest }) => ({ ...rest, volume: Math.round(rest.volume) }))
}

// ── Constancia ────────────────────────────────────────────────────────────
// Cuatro semanas contra las cuatro anteriores. Cuatro y no dos porque una
// semana mala (un viaje, una gripe) no es una tendencia, y con dos ventanas de
// dos semanas cualquier interrupción normal se leería como derrumbe.
//
// La semana en curso queda FUERA de las dos ventanas: está a medias por
// definición y meterla haría que el promedio bajara cada lunes por la mañana.
export function consistency(workouts, { now = new Date() } = {}) {
  const list = finished(workouts)
  const thisMonday = startOfDay(mondayOf(now))
  const at = (weeksAgo) => new Date(thisMonday.getTime() - weeksAgo * 7 * DAY_MS)

  const between = (from, to) =>
    list.filter(w => {
      const d = startOfDay(new Date(w.started_at))
      return d >= from && d < to
    })
  const countBetween = (from, to) => between(from, to).length
  const volumeBetween = (from, to) =>
    Math.round(between(from, to).reduce((s, w) => s + workoutVolume(w), 0))

  const last4 = countBetween(at(4), thisMonday)
  const prev4 = countBetween(at(8), at(4))
  const volume4 = volumeBetween(at(4), thisMonday)
  const prevVolume4 = volumeBetween(at(8), at(4))

  // Semanas seguidas con al menos un entreno, contando hacia atrás. La semana
  // en curso solo rompe la racha si ya terminó — mientras corre, todavía
  // puedes entrenar, así que no cuenta en contra.
  let streakWeeks = 0
  for (let i = 0; i < 260; i++) {
    const from = at(i)
    const to = new Date(from.getTime() + 7 * DAY_MS)
    const trained = countBetween(from, to) > 0
    if (trained) streakWeeks += 1
    else if (i > 0) break
  }

  const lastWorkout = list.reduce(
    (a, w) => (!a || new Date(w.started_at) > new Date(a.started_at) ? w : a),
    null
  )
  const daysSinceLast = lastWorkout
    ? Math.floor((startOfDay(now) - startOfDay(new Date(lastWorkout.started_at))) / DAY_MS)
    : null

  // El hueco más largo entre dos entrenos de los últimos tres meses. Es la
  // cifra que nadie recuerda de sí mismo y la que explica un estancamiento.
  const since = new Date(startOfDay(now).getTime() - 90 * DAY_MS)
  const recentDays = [...new Set(
    list
      .filter(w => new Date(w.started_at) >= since)
      .map(w => toLocalISODate(new Date(w.started_at)))
  )].sort()
  let longestGapDays = 0
  for (let i = 1; i < recentDays.length; i++) {
    const gap = Math.round(
      (new Date(`${recentDays[i]}T00:00:00`) - new Date(`${recentDays[i - 1]}T00:00:00`)) / DAY_MS
    )
    if (gap > longestGapDays) longestGapDays = gap
  }

  const perWeek = last4 / 4
  const prevPerWeek = prev4 / 4

  return {
    last4, prev4,
    volume4, prevVolume4,
    perWeek: Math.round(perWeek * 10) / 10,
    prevPerWeek: Math.round(prevPerWeek * 10) / 10,
    // Sin ventana anterior no hay comparación: la app dice "no lo sé" (null)
    // en vez de fabricar un +100 % desde cero.
    deltaPerWeek: prev4 > 0 ? Math.round(((last4 - prev4) / prev4) * 100) : null,
    deltaVolume: prevVolume4 > 0 ? Math.round(((volume4 - prevVolume4) / prevVolume4) * 100) : null,
    streakWeeks,
    daysSinceLast,
    longestGapDays,
  }
}

// ── Adherencia ────────────────────────────────────────────────────────────
// Lo planeado contra lo hecho. Solo cuentan los días que YA pasaron: un plan
// del viernes que aún no llega no es un incumplimiento, y contarlo haría que
// la adherencia empeorara cuanto más planificaras.
//
// 'rest' y 'note' quedan fuera: descansar no es una tarea que se cumpla.
const ADHERENCE_KINDS = ['strength', 'cardio', 'mobility', 'deload']

export function adherence(sessions, { now = new Date(), weeks = 8 } = {}) {
  const today = toLocalISODate(now)
  const from = toLocalISODate(new Date(startOfDay(now).getTime() - weeks * 7 * DAY_MS))

  const past = (sessions || []).filter(s =>
    ADHERENCE_KINDS.includes(s.kind) && s.date >= from && s.date <= today
  )
  if (!past.length) return null

  const done = past.filter(s => s.status === 'done').length
  return {
    planned: past.length,
    done,
    missed: past.length - done,
    pct: Math.round((done / past.length) * 100),
  }
}

// ── Progresión ────────────────────────────────────────────────────────────
// En qué estás subiendo y en qué llevas parado. Compara el mejor 1RM estimado
// de las últimas `windowWeeks` semanas con el mejor de las `windowWeeks`
// anteriores, ejercicio por ejercicio.
//
// Solo entran los ejercicios con marca en LAS DOS ventanas: uno que empezaste
// el mes pasado no está "subiendo un 100 %", simplemente no tiene con qué
// compararse, y colarlo arriba del todo llenaría la lista de ruido.
//
// Se ordena y se compara en kilos (la vara común) y se pinta en la unidad en
// que se levantó la marca, igual que el resto de la app.
export function progression(workouts, { windowWeeks = 8, now = new Date(), minDeltaPct = 2 } = {}) {
  const cut = new Date(startOfDay(now).getTime() - windowWeeks * 7 * DAY_MS)
  const priorCut = new Date(startOfDay(now).getTime() - 2 * windowWeeks * 7 * DAY_MS)

  const best = {}   // name -> { recent, prior, lastAt }
  finished(workouts).forEach(w => {
    const at = new Date(w.started_at)
    if (at < priorCut) return
    const windowName = at >= cut ? 'recent' : 'prior'
    ;(w.workout_exercises || []).forEach(we => {
      const name = we.exercises?.name
      if (!name) return
      ;(we.sets || []).forEach(s => {
        const rmKg = calc1RMKg(s.weight, s.reps, we.unit)
        if (!rmKg) return
        const e = (best[name] ||= { recent: null, prior: null, lastAt: null })
        const cur = e[windowName]
        if (!cur || rmKg > cur.rmKg) {
          e[windowName] = { rmKg, rm: calc1RM(s.weight, s.reps), unit: we.unit || 'kg' }
        }
        if (windowName === 'recent' && (!e.lastAt || at > e.lastAt)) e.lastAt = at
      })
    })
  })

  return Object.entries(best)
    .filter(([, e]) => e.recent && e.prior)
    .map(([name, e]) => {
      const deltaPct = Math.round(((e.recent.rmKg - e.prior.rmKg) / e.prior.rmKg) * 100)
      return {
        name,
        recent1RM: e.recent.rm,
        prior1RM: e.prior.rm,
        unit: e.recent.unit,
        deltaPct,
        // «Estancado» es honesto: no bajaste, pero tampoco te moviste. Se
        // separa de «bajando» porque piden cosas distintas — uno es cambiar el
        // estímulo, el otro puede ser fatiga o una descarga.
        status: deltaPct >= minDeltaPct ? 'up' : deltaPct <= -minDeltaPct ? 'down' : 'flat',
        daysSince: e.lastAt
          ? Math.floor((startOfDay(now) - startOfDay(e.lastAt)) / DAY_MS)
          : null,
      }
    })
    .sort((a, b) => b.deltaPct - a.deltaPct)
}
