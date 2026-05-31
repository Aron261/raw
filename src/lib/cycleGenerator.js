/**
 * cycleGenerator.js
 * Pure JavaScript module — no React, no Supabase.
 * Generates a complete training rutina plan for the RAW app.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** @type {string[]} Available training goals */
export const GOALS = ['Hipertrofia', 'Fuerza', 'Fuerza-Hipertrofia', 'Recomposición']

/** @type {string[]} Available training levels */
export const LEVELS = ['Principiante', 'Intermedio', 'Avanzado']

/** @type {number[]} Available session durations in minutes */
export const TIME_OPTIONS = [45, 60, 90]

/**
 * Maximum working sets per training day, indexed by session duration and level.
 * @type {Object.<number, Object.<string, number>>}
 */
export const SETS_PER_DAY = {
  45: { Principiante: 8,  Intermedio: 10, Avanzado: 12 },
  60: { Principiante: 12, Intermedio: 13, Avanzado: 16 },
  90: { Principiante: 14, Intermedio: 16, Avanzado: 20 },
}

/**
 * Weekly volume targets per muscle group and level.
 * Each value is [MEV (Minimum Effective Volume), MAV (Maximum Adaptive Volume)].
 * @type {Object.<string, Object.<string, [number, number]>>}
 */
export const VOLUME_TARGETS = {
  'Pecho':           { Principiante: [10,12], Intermedio: [12,16], Avanzado: [16,20] },
  'Espalda':         { Principiante: [10,12], Intermedio: [14,18], Avanzado: [16,22] },
  'Hombro':          { Principiante: [8,10],  Intermedio: [12,16], Avanzado: [16,20] },
  'Cuádriceps':      { Principiante: [10,12], Intermedio: [14,18], Avanzado: [16,22] },
  'Isquios/Glúteo':  { Principiante: [8,10],  Intermedio: [10,14], Avanzado: [14,18] },
  'Bíceps':          { Principiante: [6,8],   Intermedio: [10,14], Avanzado: [14,18] },
  'Tríceps':         { Principiante: [6,8],   Intermedio: [10,14], Avanzado: [14,18] },
  'Core':            { Principiante: [6,8],   Intermedio: [8,12],  Avanzado: [10,16] },
}

/**
 * Rep ranges and intensity percentages by goal.
 * @type {Object.<string, {repsMin: number, repsMax: number, intensityMin: number, intensityMax: number}>}
 */
export const GOAL_PARAMS = {
  'Fuerza':             { repsMin: 3,  repsMax: 5,  intensityMin: 85, intensityMax: 90 },
  'Fuerza-Hipertrofia': { repsMin: 5,  repsMax: 8,  intensityMin: 75, intensityMax: 85 },
  'Hipertrofia':        { repsMin: 8,  repsMax: 12, intensityMin: 65, intensityMax: 75 },
  'Recomposición':      { repsMin: 8,  repsMax: 15, intensityMin: 60, intensityMax: 75 },
}

/**
 * Exercise pool per muscle group.
 * Compound movements listed first; accessories follow.
 * @type {Object.<string, string[]>}
 */
export const EXERCISES_BY_MUSCLE = {
  'Pecho':          ['Bench Press', 'Incline Dumbbell Press', 'Dips', 'Cable Fly', 'Decline Bench Press'],
  'Espalda':        ['Pull Up', 'Barbell Row', 'Lat Pulldown', 'Cable Row', 'T-Bar Row', 'Face Pull'],
  'Hombro':         ['Overhead Press', 'Lateral Raise', 'Face Pull', 'Rear Delt Fly', 'Arnold Press'],
  'Cuádriceps':     ['Squat', 'Leg Press', 'Bulgarian Split Squat', 'Lunges', 'Leg Extension'],
  'Isquios/Glúteo': ['Romanian Deadlift', 'Deadlift', 'Hip Thrust', 'Leg Curl', 'Cable Kickback'],
  'Bíceps':         ['Barbell Curl', 'Incline DB Curl', 'Hammer Curl', 'Cable Curl', 'Preacher Curl'],
  'Tríceps':        ['Close Grip Bench Press', 'Tricep Pushdown', 'Overhead Tricep Extension', 'Skull Crusher'],
  'Core':           ['Plank', 'Cable Crunch', 'Leg Raise', 'Ab Rollout', 'Russian Twist'],
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * All muscle groups supported by the app.
 * @type {string[]}
 */
const ALL_MUSCLE_GROUPS = Object.keys(VOLUME_TARGETS)

/**
 * Muscle group composition of each named training day.
 * Used as building blocks for multi-day splits.
 * @type {Object.<string, string[]>}
 */
const DAY_TEMPLATES = {
  'Full Body': ALL_MUSCLE_GROUPS,
  'Upper':     ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps'],
  'Lower':     ['Cuádriceps', 'Isquios/Glúteo', 'Core'],
  'Push':      ['Pecho', 'Hombro', 'Tríceps'],
  'Pull':      ['Espalda', 'Bíceps'],
  'Legs':      ['Cuádriceps', 'Isquios/Glúteo', 'Core'],
}

/**
 * Rounds a number to the nearest multiple of 2.5.
 * Used for suggesting barbell/dumbbell weights.
 * @param {number} value
 * @returns {number}
 */
function roundToNearest2_5(value) {
  return Math.round(value / 2.5) * 2.5
}

/**
 * Distributes `totalSets` across an array of muscle groups proportionally,
 * ensuring each group receives at least 1 set.
 * @param {string[]} muscleGroups
 * @param {number}   totalSets
 * @param {string}   level
 * @param {string[]} prioritizedGroups - Groups that get full MEV→MAV allocation
 * @returns {Object.<string, number>} Map of muscleGroup → sets assigned
 */
function distributeSetsAcrossGroups(muscleGroups, totalSets, level, prioritizedGroups = []) {
  if (muscleGroups.length === 0) return {}

  // Base weight: midpoint of the [MEV, MAV] range for each group
  const weights = {}
  let totalWeight = 0

  for (const group of muscleGroups) {
    const [mev, mav] = VOLUME_TARGETS[group]?.[level] ?? [6, 10]
    // Prioritized groups get full MAV weight, others get MEV
    const isPrioritized = prioritizedGroups.includes(group)
    const w = isPrioritized ? mav : mev
    weights[group] = w
    totalWeight += w
  }

  // Proportional allocation — floor first, then distribute remainder
  const rawAllocations = {}
  let allocated = 0

  for (const group of muscleGroups) {
    const raw = (weights[group] / totalWeight) * totalSets
    rawAllocations[group] = Math.max(1, Math.floor(raw))
    allocated += rawAllocations[group]
  }

  // Distribute remaining sets to groups with highest fractional part
  let remainder = totalSets - allocated
  const fractionals = muscleGroups
    .map(g => ({
      group: g,
      frac: (weights[g] / totalWeight) * totalSets - Math.floor((weights[g] / totalWeight) * totalSets),
    }))
    .sort((a, b) => b.frac - a.frac)

  for (let i = 0; i < remainder; i++) {
    rawAllocations[fractionals[i % fractionals.length].group]++
  }

  return rawAllocations
}

/**
 * Selects up to `maxExercises` exercises for a muscle group, compound first.
 * @param {string} muscleGroup
 * @param {number} maxExercises
 * @returns {string[]}
 */
function pickExercises(muscleGroup, maxExercises = 3) {
  const pool = EXERCISES_BY_MUSCLE[muscleGroup] ?? []
  return pool.slice(0, maxExercises)
}

/**
 * Distributes `totalSets` across exercises.
 * The first (compound) exercise gets ~60 %, accessories share the rest equally.
 * @param {string[]} exercises
 * @param {number}   totalSets
 * @returns {Object.<string, number>} exercise name → sets
 */
function distributeSetsAcrossExercises(exercises, totalSets) {
  if (exercises.length === 0) return {}
  if (exercises.length === 1) return { [exercises[0]]: totalSets }

  const compoundSets = Math.max(1, Math.round(totalSets * 0.6))
  const remainingSets = totalSets - compoundSets
  const accessoryCount = exercises.length - 1
  const setsPerAccessory = Math.max(1, Math.floor(remainingSets / accessoryCount))

  const result = {}
  result[exercises[0]] = compoundSets

  for (let i = 1; i < exercises.length; i++) {
    result[exercises[i]] = setsPerAccessory
  }

  // Add leftover sets from floor division to the first accessory
  const distributed = compoundSets + setsPerAccessory * accessoryCount
  if (distributed < totalSets && exercises.length > 1) {
    result[exercises[1]] += totalSets - distributed
  }

  return result
}

// =============================================================================
// SPLIT DEFINITIONS
// =============================================================================

/**
 * Returns an ordered array of training day definitions based on days per week
 * and an optional split variant for 5-day programs.
 *
 * For 2-3 days → Full Body (all muscle groups every session).
 * For 4 days   → Upper / Lower alternating.
 * For 5 days   → PPL+UL ('ppl_ul') or PPL×2 with extra Pull ('ppl_pure').
 * For 6 days   → PPL × 2.
 *
 * When `prioritizedGroups` are supplied on Full Body, those groups are flagged
 * so the set-distribution step can give them full MEV→MAV volume.
 *
 * @param {number}   daysPerWeek       - Number of training days (2-6)
 * @param {string|null} splitChoice    - 'ppl_ul' | 'ppl_pure' (only relevant for 5 days)
 * @param {string[]} prioritizedGroups - Muscle groups to emphasise
 * @returns {{ dayName: string, muscleGroups: string[] }[]}
 */
export function getSplitDays(daysPerWeek, splitChoice = null, prioritizedGroups = []) {
  switch (daysPerWeek) {
    // ---- FULL BODY (2-3 days) ------------------------------------------------
    case 2:
    case 3: {
      const days = []
      for (let i = 0; i < daysPerWeek; i++) {
        days.push({ dayName: 'Full Body', muscleGroups: [...DAY_TEMPLATES['Full Body']] })
      }
      return days
    }

    // ---- UPPER / LOWER (4 days) ---------------------------------------------
    // Upper A: Pecho primary → más sets a Pecho que a Espalda
    // Upper B: Espalda primary → más sets a Espalda que a Pecho
    // Lower A: Cuádriceps primary
    // Lower B: Isquios/Glúteo primary
    case 4: {
      return [
        {
          dayName: 'Upper A',
          muscleGroups: ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps'],
          primaryGroups: ['Pecho', 'Hombro', 'Tríceps'],
        },
        {
          dayName: 'Lower A',
          muscleGroups: ['Cuádriceps', 'Isquios/Glúteo', 'Core'],
          primaryGroups: ['Cuádriceps'],
        },
        {
          dayName: 'Upper B',
          muscleGroups: ['Espalda', 'Pecho', 'Hombro', 'Bíceps', 'Tríceps'],
          primaryGroups: ['Espalda', 'Bíceps'],
        },
        {
          dayName: 'Lower B',
          muscleGroups: ['Isquios/Glúteo', 'Cuádriceps', 'Core'],
          primaryGroups: ['Isquios/Glúteo'],
        },
      ]
    }

    // ---- PPL VARIANTS (5 days) ----------------------------------------------
    case 5: {
      const variant = splitChoice ?? 'ppl_ul'

      if (variant === 'ppl_pure') {
        // Push / Pull / Legs / Push / Pull — user trains legs separately
        return [
          { dayName: 'Push',  muscleGroups: [...DAY_TEMPLATES['Push']] },
          { dayName: 'Pull',  muscleGroups: [...DAY_TEMPLATES['Pull']] },
          { dayName: 'Legs',  muscleGroups: [...DAY_TEMPLATES['Legs']] },
          { dayName: 'Push',  muscleGroups: [...DAY_TEMPLATES['Push']] },
          { dayName: 'Pull',  muscleGroups: [...DAY_TEMPLATES['Pull']] },
        ]
      }

      // Default: ppl_ul — Push / Pull / Legs / Upper / Lower
      return [
        { dayName: 'Push',  muscleGroups: [...DAY_TEMPLATES['Push']] },
        { dayName: 'Pull',  muscleGroups: [...DAY_TEMPLATES['Pull']] },
        { dayName: 'Legs',  muscleGroups: [...DAY_TEMPLATES['Legs']] },
        { dayName: 'Upper', muscleGroups: [...DAY_TEMPLATES['Upper']] },
        { dayName: 'Lower', muscleGroups: [...DAY_TEMPLATES['Lower']] },
      ]
    }

    // ---- PPL × 2 (6 days) ---------------------------------------------------
    case 6:
    default: {
      return [
        { dayName: 'Push',  muscleGroups: [...DAY_TEMPLATES['Push']] },
        { dayName: 'Pull',  muscleGroups: [...DAY_TEMPLATES['Pull']] },
        { dayName: 'Legs',  muscleGroups: [...DAY_TEMPLATES['Legs']] },
        { dayName: 'Push',  muscleGroups: [...DAY_TEMPLATES['Push']] },
        { dayName: 'Pull',  muscleGroups: [...DAY_TEMPLATES['Pull']] },
        { dayName: 'Legs',  muscleGroups: [...DAY_TEMPLATES['Legs']] },
      ]
    }
  }
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * @typedef {Object} ExercisePlan
 * @property {string}      exerciseName     - Name of the exercise
 * @property {number}      sets             - Number of working sets
 * @property {number}      repsMin          - Lower bound of rep range
 * @property {number}      repsMax          - Upper bound of rep range
 * @property {number}      intensityPercent - Target intensity (% of 1RM), midpoint of range
 * @property {number|null} suggestedWeight  - Calculated weight based on 1RM; null if no history
 * @property {string|null} unit             - 'kg' or 'lb'; null if no history
 * @property {boolean}     hasHistory       - True if exercise has a recorded 1RM
 */

/**
 * @typedef {Object} DayPlan
 * @property {number}         dayNumber    - 1-based day index within the week
 * @property {string}         dayName      - e.g. 'Push', 'Upper', 'Full Body'
 * @property {string[]}       muscleGroups - Muscle groups trained on this day
 * @property {ExercisePlan[]} exercises    - Ordered list of exercises for the day
 */

/**
 * @typedef {Object} GeneratorParams
 * @property {string}   goal             - One of GOALS
 * @property {string}   level            - One of LEVELS
 * @property {number}   daysPerWeek      - 2-6
 * @property {number}   dailyTimeMinutes - One of TIME_OPTIONS
 * @property {number}   durationWeeks    - 6-12
 * @property {string}   [splitChoice]    - 'ppl_ul' | 'ppl_pure' (for 5-day splits)
 * @property {string[]} [prioritizedGroups] - Muscle groups to emphasise this cycle
 */

/**
 * @typedef {Object} ExerciseHistoryEntry
 * @property {number} best1RM - Best one-rep max recorded
 * @property {'kg'|'lb'} unit - Unit used
 */

/**
 * Generates a complete weekly training plan for one cycle.
 *
 * Steps:
 * 1. Resolve the split structure via getSplitDays.
 * 2. For each day, determine the total available sets (SETS_PER_DAY).
 * 3. Distribute those sets across the day's muscle groups proportionally
 *    (prioritized groups receive full MAV weighting).
 * 4. For each muscle group, pick 2-3 exercises (compound first).
 * 5. Distribute that group's sets across its exercises (compound ~60 %).
 * 6. Apply GOAL_PARAMS for rep ranges and intensity.
 * 7. If the exercise exists in exerciseHistory, calculate suggestedWeight
 *    as best1RM × (intensityMin / 100), rounded to nearest 2.5.
 *
 * @param {GeneratorParams}                          params
 * @param {Object.<string, ExerciseHistoryEntry>}   [exerciseHistory={}]
 * @returns {DayPlan[]}
 */
export function generateCyclePlan(params, exerciseHistory = {}) {
  const {
    goal,
    level,
    daysPerWeek,
    dailyTimeMinutes,
    splitChoice = null,
    prioritizedGroups = [],
  } = params

  // 1. Get split days
  const splitDays = getSplitDays(daysPerWeek, splitChoice, prioritizedGroups)

  // Resolve goal parameters once
  const goalP = GOAL_PARAMS[goal] ?? GOAL_PARAMS['Hipertrofia']
  const intensityMid = Math.round((goalP.intensityMin + goalP.intensityMax) / 2)

  // 2. Build day plans
  const plan = splitDays.map((dayTemplate, index) => {
    const { dayName, muscleGroups, primaryGroups: dayPrimaryGroups = [] } = dayTemplate

    // Total sets available for this session
    const totalSetsAvailable = SETS_PER_DAY[dailyTimeMinutes]?.[level] ?? 12

    // Merge day-level primary groups with user's global prioritized groups
    const effectivePriority = [...new Set([...dayPrimaryGroups, ...prioritizedGroups])]

    // 3. Distribute sets across muscle groups
    const setsPerGroup = distributeSetsAcrossGroups(
      muscleGroups,
      totalSetsAvailable,
      level,
      effectivePriority
    )

    // 4-6. Build exercise list for each muscle group
    const exercises = []

    for (const muscleGroup of muscleGroups) {
      const groupSets = setsPerGroup[muscleGroup] ?? 2

      // Max 2 exercises per muscle group — fewer movements, more sets each
      const maxEx = groupSets >= 2 ? 2 : 1
      const selectedExercises = pickExercises(muscleGroup, maxEx)

      // 5. Distribute sets across exercises
      const setsMap = distributeSetsAcrossExercises(selectedExercises, groupSets)

      for (const exerciseName of selectedExercises) {
        const sets = setsMap[exerciseName] ?? 1

        // 7. Calculate suggested weight if history is available
        let suggestedWeight = null
        let unit = null
        let hasHistory = false

        const historyEntry = exerciseHistory[exerciseName]
        if (historyEntry && typeof historyEntry.best1RM === 'number') {
          hasHistory = true
          unit = historyEntry.unit ?? 'kg'
          const raw = historyEntry.best1RM * (goalP.intensityMin / 100)
          suggestedWeight = roundToNearest2_5(raw)
        }

        exercises.push({
          exerciseName,
          sets,
          repsMin: goalP.repsMin,
          repsMax: goalP.repsMax,
          intensityPercent: intensityMid,
          suggestedWeight,
          unit,
          hasHistory,
        })
      }
    }

    return {
      dayNumber: index + 1,
      dayName,
      muscleGroups: [...muscleGroups],
      exercises,
    }
  })

  return plan
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculates the current week number (1-based) of a training cycle,
 * given the cycle start date and total duration.
 *
 * @param {string} startDate     - ISO date string, e.g. '2025-01-01'
 * @param {number} durationWeeks - Total weeks in the cycle (6-12)
 * @returns {{ weekNumber: number, isComplete: boolean, daysRemaining: number }}
 */
export function getCurrentWeek(startDate, durationWeeks) {
  const start = new Date(startDate)
  // Normalize to start of day UTC to avoid timezone drift
  start.setUTCHours(0, 0, 0, 0)

  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  const msPerDay = 24 * 60 * 60 * 1000
  const daysPassed = Math.max(0, Math.floor((now - start) / msPerDay))
  const totalDays = durationWeeks * 7

  // Clamp at total cycle length
  const clampedDays = Math.min(daysPassed, totalDays)

  // 1-based week number, capped at durationWeeks
  const weekNumber = Math.min(Math.floor(clampedDays / 7) + 1, durationWeeks)

  const isComplete = daysPassed >= totalDays
  const daysRemaining = Math.max(0, totalDays - daysPassed)

  return { weekNumber, isComplete, daysRemaining }
}

/**
 * Analyses past rutina memory records and returns the top 3 muscle groups
 * that received the least volume across previous rutinas.
 *
 * This is used to suggest which groups to prioritise in the next rutina,
 * promoting balanced long-term development.
 *
 * `cycleMemory` records contain a `volume_by_group` JSONB field shaped as:
 * { [muscleGroup: string]: number }  — total sets accumulated in that rutina.
 *
 * @param {Array<{ volume_by_group: Object.<string, number>, prioritized_groups: string[] }>} cycleMemory
 *   Array of past cycle_memory rows retrieved from Supabase.
 * @returns {string[]} Up to 3 muscle group names with lowest historical volume
 */
export function getRecommendedPriority(cycleMemory) {
  if (!cycleMemory || cycleMemory.length === 0) {
    // No history: default recommendation covers common weak points
    return ['Hombro', 'Isquios/Glúteo', 'Core']
  }

  // Accumulate total volume per group across all past cycles
  const totalVolume = {}

  for (const group of ALL_MUSCLE_GROUPS) {
    totalVolume[group] = 0
  }

  for (const record of cycleMemory) {
    const vbg = record.volume_by_group ?? {}
    for (const group of ALL_MUSCLE_GROUPS) {
      totalVolume[group] += typeof vbg[group] === 'number' ? vbg[group] : 0
    }
  }

  // Sort groups by accumulated volume ascending (least trained first)
  const sorted = ALL_MUSCLE_GROUPS
    .slice()
    .sort((a, b) => totalVolume[a] - totalVolume[b])

  // Return top 3 least trained groups
  return sorted.slice(0, 3)
}

/**
 * Alias de generateCyclePlan para uso en el contexto de rutinas recomendadas.
 * Acepta los mismos parámetros y retorna el mismo plan semanal.
 *
 * @param {Object} params - Ver generateCyclePlan
 * @param {Object} exerciseHistory - Historial de ejercicios del usuario
 * @returns {Array} Plan de rutina generado
 */
export function generateRecommendedRoutine(params, exerciseHistory = {}) {
  return generateCyclePlan(params, exerciseHistory)
}

// =============================================================================
// RUTINA DE UN DÍA
// =============================================================================

/**
 * Mapa de enfoque → grupos musculares para rutinas de un día.
 * Usado en el wizard de "Generar rutina de un día".
 * @type {Object.<string, string[]>}
 */
export const FOCUS_TO_MUSCLES = {
  'Pecho':      ['Pecho', 'Tríceps'],
  'Espalda':    ['Espalda', 'Bíceps'],
  'Pierna':     ['Cuádriceps', 'Isquios/Glúteo'],
  'Hombro':     ['Hombro', 'Tríceps'],
  'Brazos':     ['Bíceps', 'Tríceps'],
  'Upper':      ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps'],
  'Lower':      ['Cuádriceps', 'Isquios/Glúteo', 'Core'],
  'Full Body':  ['Pecho', 'Espalda', 'Hombro', 'Cuádriceps', 'Isquios/Glúteo', 'Bíceps', 'Tríceps', 'Core'],
  'Push':       ['Pecho', 'Hombro', 'Tríceps'],
  'Pull':       ['Espalda', 'Bíceps'],
  'Core':       ['Core'],
  'Funcional':  ['Core', 'Cuádriceps', 'Isquios/Glúteo'],
}

/**
 * Mapea tiempos de sesión (min) al bucket más cercano de SETS_PER_DAY.
 * 30 → 45, 75 → 60 (valores intermedios no disponibles en la tabla).
 * @param {number} minutes
 * @returns {number}
 */
function resolveTimeBucket(minutes) {
  if (minutes <= 45) return 45
  if (minutes <= 60) return 60
  return 90
}

/**
 * Genera el plan de ejercicios para una rutina de un solo día.
 * Reutiliza los mismos algoritmos de distribución de series que generateCyclePlan.
 *
 * @param {Object} params
 * @param {string} params.focus          - Enfoque del entreno (clave de FOCUS_TO_MUSCLES)
 * @param {number} [params.dailyTimeMinutes=60] - Duración en minutos (30/45/60/75/90)
 * @param {string} [params.goal='Hipertrofia']  - Objetivo (clave de GOAL_PARAMS)
 * @param {string} [params.level='Intermedio']  - Nivel del usuario
 * @param {Object} [exerciseHistory={}]  - Historial de 1RM por ejercicio
 * @returns {{ dayName: string, muscleGroups: string[], exercises: Object[] }}
 */
export function generateSingleDayRoutine(
  { focus, dailyTimeMinutes = 60, goal = 'Hipertrofia', level = 'Intermedio' },
  exerciseHistory = {}
) {
  const muscleGroups = FOCUS_TO_MUSCLES[focus] ?? ['Pecho', 'Espalda']
  const goalP        = GOAL_PARAMS[goal] ?? GOAL_PARAMS['Hipertrofia']
  const timeBucket   = resolveTimeBucket(dailyTimeMinutes)
  const totalSets    = SETS_PER_DAY[timeBucket]?.[level] ?? SETS_PER_DAY[60]?.Intermedio ?? 13
  const intensityMid = Math.round((goalP.intensityMin + goalP.intensityMax) / 2)

  // Distribuir series entre grupos musculares
  const setsPerGroup = distributeSetsAcrossGroups(muscleGroups, totalSets, level)

  const exercises = []

  for (const muscleGroup of muscleGroups) {
    const groupSets         = setsPerGroup[muscleGroup] ?? 2
    const maxEx             = groupSets >= 2 ? 2 : 1
    const selectedExercises = pickExercises(muscleGroup, maxEx)
    const setsMap           = distributeSetsAcrossExercises(selectedExercises, groupSets)

    for (const exerciseName of selectedExercises) {
      const sets = setsMap[exerciseName] ?? 1

      // Peso sugerido desde historial de 1RM (si existe)
      let suggestedWeight = null
      let unit = null
      const historyEntry = exerciseHistory[exerciseName]
      if (historyEntry && typeof historyEntry.best1RM === 'number') {
        unit = historyEntry.unit ?? 'kg'
        suggestedWeight = roundToNearest2_5(historyEntry.best1RM * (goalP.intensityMin / 100))
      }

      exercises.push({
        exerciseName,
        sets,
        repsMin: goalP.repsMin,
        repsMax: goalP.repsMax,
        intensityPercent: intensityMid,
        suggestedWeight,
        unit,
      })
    }
  }

  return {
    dayName:      focus,
    muscleGroups: [...muscleGroups],
    exercises,
  }
}
