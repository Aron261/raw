// Dosis de entrenamiento: series por sesión, objetivos de volumen semanal,
// parámetros por objetivo, descansos y RIR. Portado de cycleGenerator.js y
// reescrito para los 10 grupos canónicos de muscleGroups.js.

/** Objetivos disponibles (decisión de producto: solo estos dos). */
export const GOALS = ['Fuerza', 'Hipertrofia']

export const LEVELS = ['Principiante', 'Intermedio', 'Avanzado']

export const TIME_OPTIONS = [45, 60, 90]

/** Series efectivas por sesión según duración y nivel. */
export const SETS_PER_DAY = {
  45: { Principiante: 8,  Intermedio: 10, Avanzado: 12 },
  60: { Principiante: 12, Intermedio: 13, Avanzado: 16 },
  90: { Principiante: 14, Intermedio: 16, Avanzado: 20 },
}

/** Rango de reps e intensidad (%1RM) por objetivo. */
export const GOAL_PARAMS = {
  'Fuerza':      { repsMin: 3, repsMax: 5,  intensityMin: 85, intensityMax: 90 },
  'Hipertrofia': { repsMin: 8, repsMax: 12, intensityMin: 65, intensityMax: 75 },
}

/**
 * Volumen semanal objetivo [MEV, MAV] por grupo y nivel.
 * MEV = volumen mínimo efectivo, MAV = volumen máximo adaptativo.
 */
export const VOLUME_TARGETS = {
  'Pecho':      { Principiante: [10, 12], Intermedio: [12, 16], Avanzado: [16, 20] },
  'Espalda':    { Principiante: [10, 12], Intermedio: [14, 18], Avanzado: [16, 22] },
  'Hombro':     { Principiante: [8, 10],  Intermedio: [12, 16], Avanzado: [16, 20] },
  'Cuádriceps': { Principiante: [8, 10],  Intermedio: [12, 16], Avanzado: [14, 18] },
  'Hamstrings': { Principiante: [6, 8],   Intermedio: [8, 12],  Avanzado: [10, 14] },
  'Glúteo':     { Principiante: [6, 8],   Intermedio: [8, 12],  Avanzado: [10, 14] },
  'Gemelos':    { Principiante: [4, 6],   Intermedio: [6, 8],   Avanzado: [8, 12] },
  'Bíceps':     { Principiante: [6, 8],   Intermedio: [10, 14], Avanzado: [14, 18] },
  'Tríceps':    { Principiante: [6, 8],   Intermedio: [10, 14], Avanzado: [14, 18] },
  'Core':       { Principiante: [6, 8],   Intermedio: [8, 12],  Avanzado: [10, 16] },
}

/** Descanso (segundos) por rol de ejercicio y objetivo. */
export const REST_SECONDS = {
  primary:   { Fuerza: 180, Hipertrofia: 120 },
  secondary: { Fuerza: 150, Hipertrofia: 90 },
  accessory: { Fuerza: 90,  Hipertrofia: 75 },
  isolation: { Fuerza: 75,  Hipertrofia: 60 },
  core:      { Fuerza: 45,  Hipertrofia: 45 },
}

/** RIR objetivo (reps en reserva) por nivel y objetivo, como texto. */
export const RIR_TARGET = {
  Principiante: { Fuerza: '3',   Hipertrofia: '2-3' },
  Intermedio:   { Fuerza: '2-3', Hipertrofia: '1-2' },
  Avanzado:     { Fuerza: '2',   Hipertrofia: '0-2' },
}

/**
 * Reparte `totalSets` entre grupos musculares proporcionalmente a su peso
 * MEV/MAV (los priorizados pesan MAV), garantizando ≥1 serie por grupo.
 * Portado de cycleGenerator.distributeSetsAcrossGroups.
 */
export function distributeSetsAcrossGroups(muscleGroups, totalSets, level, prioritizedGroups = []) {
  if (muscleGroups.length === 0) return {}

  const weights = {}
  let totalWeight = 0
  for (const group of muscleGroups) {
    const [mev, mav] = VOLUME_TARGETS[group]?.[level] ?? [6, 10]
    const w = prioritizedGroups.includes(group) ? mav : mev
    weights[group] = w
    totalWeight += w
  }

  const allocations = {}
  let allocated = 0
  for (const group of muscleGroups) {
    const raw = (weights[group] / totalWeight) * totalSets
    allocations[group] = Math.max(1, Math.floor(raw))
    allocated += allocations[group]
  }

  const fractionals = muscleGroups
    .map(g => {
      const raw = (weights[g] / totalWeight) * totalSets
      return { group: g, frac: raw - Math.floor(raw) }
    })
    .sort((a, b) => b.frac - a.frac)

  let remainder = totalSets - allocated
  for (let i = 0; i < remainder; i++) {
    allocations[fractionals[i % fractionals.length].group]++
  }

  return allocations
}

export function roundToNearest2_5(value) {
  return Math.round(value / 2.5) * 2.5
}
