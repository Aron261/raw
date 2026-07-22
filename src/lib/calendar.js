// Calendario de entrenamiento — helpers puros (fechas, semana ISO, racha) y la
// metadata de tipos de sesión. Sin React: fáciles de testear.
// Fecha local YYYY-MM-DD — una sesión a las 11pm es de hoy, no de mañana UTC.
// Vive aquí (módulo puro, sin Supabase) y useNutrition la reexporta, que es de
// donde la importaba el resto de la app.
export function toLocalISODate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Lunes 00:00 de la semana de `date`. La app trabaja semana Lunes→Domingo
// (getMondayOfWeek en Hub/Training), así que la racha y las franjas usan lo mismo.
export function mondayOf(date) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Clave estable de una semana: la fecha local del lunes ('YYYY-MM-DD').
export function weekKey(date) {
  return toLocalISODate(mondayOf(date))
}

// Matriz del mes: 6 semanas × 7 días (42 celdas), empezando en lunes. Altura
// fija = el grid no salta de alto al cambiar de mes. `month` es 0-indexado.
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // días desde el lunes
  const start = new Date(year, month, 1 - offset)
  const cells = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return cells
}

// Los 7 días (lunes→domingo) de la semana en la que cae `date`.
export function weekDays(date) {
  const start = mondayOf(date)
  const days = []
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return days
}

// Etiqueta del rango de una semana: "13 – 19 de julio", y cuando cruza de mes
// (o de año) nombra ambos: "29 de junio – 5 de julio".
export function weekRangeLabel(date) {
  const days = weekDays(date)
  const a = days[0]
  const b = days[6]
  const month = (d) => MONTHS_ES[d.getMonth()]
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const label = sameMonth
    ? `${a.getDate()} – ${b.getDate()} de ${month(b)}`
    : `${a.getDate()} de ${month(a)} – ${b.getDate()} de ${month(b)}`
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Racha: semanas consecutivas con al menos un entreno terminado, contando hacia
// atrás. Una semana en curso todavía sin entreno NO rompe la racha — se cuenta
// desde la semana pasada. Honesto: un hueco de una semana la corta.
export function computeStreak(workouts, now = new Date()) {
  const weeks = new Set(
    (workouts || [])
      .filter(w => w.ended_at && w.started_at)
      .map(w => weekKey(new Date(w.started_at)))
  )
  if (weeks.size === 0) return 0

  let cursor = mondayOf(now)
  if (!weeks.has(toLocalISODate(cursor))) {
    // Semana actual sin entrenar: la racha sigue viva si la pasada tiene entreno.
    cursor.setDate(cursor.getDate() - 7)
    if (!weeks.has(toLocalISODate(cursor))) return 0
  }

  let streak = 0
  while (weeks.has(toLocalISODate(cursor))) {
    streak++
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

// Tipos de sesión planificada. `color` es una CSS var (theme-aware). El entreno
// COMPLETADO no es un `kind` de la tabla: es un workout real, con su propio hue.
export const KINDS = {
  strength: { label: 'Fuerza',    color: 'var(--c-accent)',     icon: '🏋' },
  cardio:   { label: 'Cardio',    color: 'var(--c-data)',       icon: '🏃' },
  mobility: { label: 'Movilidad', color: 'var(--c-success)',    icon: '🧘' },
  rest:     { label: 'Descanso',  color: 'var(--c-text-ghost)', icon: '😴' },
  deload:   { label: 'Descarga',  color: 'var(--c-record)',     icon: '🔻' },
  note:     { label: 'Nota',      color: 'var(--c-text-muted)', icon: '📝' },
}
export const KIND_ORDER = ['strength', 'cardio', 'mobility', 'rest', 'deload', 'note']

// Color del punto de un entreno completado.
export const DONE_COLOR = 'var(--c-accent)'

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function monthLabel(year, month) {
  const s = `${MONTHS_ES[month]} ${year}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "Lunes, 21 de julio" (sentence case).
export function longDate(date) {
  const s = new Date(date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
