// Textos en español que hacen visible el "proceso de pensamiento" del plan.
// Se muestran en el preview del wizard y se guardan en description/notes.

import { GOAL_PARAMS } from './volume'

const ROLE_LABEL = {
  primary:   'Compuesto principal',
  secondary: 'Compuesto secundario',
  accessory: 'Accesorio',
  isolation: 'Aislamiento',
  core:      'Core',
}

const GOAL_TEXT = {
  Fuerza: 'series pesadas de 3-5 repeticiones con descansos largos para maximizar la fuerza',
  Hipertrofia: 'series de 8-12 repeticiones cerca del fallo para maximizar el crecimiento muscular',
}

export function formatRest(seconds) {
  if (seconds >= 60) {
    const min = seconds / 60
    return Number.isInteger(min) ? `${min} min` : `${min.toFixed(1).replace('.', ',')} min`
  }
  return `${seconds} s`
}

/** Nota por ejercicio: rol + dosis + peso de arranque + técnica. */
export function exerciseNote(ex) {
  const parts = [ROLE_LABEL[ex.role] || 'Ejercicio']
  const reps = ex.repsUnit === 'seg' ? `${ex.repsMin}-${ex.repsMax} seg` : `${ex.repsMin}-${ex.repsMax}`
  parts.push(`${ex.sets}×${reps} @RIR ${ex.rir}`)
  parts.push(`descanso ${formatRest(ex.restSeconds)}`)
  if (ex.suggestedWeight != null) {
    parts.push(`arranca ~${ex.suggestedWeight} ${ex.unit}${ex.weightIsEstimate ? ' (estimado)' : ''}`)
  }
  const head = parts.join(' · ')
  return ex.coachingNote ? `${head}. ${ex.coachingNote}` : head
}

/** Racional del día: plantilla + qué ejercicio lleva la base hoy. */
export function dayRationale(templateRationale, exercises) {
  const primary = exercises.find(e => e.role === 'primary')
  if (!primary) return templateRationale
  return `${templateRationale} La base de hoy: ${primary.name}.`
}

/** Párrafo-resumen del plan completo (el porqué de la estructura). */
export function planSummary(input, plan) {
  const { goal, level, priorityGroups = [], useHistory, history, sessionMinutes, mode } = input
  const p = []

  if (mode === 'single_day') {
    p.push(`Sesión de ${plan.days[0]?.dayName ?? 'entrenamiento'} de ~${sessionMinutes} min para nivel ${level.toLowerCase()}.`)
  } else {
    p.push(`Split ${plan.splitName} pensado para ${plan.days.length} días de ~${sessionMinutes} min a nivel ${level.toLowerCase()}.`)
    if (plan.days.length >= 4) {
      p.push('Los días que se repiten en la semana usan variantes A/B: cambia el patrón que lleva la carga pesada para cubrir cada músculo desde dos ángulos.')
    }
  }

  p.push(`Objetivo ${goal}: ${GOAL_TEXT[goal] ?? GOAL_TEXT.Hipertrofia}.`)

  if (priorityGroups.length > 0) {
    p.push(`Prioridad en ${priorityGroups.join(' y ')}: reciben más series semanales y mejor posición en la sesión.`)
  }

  if (useHistory && history) {
    const familiarCount = plan.days.reduce((n, d) => n + d.exercises.filter(e => e.isFamiliar).length, 0)
    if (familiarCount > 0) {
      p.push(`Se priorizaron ${familiarCount} ejercicios que ya dominas y los pesos de arranque salen de tus marcas registradas.`)
    }
  }

  const params = GOAL_PARAMS[goal]
  if (params) {
    p.push(`Cargas objetivo alrededor del ${params.intensityMin}-${params.intensityMax}% de tu 1RM.`)
  }

  return p.join(' ')
}
