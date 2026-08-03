/*
 * Cuánto entrena cada músculo, no cuántas series hiciste.
 *
 * Hasta aquí la app le apuntaba cada serie a un solo grupo: el press de banca
 * era pecho y nada más, aunque la biblioteca supiera desde el primer día que
 * también mueve tríceps y hombro. El gráfico salía limpio y equivocado — los
 * brazos parecían abandonados en rutinas llenas de empujes y jalones, y el
 * consejo de "grupos rezagados" mandaba a añadir curls a quien ya hacía
 * catorce series indirectas de bíceps por semana.
 *
 * La regla es la que pidió el usuario: una serie cuenta entera para el músculo
 * principal y media para cada secundario.
 *
 * Lo que sale de aquí NO es un reparto. Tres series de press son tres de pecho
 * Y una y media de tríceps: cuatro y media en total, de tres series reales. La
 * suma por grupos supera al número de series hechas, y así tiene que ser,
 * porque mide estímulo recibido y un músculo no deja de trabajar porque otro
 * se lleve el nombre del ejercicio.
 *
 * Sin React y sin Supabase, para que lo puedan usar tanto el generador de
 * rutinas como los hooks y los gráficos.
 */

import { CATCH_ALL } from './muscleGroups'

/** Un músculo secundario recibe media serie por cada serie real. */
export const SECONDARY_FACTOR = 0.5

/**
 * Suma `amount` al grupo principal y `amount * 0.5` a cada secundario, dentro
 * de `into` (grupo → {direct, indirect}). La cantidad es agnóstica a la unidad:
 * vale igual para series que para kilos levantados.
 *
 * Devuelve `into` para poder encadenar sobre el mismo acumulador.
 */
export function attributeSplit(amount, { group, secondaries = [] } = {}, into = {}) {
  if (!amount || !group) return into

  const bucket = (g) => (into[g] ||= { direct: 0, indirect: 0 })
  bucket(group).direct += amount

  const seen = new Set([group])   // el principal ya cobró; no cobra dos veces
  for (const sec of secondaries) {
    if (!sec || seen.has(sec)) continue
    seen.add(sec)
    bucket(sec).indirect += amount * SECONDARY_FACTOR
  }
  return into
}

/** Estímulo total de un grupo: lo directo más lo indirecto. */
export function totalOf(entry) {
  if (!entry) return 0
  return (entry.direct || 0) + (entry.indirect || 0)
}

/**
 * Medias series, que es la resolución real de esta medida. Redondear a entero
 * escondería justo lo que aporta un secundario cuando solo hay un ejercicio.
 */
export function roundHalf(n) {
  return Math.round(n * 2) / 2
}

/**
 * Los músculos de un ejercicio, con la precedencia de siempre.
 *
 * El grupo lo manda quien más sabe del caso concreto: la clasificación propia
 * del usuario (tabla `exercises`) por encima de la biblioteca. Los secundarios
 * solo pueden venir de la biblioteca — la tabla por usuario no tiene esa
 * columna—, así que un ejercicio inventado por el usuario aporta únicamente su
 * músculo principal, igual que antes de este cambio.
 *
 * @param {{muscle_group?: string}|null} ownRow  fila de `exercises`
 * @param {{muscle_group?: string, secondary_muscles?: string[]}|null} libRow
 */
export function resolveMuscles(ownRow, libRow) {
  const group = ownRow?.muscle_group || libRow?.muscle_group || CATCH_ALL
  return { group, secondaries: libRow?.secondary_muscles || [] }
}

/**
 * Índice de la biblioteca para resolver un ejercicio del usuario.
 *
 * Por id y por nombre a la vez: `library_id` es la unión fiable, pero una fila
 * enlazada puede seguir guardada con el nombre que el usuario tecleó, así que
 * el nombre es el respaldo (mismo razonamiento que useExerciseGroups).
 */
export function indexLibrary(library) {
  const byId = {}
  const byName = {}
  for (const row of library || []) {
    if (row?.id) byId[row.id] = row
    if (row?.name) byName[row.name] = row
  }
  return {
    lookup: (ownRow) =>
      (ownRow?.library_id && byId[ownRow.library_id]) ||
      (ownRow?.name && byName[ownRow.name]) ||
      null,
  }
}
