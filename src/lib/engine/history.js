// Análisis puro del historial de entrenos para personalizar la generación:
// familiaridad por ejercicio, mejor 1RM y volumen semanal por grupo.
// No toca React ni Supabase: recibe las filas ya cargadas.

import { VOLUME_TARGETS } from './volume'

// Fórmula de Epley — misma que calc1RM en hooks/useWorkout.js, duplicada aquí
// para que el motor siga siendo puro (sin React ni cliente Supabase).
const calc1RM = (weight, reps) => {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

const WINDOW_DAYS = 28

/**
 * @param {Array} workouts - filas de `workouts` con workout_exercises(unit,
 *   exercises(name, muscle_group), sets(weight, reps)), terminados, más
 *   recientes primero (misma forma que usa useStats).
 * @param {{level?: string}} opts - nivel para el umbral MEV de grupos rezagados
 * @returns {import('./types').HistoryAnalysis}
 */
export function analyzeHistory(workouts, { level = 'Intermedio' } = {}) {
  const familiarity = {}
  const best1RM = {}
  const recentSetsByGroup = {}

  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000

  for (const w of workouts || []) {
    const isRecent = w.started_at && new Date(w.started_at).getTime() >= cutoff
    for (const we of w.workout_exercises || []) {
      const name = we.exercises?.name
      if (!name) continue
      const group = we.exercises?.muscle_group
      const sets = we.sets || []
      if (sets.length === 0) continue

      familiarity[name] = (familiarity[name] || 0) + 1

      for (const s of sets) {
        if (s.weight > 0 && s.reps > 0) {
          const est = calc1RM(s.weight, s.reps)
          if (!best1RM[name] || est > best1RM[name].value) {
            best1RM[name] = { value: est, unit: we.unit || 'kg' }
          }
        }
      }

      if (isRecent && group) {
        recentSetsByGroup[group] = (recentSetsByGroup[group] || 0) + sets.length
      }
    }
  }

  const weeklyVolumeByGroup = {}
  for (const [group, total] of Object.entries(recentSetsByGroup)) {
    weeklyVolumeByGroup[group] = Math.round((total / (WINDOW_DAYS / 7)) * 10) / 10
  }

  // Grupos por debajo de su MEV en las últimas 4 semanas, peor primero.
  // Solo tiene sentido si hay actividad reciente; sin datos no sugerimos nada.
  let undertrainedGroups = []
  const hasRecent = Object.keys(weeklyVolumeByGroup).length > 0
  if (hasRecent) {
    undertrainedGroups = Object.keys(VOLUME_TARGETS)
      .map(group => {
        const [mev] = VOLUME_TARGETS[group][level] ?? [6]
        const weekly = weeklyVolumeByGroup[group] || 0
        return { group, deficit: mev - weekly }
      })
      .filter(x => x.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 3)
      .map(x => x.group)
  }

  return { familiarity, best1RM, weeklyVolumeByGroup, undertrainedGroups }
}

/**
 * Mejor 1RM aplicable a un ejercicio: coincidencia exacta por nombre o, si no,
 * el mejor 1RM dentro de su substitution_group descontado un 10 % (estimación).
 * @returns {{value: number, unit: string, isEstimate: boolean}|null}
 */
export function findBest1RM(exercise, history, libraryByName) {
  if (!history) return null
  const exact = history.best1RM[exercise.name]
  if (exact) return { ...exact, isEstimate: false }

  let best = null
  for (const [name, entry] of Object.entries(history.best1RM)) {
    const sibling = libraryByName[name]
    if (sibling && sibling.substitution_group === exercise.substitution_group) {
      if (!best || entry.value > best.value) best = entry
    }
  }
  if (best) return { value: best.value * 0.9, unit: best.unit, isEstimate: true }
  return null
}
