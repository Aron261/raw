// Motor de generación: llena las plantillas curadas (templates.js) con
// ejercicios reales de exercises_library, dosifica series/reps/descansos y
// produce un Plan (types.js). Determinista: mismo input + seed ⇒ mismo plan.

import { mulberry32, hashInputs } from './prng'
import {
  SETS_PER_DAY, GOAL_PARAMS, REST_SECONDS, RIR_TARGET,
  roundToNearest2_5,
} from './volume'
import { getSplitDays, getSingleDayTemplate, applySexBias } from './templates'
import { findBest1RM } from './history'
import { attributeSplit, totalOf, roundHalf } from '../volumeAttribution'
import { planSummary, dayRationale, exerciseNote } from './rationale'

const LEVEL_RANK = { Principiante: 0, Intermedio: 1, Avanzado: 2 }
const ROLE_WEIGHT = { primary: 3, secondary: 2, accessory: 1.5, isolation: 1, core: 0.5 }
const ROLE_SET_CAP = { primary: 5, secondary: 4, accessory: 4, isolation: 3, core: 3 }
const MIN_SETS_PER_SLOT = 2

// ── Selección de ejercicio para un slot ─────────────────────────────────────

// Escalera de relajación: antes de recetar equipo que el usuario no tiene,
// intenta variantes más exigentes y patrones alternativos del mismo grupo.
//   0: estricto (patrón + nivel + equipo)
//   1: permite +1 nivel de dificultad
//   2: cualquier patrón del grupo (nivel +1, equipo respetado)
//   3: ignora equipo (patrón del slot, nivel +1)
//   4: cualquier ejercicio del grupo
const RELAX_NOTES = {
  1: (slot) => `Para ${slot.group} se eligió una variante más exigente: no había opción de tu nivel con ese patrón.`,
  2: (slot) => `Para ${slot.group} se usó un patrón alternativo compatible con tu equipo.`,
  3: (slot) => `Sin equipo ideal para ${slot.patterns[0]} (${slot.group}): revisa si puedes hacer el ejercicio propuesto o cámbialo.`,
  4: (slot) => `Cobertura mínima para ${slot.group}: cambia el ejercicio si no encaja.`,
}

function filterPool(library, slot, { level, equipment }, stage = 0, dayUsedNames = new Set()) {
  const maxRank = stage === 0 ? LEVEL_RANK[level] : stage <= 3 ? LEVEL_RANK[level] + 1 : 2
  const checkPattern = stage !== 2 && stage !== 4
  const checkEquipment = stage <= 2
  return library.filter(ex => {
    if (ex.is_active === false) return false
    if (dayUsedNames.has(ex.name)) return false
    if (ex.muscle_group !== slot.group) return false
    if (checkPattern && !slot.patterns.includes(ex.movement_pattern)) return false
    if (LEVEL_RANK[ex.difficulty] > maxRank) return false
    if (checkEquipment && Array.isArray(equipment)) {
      if (!ex.equipment.every(tok => equipment.includes(tok))) return false
    }
    return true
  })
}

function scoreCandidate(ex, slot, ctx) {
  const { level, useHistory, history, dayUsedNames, dayUsedSubs, weekSubCount, weekNameCount, rng } = ctx
  let score = 0

  // Si hubo que subir de nivel, preferir el escalón más cercano al usuario
  score -= 2.5 * Math.max(0, LEVEL_RANK[ex.difficulty] - LEVEL_RANK[level])

  // Ajuste rol ↔ tipo de ejercicio
  if (slot.role === 'primary' || slot.role === 'secondary') {
    score += ex.is_compound ? 2 : -2
    // Los pesados de la sesión deben permitir carga progresiva: barra/máquina
    // antes que variantes de peso corporal.
    if (ex.tracking_type !== 'weight_reps') score -= 1.5
  } else if (slot.role === 'isolation' || slot.role === 'core') {
    score += ex.is_compound ? -1 : 1
  } else {
    score += ex.is_compound ? 0.5 : 0
  }

  // Familiaridad: preferir lo que el usuario ya entrena
  if (useHistory && history?.familiarity?.[ex.name]) {
    score += Math.min(1.5, history.familiarity[ex.name] * 0.3)
  }

  // Anti-repetición: nunca dos veces el mismo nombre en el día; variar
  // familias dentro del día y a lo largo de la semana.
  if (dayUsedNames.has(ex.name)) score -= 100
  if (dayUsedSubs.has(ex.substitution_group)) score -= 6
  score -= (weekSubCount.get(ex.substitution_group) || 0) * 1.5
  score -= (weekNameCount.get(ex.name) || 0) * 3

  // Jitter con semilla: variedad entre regeneraciones, nunca aleatorio puro
  score += rng() * 1.75

  return score
}

function pickExercise(library, slot, input, ctx, notes) {
  for (let stage = 0; stage <= 4; stage++) {
    const pool = filterPool(library, slot, input, stage, ctx.dayUsedNames)
    if (pool.length === 0) continue
    if (stage > 0) notes.push(RELAX_NOTES[stage](slot))

    const scored = pool
      .map(ex => ({ ex, score: scoreCandidate(ex, slot, ctx) }))
      .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    return { ex: scored[0].ex, stage }
  }
  return null
}

// ── Dosis: series por slot dentro del presupuesto del día ───────────────────

function planSlotSets(slots, budget, priorityGroups) {
  // 1. Recorta slots hasta que quepan con el mínimo de series cada uno.
  //    Los opcionales caen primero (desde el final); nunca cae el primary.
  const kept = [...slots]
  const droppable = () => {
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].optional) return i
    }
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].role !== 'primary') return i
    }
    return -1
  }
  // Primero: sin opcionales si no caben todos
  while (kept.length * MIN_SETS_PER_SLOT > budget) {
    const i = droppable()
    if (i < 0) break
    kept.splice(i, 1)
  }

  // 2. Mínimo por slot, luego reparte el resto por peso de rol + prioridad.
  const sets = kept.map(() => MIN_SETS_PER_SLOT)
  let leftover = budget - MIN_SETS_PER_SLOT * kept.length

  const order = kept
    .map((slot, i) => ({ i, w: ROLE_WEIGHT[slot.role] + (priorityGroups.includes(slot.group) ? 1.25 : 0) }))
    .sort((a, b) => b.w - a.w)

  let guard = 0
  while (leftover > 0 && guard < 100) {
    let assigned = false
    for (const { i } of order) {
      if (leftover === 0) break
      const cap = ROLE_SET_CAP[kept[i].role] + (priorityGroups.includes(kept[i].group) ? 1 : 0)
      if (sets[i] < cap) {
        sets[i]++
        leftover--
        assigned = true
      }
    }
    if (!assigned) break
    guard++
  }

  return kept.map((slot, i) => ({ slot, sets: sets[i] }))
}

// ── Reps por ejercicio: objetivo ∩ rango propio del ejercicio ────────────────

function resolveReps(ex, role, goal) {
  if (ex.tracking_type === 'time') {
    return { repsMin: ex.best_rep_min, repsMax: ex.best_rep_max, repsUnit: 'seg' }
  }
  if (ex.tracking_type === 'reps') {
    return { repsMin: ex.best_rep_min, repsMax: ex.best_rep_max, repsUnit: 'reps' }
  }

  const goalP = GOAL_PARAMS[goal] ?? GOAL_PARAMS.Hipertrofia
  let min = Math.max(goalP.repsMin, ex.best_rep_min)
  let max = Math.min(goalP.repsMax, ex.best_rep_max)

  if (min > max) {
    // Sin intersección (ej. laterales en Fuerza): manda el rango del ejercicio,
    // sesgado a su mitad baja si el objetivo es Fuerza.
    if (goal === 'Fuerza') {
      min = ex.best_rep_min
      max = Math.ceil((ex.best_rep_min + ex.best_rep_max) / 2)
    } else {
      min = ex.best_rep_min
      max = ex.best_rep_max
    }
  }

  // Los aislamientos nunca bajan de 8 reps, ni siquiera en Fuerza
  if ((role === 'isolation' || role === 'core') && min < 8) {
    min = 8
    if (max < min) max = ex.best_rep_max
  }

  return { repsMin: min, repsMax: max, repsUnit: 'reps' }
}

// ── Construcción de un PlanExercise (compartido por generador y swaps) ──────

function buildPlanExercise(ex, { role, sets, goal, level, history, libraryByName }) {
  const goalP = GOAL_PARAMS[goal] ?? GOAL_PARAMS.Hipertrofia
  const rir = RIR_TARGET[level]?.[goal] ?? '1-2'
  const reps = resolveReps(ex, role, goal)

  let suggestedWeight = null
  let unit = null
  let weightIsEstimate = false
  if (ex.tracking_type === 'weight_reps' && history) {
    const best = findBest1RM(ex, history, libraryByName)
    if (best) {
      suggestedWeight = roundToNearest2_5(best.value * (goalP.intensityMin / 100))
      unit = best.unit
      weightIsEstimate = best.isEstimate
    }
  }

  const planEx = {
    libraryId: ex.id,
    name: ex.name,
    muscleGroup: ex.muscle_group,
    pattern: ex.movement_pattern,
    role,
    sets,
    ...reps,
    rir,
    restSeconds: REST_SECONDS[role]?.[goal] ?? 90,
    suggestedWeight,
    unit,
    weightIsEstimate,
    isFamiliar: Boolean(history?.familiarity?.[ex.name]),
    coachingNote: ex.coaching_notes || '',
  }
  planEx.note = exerciseNote(planEx)
  return planEx
}

// ── Alternativas para cambiar un ejercicio del preview ──────────────────────

/**
 * Ejercicios similares al dado, mejores primero: misma familia de sustitución,
 * luego mismo patrón + grupo, luego mismo grupo. Respeta equipo y nivel y
 * excluye los nombres ya usados en el día.
 * @returns {import('./types').LibraryExercise[]}
 */
export function getSwapAlternatives(planEx, { library, level, equipment, excludeNames = [], limit = 6 }) {
  const current = library.find(e => e.name === planEx.name)
  if (!current) return []
  const excluded = new Set([...excludeNames, planEx.name])

  // Solo alternativas del MISMO grupo muscular: hay familias de sustitución
  // que cruzan grupos (ej. press_cerrado: Pecho y Tríceps) y cambiar de grupo
  // rompería el balance del día.
  const usable = library.filter(ex =>
    ex.is_active !== false &&
    !excluded.has(ex.name) &&
    ex.muscle_group === current.muscle_group &&
    LEVEL_RANK[ex.difficulty] <= LEVEL_RANK[level] + 1 &&
    (!Array.isArray(equipment) || ex.equipment.every(tok => equipment.includes(tok)))
  )

  const tier = (ex) => {
    if (ex.substitution_group === current.substitution_group) return 0
    if (ex.movement_pattern === current.movement_pattern && ex.muscle_group === current.muscle_group) return 1
    if (ex.muscle_group === current.muscle_group) return 2
    return 3
  }

  return usable
    .map(ex => ({ ex, t: tier(ex) }))
    .filter(x => x.t < 3)
    .sort((a, b) => a.t - b.t || a.ex.name.localeCompare(b.ex.name))
    .slice(0, limit)
    .map(x => x.ex)
}

/**
 * Reemplaza un ejercicio del plan por otro de la librería, re-dosificando
 * reps/RIR/descanso/peso para el nuevo ejercicio (mismas series y rol).
 * Devuelve un plan nuevo; no muta el original.
 */
export function swapExercise(plan, dayIndex, exIndex, newLibraryEx, { goal, level, history = null, library = [] }) {
  const libraryByName = {}
  for (const ex of library) libraryByName[ex.name] = ex

  const target = plan.days[dayIndex]?.exercises[exIndex]
  if (!target) return plan

  const replacement = buildPlanExercise(newLibraryEx, {
    role: target.role, sets: target.sets, goal, level, history, libraryByName,
  })

  const days = plan.days.map((day, di) => {
    if (di !== dayIndex) return day
    const exercises = day.exercises.map((ex, ei) => (ei === exIndex ? replacement : ex))
    const groups = [...new Set(exercises.map(e => e.muscleGroup))]
    return { ...day, exercises, focus: groups.join(', ') }
  })

  return { ...plan, days, edited: true }
}

// ── Generador principal ──────────────────────────────────────────────────────

/**
 * @param {import('./types').GenerationInput} input
 * @returns {import('./types').Plan}
 */
export function generatePlan(input) {
  const {
    mode = 'cycle', goal = 'Hipertrofia', level = 'Intermedio',
    daysPerWeek = 4, sessionMinutes = 60, sex = null, splitChoice = null,
    priorityGroups = [], equipment = 'full', useHistory = false,
    focus = 'Full Body', library = [], history = null,
  } = input

  const seed = input.seed ?? hashInputs(input)
  const rng = mulberry32(seed)
  const notes = []

  const libraryByName = {}
  for (const ex of library) libraryByName[ex.name] = ex

  let splitName, templates
  if (mode === 'single_day') {
    splitName = focus
    templates = [getSingleDayTemplate(focus)]
  } else {
    const split = getSplitDays(daysPerWeek, splitChoice)
    splitName = split.splitName
    templates = applySexBias(split.days, sex)
  }

  const budget = SETS_PER_DAY[sessionMinutes]?.[level] ?? SETS_PER_DAY[60].Intermedio
  const effectiveHistory = useHistory ? history : null

  const weekSubCount = new Map()
  const weekNameCount = new Map()
  const volumeSplit = {}

  const days = templates.map(template => {
    const dayUsedNames = new Set()
    const dayUsedSubs = new Set()
    const ctx = { level, useHistory, history: effectiveHistory, dayUsedNames, dayUsedSubs, weekSubCount, weekNameCount, rng }

    const allocations = planSlotSets(template.slots, budget, priorityGroups)
    const exercises = []

    for (const { slot, sets } of allocations) {
      const slotNotes = []
      const picked = pickExercise(library, slot, { level, equipment }, ctx, slotNotes)
      // Un slot opcional nunca receta equipo que el usuario no tiene: se omite.
      if (!picked || (slot.optional && picked.stage >= 3)) {
        if (!picked && !slot.optional) notes.push(`No hay ejercicio disponible para ${slot.patterns.join('/')} (${slot.group}) con tu equipo; slot omitido.`)
        continue
      }
      notes.push(...slotNotes)
      const ex = picked.ex

      dayUsedNames.add(ex.name)
      dayUsedSubs.add(ex.substitution_group)
      weekSubCount.set(ex.substitution_group, (weekSubCount.get(ex.substitution_group) || 0) + 1)
      weekNameCount.set(ex.name, (weekNameCount.get(ex.name) || 0) + 1)
      // Volumen semanal. El crédito directo va al grupo del *slot*, no al del
      // ejercicio: si una sustitución trajo otra cosa, el hueco de la plantilla
      // sigue siendo el que se quería cubrir.
      attributeSplit(sets, { group: slot.group, secondaries: ex.secondary_muscles }, volumeSplit)

      exercises.push(buildPlanExercise(ex, {
        role: slot.role, sets, goal, level, history: effectiveHistory, libraryByName,
      }))
    }

    const estMinutes = Math.round(
      exercises.reduce((min, e) => min + e.sets * ((e.restSeconds + 45) / 60), 0) + 5
    )

    const groups = [...new Set(exercises.map(e => e.muscleGroup))]
    return {
      dayName: template.dayName,
      focus: groups.join(', '),
      rationale: dayRationale(template.rationale, exercises),
      estMinutes,
      exercises,
    }
  })

  // A media serie, no a serie entera: redondear a entero escondería el aporte
  // de un secundario que solo aparece en un ejercicio, y descuadraría este
  // preview con la tarjeta «Series por semana» del ciclo ya guardado.
  const weeklyVolume = {}
  const weeklyVolumeSplit = {}
  for (const [g, entry] of Object.entries(volumeSplit)) {
    weeklyVolume[g] = roundHalf(totalOf(entry))
    weeklyVolumeSplit[g] = { direct: roundHalf(entry.direct), indirect: roundHalf(entry.indirect) }
  }

  const plan = {
    seed,
    splitName,
    title: mode === 'single_day'
      ? `${focus} — ${goal} (${sessionMinutes} min)`
      : `${splitName} — ${goal} ${daysPerWeek}d`,
    summary: '',
    weeklyVolume,
    weeklyVolumeSplit,
    notes: [...new Set(notes)],
    days,
  }
  plan.summary = planSummary({ ...input, goal, level, sessionMinutes, priorityGroups, useHistory, history: effectiveHistory, mode }, plan)

  return plan
}
