// Enlaces para compartir un ciclo o una rutina.
//
// Piezas puras del flujo: construir la URL, contar lo que hay dentro del plan y
// convertir lo que devuelve get_shared_routine en el payload que acepta
// createRoutine. Están aquí, fuera de los hooks y de la UI, porque son las que
// se pueden probar sin red y las que romperían el flujo en silencio si se
// desalinearan de supabase/routine_shares.sql.

// El prefijo corto es deliberado: el enlace se manda por WhatsApp, donde una
// ruta larga se ve como spam.
export const SHARE_PATH = '/r/'

// URL absoluta del enlace. `origin` se pasa explícito para que sea testeable y
// para no depender de window en el render del servidor de vite.
export function shareUrl(token, origin) {
  if (!token) return ''
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')) || ''
  return `${base.replace(/\/$/, '')}${SHARE_PATH}${token}`
}

// Ruta relativa (para navegar dentro de la app o volver tras el login).
export function sharePath(token) {
  return `${SHARE_PATH}${token || ''}`
}

export function countDays(shared) {
  return (shared?.days || []).length
}

export function countExercises(shared) {
  return (shared?.days || []).reduce((n, d) => n + (d.exercises || []).length, 0)
}

// Texto con el que se comparte. Sin hype: qué es y de quién.
export function shareMessage(shared, url) {
  const who = shared?.shared_by ? ` de ${shared.shared_by}` : ''
  const name = shared?.name || 'una rutina'
  return `«${name}»${who} en RAW: ${url}`
}

// Rutina cargada por useRoutines (con routine_days / routine_day_exercises) →
// el mismo payload que acepta createRoutine. Es lo que permite mandarle una
// copia a un cliente sin volver a leer el árbol del servidor: la pantalla ya lo
// tiene entero. Los días y ejercicios vienen ya ordenados de useRoutines, y el
// orden en el payload es el que manda (create_routine_tree lo asigna por
// posición), así que no hace falta arrastrar day_order ni exercise_order.
export function routineToInput(routine, { name } = {}) {
  if (!routine) throw new Error('No hay rutina que copiar')

  return sharedRoutineToInput({
    name: routine.name,
    description: routine.description,
    type: routine.type,
    goal: routine.goal,
    level: routine.level,
    days_per_week: routine.days_per_week,
    days: (routine.routine_days || []).map(d => ({
      day_name: d.day_name,
      focus: d.focus,
      exercises: (d.routine_day_exercises || []).map(ex => ({
        exercise_name: ex.exercise_name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
      })),
    })),
  }, { name })
}

// snapshot compartido → payload de createRoutine (useRoutines).
//
// get_shared_routine devuelve el árbol con la misma forma que acepta
// create_routine_tree, así que guardar una copia es literalmente volver a
// pasarlo por el constructor. Lo único que cambia es el origen: la copia no la
// escribió quien la guarda, así que se marca source = 'shared' (ver el CHECK de
// routines_invariants.sql). is_active nunca viaja: activar es un verbo aparte y
// la copia entra apagada.
export function sharedRoutineToInput(shared, { name } = {}) {
  if (!shared) throw new Error('No hay rutina que guardar')

  return {
    name: (name ?? shared.name ?? '').trim() || 'Rutina compartida',
    description: shared.description ?? null,
    type: shared.type === 'single_day' ? 'single_day' : 'cycle',
    source: 'shared',
    goal: shared.goal ?? null,
    level: shared.level ?? null,
    days_per_week: shared.days_per_week ?? null,
    days: (shared.days || []).map(d => ({
      day_name: d.day_name || '',
      focus: d.focus ?? null,
      exercises: (d.exercises || []).map(ex => ({
        exercise_name: ex.exercise_name,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        rest_seconds: ex.rest_seconds ?? null,
        notes: ex.notes ?? null,
      })),
    })),
  }
}
