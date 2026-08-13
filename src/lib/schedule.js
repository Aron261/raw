// La capa de planificación del calendario — helpers puros, sin React ni
// Supabase, para que se puedan probar sin montar nada.
//
// El calendario de Raw arrastraba un problema de fondo: el ciclo activo es
// ROTACIONAL (avanza cuando registras un entreno, no cuando llega el martes),
// pero el calendario era una capa aparte que había que rellenar a mano, día a
// día, con un formulario. El resultado previsible es que nadie la rellena y la
// rejilla se queda contando el pasado.
//
// Este módulo cierra las dos mitades de ese hueco:
//
//   1. `matchPlannedSession` — cuando terminas un entreno, el plan de ese día
//      se marca solo. Sin esto, un plan cumplido sigue diciendo "Planeado"
//      para siempre y la rejilla miente a los dos días.
//
//   2. `projectCycle` — proyecta hacia adelante lo que el ciclo YA sabe que
//      toca, sobre los días en los que de verdad entrenas. No escribe nada:
//      son fantasmas, una previsión. Se vuelven reales si los fijas.
//
// La proyección no inventa una cadencia: la lee de tu historial. Si entrenas
// lunes/miércoles/viernes, proyecta ahí. Si tu historial no da señal, no
// proyecta nada — es preferible una rejilla vacía a una que se inventa el plan.

import { toLocalISODate, mondayOf } from './calendar'

// Índice del día del ciclo por el que va la rotación (0-based sobre `days`
// ordenados). Es la misma regla que gobierna "Siguiente" en la portada.
function rotationIndex(days, workouts, cycleId) {
  const linked = (workouts || []).filter(w => w.routine_id === cycleId && w.routine_day_id)
  if (!linked.length) return 0

  const last = [...linked].sort((a, b) => {
    const ta = new Date(a.started_at || a.created_at).getTime()
    const tb = new Date(b.started_at || b.created_at).getTime()
    return tb - ta
  })[0]

  const idx = days.findIndex(d => d.id === last.routine_day_id)
  // Rutina editada y el día ya no existe: la rotación vuelve a empezar.
  if (idx === -1) return 0
  return (idx + 1) % days.length
}

// Siguiente día de un ciclo activo dado el historial. Ignora entrenos libres
// (sin routine_day_id). Vive aquí — módulo puro — y useRoutines lo reexporta,
// que es de donde lo importa el resto de la app.
export function getNextRoutineDay(activeCycle, workoutsHistory) {
  if (!activeCycle || !activeCycle.routine_days?.length) return null
  const days = [...activeCycle.routine_days].sort((a, b) => a.day_order - b.day_order)
  return days[rotationIndex(days, workoutsHistory, activeCycle.id)]
}

// ── 1. Cerrar el círculo ─────────────────────────────────────────────────
// Qué sesión planeada cumple un entreno recién terminado.
//
// Dos reglas, en este orden:
//   a) El vínculo explícito manda. Planeaste "Upper A" y registraste "Upper A":
//      es ese, sin ambigüedad.
//   b) Si no, un entreno cumple un plan de fuerza SIN vincular ("toca fuerza"),
//      que es lo que la mayoría de la gente escribe.
//
// Lo que deliberadamente NO hace: dar por cumplido un plan que apuntaba a un
// día de rutina concreto con un entreno distinto. Cumplir "Upper A" porque
// hiciste pierna sería exactamente el tipo de dato falso que hace que dejes de
// creerle a la rejilla.
export function matchPlannedSession(workout, sessions) {
  if (!workout?.started_at || !workout?.ended_at) return null
  const iso = toLocalISODate(new Date(workout.started_at))

  const open = (sessions || []).filter(s => s.date === iso && s.status === 'planned')
  if (!open.length) return null

  const byOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0)

  if (workout.routine_day_id) {
    const linked = open
      .filter(s => s.routine_day_id === workout.routine_day_id)
      .sort(byOrder)
    if (linked.length) return linked[0]
  }

  const free = open.filter(s => s.kind === 'strength' && !s.routine_day_id).sort(byOrder)
  return free[0] || null
}

// ── 2. Cadencia observada ────────────────────────────────────────────────
// En qué días de la semana entrena esta persona de verdad (0 = lunes … 6 =
// domingo). No se pregunta: se cuenta.
//
// `target` fuerza cuántos días devolver (p. ej. el days_per_week de la rutina).
// Sin él, se deduce del ritmo real: entrenos por semana en la ventana.
export function trainingWeekdays(workouts, { now = new Date(), weeks = 6, target = null } = {}) {
  const start = mondayOf(now)
  start.setDate(start.getDate() - weeks * 7)

  const counts = new Array(7).fill(0)
  const activeWeeks = new Set()
  let total = 0
  for (const w of workouts || []) {
    if (!w.ended_at || !w.started_at) continue
    const d = new Date(w.started_at)
    if (d < start || d > now) continue
    counts[(d.getDay() + 6) % 7]++
    activeWeeks.add(toLocalISODate(mondayOf(d)))
    total++
  }
  if (!total) return []

  // Días por semana sobre las semanas en las que SÍ se entrenó, no sobre la
  // ventana entera: dividir por las siete semanas hunde la cifra de quien
  // empezó hace tres, y proyectaríamos dos días a quien entrena tres.
  const perWeek = target || Math.round(total / activeWeeks.size)
  const n = Math.max(1, Math.min(7, perWeek))

  return counts
    .map((count, day) => ({ count, day }))
    .filter(x => x.count > 0)
    // Más frecuente primero; a igualdad, el día que cae antes en la semana.
    .sort((a, b) => b.count - a.count || a.day - b.day)
    .slice(0, n)
    .map(x => x.day)
    .sort((a, b) => a - b)
}

// ── 3. Proyección ────────────────────────────────────────────────────────
// Los próximos días del ciclo colocados sobre las fechas en las que se entrena.
// Devuelve fantasmas: `{ date, day, routineId, routineName, ghost: true }`.
//
// No proyecta sobre una fecha que ya tiene algo — un plan escrito a mano o un
// entreno registrado —, porque lo que ya decidiste vale más que la previsión.
// Tampoco proyecta hacia atrás: el pasado no se planea.
export function projectCycle({
  activeCycle,
  workouts = [],
  sessions = [],
  from = new Date(),
  horizonDays = 70,
  weekdays = null,
} = {}) {
  if (!activeCycle?.routine_days?.length) return []

  const days = [...activeCycle.routine_days].sort((a, b) => a.day_order - b.day_order)

  const wd = weekdays || trainingWeekdays(workouts, {
    now: from,
    target: activeCycle.days_per_week || null,
  })
  // Sin señal en el historial no se proyecta. Una rejilla vacía es honesta;
  // una rejilla que se inventa tu semana, no.
  if (!wd.length) return []
  const wdSet = new Set(wd)

  const taken = new Set(sessions.map(s => s.date))
  for (const w of workouts) {
    if (w.ended_at && w.started_at) taken.add(toLocalISODate(new Date(w.started_at)))
  }

  // Un plan FIJADO a un día de ESTE ciclo consume su turno en la rotación.
  // Sin esto, fijar el ghost «d1» del lunes dejaba el índice quieto y el
  // siguiente hueco proyectaba «d1» otra vez: la rejilla se contradecía con lo
  // que el usuario acababa de fijar. Un cardio o un plan libre sí ceden el
  // sitio sin consumir turno (eso es lo que prueba el caso del 12→14).
  const pinnedByDate = new Map()
  for (const s of sessions) {
    if (s.kind === 'strength' && s.status !== 'skipped'
        && s.routine_id === activeCycle.id && s.routine_day_id) {
      pinnedByDate.set(s.date, s.routine_day_id)
    }
  }
  const dayPos = new Map(days.map((d, i) => [d.id, i]))

  let idx = rotationIndex(days, workouts, activeCycle.id)

  const out = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const fromISO = toLocalISODate(cursor)

  for (let i = 0; i < horizonDays; i++) {
    const iso = toLocalISODate(cursor)
    if (iso >= fromISO && wdSet.has((cursor.getDay() + 6) % 7) && !taken.has(iso)) {
      out.push({
        date: iso,
        day: days[idx % days.length],
        routineId: activeCycle.id,
        routineName: activeCycle.name,
        ghost: true,
      })
      idx++
    } else if (iso >= fromISO && pinnedByDate.has(iso)) {
      const pos = dayPos.get(pinnedByDate.get(iso))
      if (pos !== undefined) idx = pos + 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

// ── 4. Series ────────────────────────────────────────────────────────────
// Tope de ocurrencias que se materializan de una vez. Es un tope de FILAS, no
// de semanas: con una cadencia de ocho semanas, 26 ocurrencias son cuatro
// años. Suficiente para cualquier plan real sin dejar miles de filas muertas
// cuando la persona cambie de idea en marzo, que es lo normal.
export const MAX_SERIES_OCCURRENCES = 26

// Las fechas de una serie, empezando en `startISO`. `everyWeeks` es la
// cadencia: 1 = cada semana (cardio los martes), 4 = cada cuatro (una descarga
// cada cuatro semanas). Sin cadencia declarada no se inventa ninguna — por eso
// una descarga se repite solo si la pides, y no porque el calendario deduzca
// que "toca". No hay dato en la rutina que diga cada cuánto descargas.
export function recurringDates(startISO, count, everyWeeks = 1) {
  const n = Math.max(1, Math.min(MAX_SERIES_OCCURRENCES, Number(count) || 1))
  const step = Math.max(1, Number(everyWeeks) || 1)
  const [y, m, d] = String(startISO).split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(toLocalISODate(cursor))
    cursor.setDate(cursor.getDate() + step * 7)
  }
  return out
}

// ── Adherencia ───────────────────────────────────────────────────────────
// Lo que te comprometiste a hacer en una semana y lo que cumpliste.
//
// Solo cuenta lo que es una tarea. Un 'rest' cumplido no es un logro y una
// 'note' no se hace; meterlos inflaría el numerador y el denominador a la vez
// y la cifra dejaría de significar nada. Una 'deload' marca la semana entera,
// no es una sesión que se haga.
export const COMMITMENT_KINDS = ['strength', 'cardio', 'mobility']

export function weekAdherence(sessions, date = new Date()) {
  const start = toLocalISODate(mondayOf(date))
  const end = new Date(mondayOf(date))
  end.setDate(end.getDate() + 6)
  const last = toLocalISODate(end)

  let planned = 0
  let done = 0
  for (const s of sessions || []) {
    if (!COMMITMENT_KINDS.includes(s.kind)) continue
    if (s.date < start || s.date > last) continue
    planned++
    if (s.status === 'done') done++
  }
  return { planned, done }
}

// ── 5. Lo que de verdad pasó ─────────────────────────────────────────────
// Los tipos de sesión que llevan datos propios. Fuerza no: un entreno de
// fuerza se registra serie a serie en `workouts`, no aquí.
export const LOGGABLE_KINDS = ['cardio', 'mobility']
export const isLoggable = (kind) => LOGGABLE_KINDS.includes(kind)

// Resumen legible de una sesión registrada: "45 min · 8,2 km · RPE 7".
// Un campo ausente no aparece — nulo es "no lo sé", no cero.
export function formatSessionLog(session, { locale = 'es-CO', t = (x) => x } = {}) {
  if (!session) return ''
  const parts = []
  if (session.duration_min > 0) parts.push(`${session.duration_min} ${t('min')}`)
  if (session.distance_km > 0) {
    parts.push(`${Number(session.distance_km).toLocaleString(locale, { maximumFractionDigits: 2 })} km`)
  }
  if (session.rpe > 0) parts.push(`RPE ${session.rpe}`)
  return parts.join(' · ')
}

// Minutos de trabajo aeróbico y de movilidad registrados en un rango. Solo
// cuenta lo hecho: un plan sin cumplir no son minutos entrenados.
export function loggedMinutes(sessions, { from, to, kinds = LOGGABLE_KINDS } = {}) {
  let total = 0
  for (const s of sessions || []) {
    if (s.status !== 'done' || !(s.duration_min > 0)) continue
    if (!kinds.includes(s.kind)) continue
    if (from && s.date < from) continue
    if (to && s.date > to) continue
    total += s.duration_min
  }
  return total
}

// Proyección indexada por fecha, que es como la consume la rejilla.
export function projectionByDate(args) {
  const map = {}
  for (const g of projectCycle(args)) map[g.date] = g
  return map
}
