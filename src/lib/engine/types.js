/**
 * types.js — contratos del motor de recomendaciones.
 * Cualquier backend (reglas curadas hoy, LLM mañana) debe producir un `Plan`
 * válido con esta forma; la UI y el guardado solo dependen de esto.
 *
 * @typedef {Object} LibraryExercise
 * @property {string}   id
 * @property {string}   name
 * @property {string}   muscle_group        - Uno de MUSCLE_GROUPS
 * @property {string}   category            - push|pull|legs|core
 * @property {string}   movement_pattern
 * @property {string[]} primary_muscles
 * @property {string[]} secondary_muscles
 * @property {string[]} equipment
 * @property {string}   difficulty          - Nivel mínimo
 * @property {boolean}  is_compound
 * @property {string}   tracking_type       - weight_reps|reps|time
 * @property {string}   substitution_group
 * @property {number}   best_rep_min
 * @property {number}   best_rep_max
 * @property {string}   coaching_notes
 * @property {boolean}  is_active
 *
 * @typedef {Object} HistoryAnalysis
 * @property {Object.<string, number>} familiarity        - nombre → nº de sesiones registradas
 * @property {Object.<string, {value: number, unit: string}>} best1RM - nombre → mejor 1RM estimado
 * @property {Object.<string, number>} weeklyVolumeByGroup - grupo → series/semana (últimas 4 semanas)
 * @property {string[]} undertrainedGroups                - grupos por debajo de MEV, peor primero
 *
 * @typedef {Object} GenerationInput
 * @property {'cycle'|'single_day'} mode
 * @property {'Fuerza'|'Hipertrofia'} goal
 * @property {'Principiante'|'Intermedio'|'Avanzado'} level
 * @property {number}   daysPerWeek       - 2-6 (solo cycle)
 * @property {45|60|90} sessionMinutes
 * @property {string|null} sex            - 'Masculino'|'Femenino'|'Otro'|null
 * @property {string|null} splitChoice    - 'ppl_ul'|'ppl_pure' (solo 5 días)
 * @property {string[]} priorityGroups    - 0-2 grupos de MUSCLE_GROUPS
 * @property {'full'|string[]} equipment  - 'full' o subconjunto de tokens
 * @property {boolean}  useHistory
 * @property {string}   [focus]           - solo single_day
 * @property {number}   seed              - regenerar = seed+1
 * @property {LibraryExercise[]} library
 * @property {HistoryAnalysis|null} history
 *
 * @typedef {Object} PlanExercise
 * @property {string}      libraryId
 * @property {string}      name             - Nombre exacto de exercises_library
 * @property {string}      muscleGroup
 * @property {string}      pattern
 * @property {string}      role             - primary|secondary|accessory|isolation|core
 * @property {number}      sets
 * @property {number}      repsMin
 * @property {number}      repsMax
 * @property {string}      repsUnit         - 'reps'|'seg'
 * @property {string}      rir              - ej. '1-2'
 * @property {number}      restSeconds
 * @property {number|null} suggestedWeight
 * @property {string|null} unit
 * @property {boolean}     weightIsEstimate - true si vino de un ejercicio hermano
 * @property {boolean}     isFamiliar
 * @property {string}      note             - racional + técnica (se guarda en notes)
 *
 * @typedef {Object} PlanDay
 * @property {string}         dayName    - ej. 'Push A'
 * @property {string}         focus      - grupos del día, legible
 * @property {string}         rationale  - por qué el día está armado así
 * @property {number}         estMinutes
 * @property {PlanExercise[]} exercises
 *
 * @typedef {Object} Plan
 * @property {number}   seed
 * @property {string}   title
 * @property {string}   summary       - el "proceso de pensamiento" visible del plan
 * @property {string}   splitName     - ej. 'Push / Pull / Legs ×2'
 * @property {Object.<string, number>} weeklyVolume - grupo → series/semana
 * @property {string[]} notes         - avisos (equipo relajado, slot omitido…)
 * @property {PlanDay[]} days
 */

export {}
