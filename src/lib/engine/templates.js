// Plantillas curadas de splits. Cada día es una lista ORDENADA de slots de
// patrón de movimiento con un rol; el motor llena cada slot desde la librería.
// Regla de producto: días repetidos en la semana NUNCA son iguales (A/B).
//
// Slot: { role: 'primary'|'secondary'|'accessory'|'isolation'|'core',
//         patterns: string[] (movement_pattern admitidos),
//         group: grupo muscular objetivo,
//         optional?: true (se omite si no cabe en el tiempo) }

// ── Días base ────────────────────────────────────────────────────────────────

const FULL_BODY_A = {
  dayName: 'Full Body A',
  rationale: 'Día dominado por sentadilla: empuje y jalón horizontal pesados, bisagra ligera detrás.',
  slots: [
    { role: 'primary',   patterns: ['squat'],           group: 'Cuádriceps' },
    { role: 'secondary', patterns: ['horizontal_push'], group: 'Pecho' },
    { role: 'secondary', patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'accessory', patterns: ['hinge', 'leg_curl_iso'], group: 'Hamstrings' },
    { role: 'isolation', patterns: ['lateral_raise'],   group: 'Hombro', optional: true },
    { role: 'core',      patterns: ['core_anti_extension'], group: 'Core' },
  ],
}

const FULL_BODY_B = {
  dayName: 'Full Body B',
  rationale: 'Día dominado por bisagra de cadera: jalón vertical y empuje inclinado, glúteo como accesorio.',
  slots: [
    { role: 'primary',   patterns: ['hinge'],          group: 'Hamstrings' },
    { role: 'secondary', patterns: ['vertical_pull'],  group: 'Espalda' },
    { role: 'secondary', patterns: ['incline_push', 'vertical_push'], group: 'Pecho' },
    { role: 'accessory', patterns: ['hip_extension'],  group: 'Glúteo' },
    { role: 'isolation', patterns: ['curl'],           group: 'Bíceps', optional: true },
    { role: 'core',      patterns: ['core_flexion'],   group: 'Core' },
  ],
}

const FULL_BODY_C = {
  dayName: 'Full Body C',
  rationale: 'Día unilateral: zancada como base, press vertical y remo, cuádriceps y pecho de aislamiento.',
  slots: [
    { role: 'primary',   patterns: ['lunge'],           group: 'Glúteo' },
    { role: 'secondary', patterns: ['vertical_push'],   group: 'Hombro' },
    { role: 'secondary', patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'accessory', patterns: ['quad_iso', 'squat'], group: 'Cuádriceps' },
    { role: 'isolation', patterns: ['chest_iso'],       group: 'Pecho', optional: true },
    { role: 'core',      patterns: ['core_rotation', 'core_carry'], group: 'Core' },
  ],
}

const UPPER_A = {
  dayName: 'Upper A',
  rationale: 'Torso con el pecho al mando: press plano pesado e inclinado detrás; la espalda mantiene volumen.',
  slots: [
    { role: 'primary',   patterns: ['horizontal_push'], group: 'Pecho' },
    { role: 'secondary', patterns: ['incline_push'],    group: 'Pecho' },
    { role: 'secondary', patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'accessory', patterns: ['vertical_push'],   group: 'Hombro' },
    { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps' },
    { role: 'isolation', patterns: ['lateral_raise'],   group: 'Hombro', optional: true },
    { role: 'isolation', patterns: ['curl'],            group: 'Bíceps', optional: true },
  ],
}

const UPPER_B = {
  dayName: 'Upper B',
  rationale: 'Torso con la espalda al mando: remo y jalón vertical pesados; el pecho pasa a segundo plano.',
  slots: [
    { role: 'primary',   patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'secondary', patterns: ['vertical_pull'],   group: 'Espalda' },
    { role: 'secondary', patterns: ['horizontal_push', 'incline_push'], group: 'Pecho' },
    { role: 'accessory', patterns: ['rear_delt'],       group: 'Espalda' },
    { role: 'isolation', patterns: ['curl'],            group: 'Bíceps' },
    { role: 'isolation', patterns: ['lateral_raise'],   group: 'Hombro', optional: true },
    { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps', optional: true },
  ],
}

const LOWER_A = {
  dayName: 'Lower A',
  rationale: 'Pierna con el cuádriceps al mando: sentadilla pesada más trabajo unilateral; femoral de contrapeso.',
  slots: [
    { role: 'primary',   patterns: ['squat'],        group: 'Cuádriceps' },
    { role: 'secondary', patterns: ['lunge'],        group: 'Cuádriceps' },
    { role: 'accessory', patterns: ['leg_curl_iso'], group: 'Hamstrings' },
    { role: 'isolation', patterns: ['quad_iso'],     group: 'Cuádriceps', optional: true },
    { role: 'isolation', patterns: ['calf_raise'],   group: 'Gemelos' },
    { role: 'core',      patterns: ['core_anti_extension'], group: 'Core', optional: true },
  ],
}

const LOWER_B = {
  dayName: 'Lower B',
  rationale: 'Pierna posterior: bisagra de cadera pesada, empuje de cadera y unilateral para glúteo y femoral.',
  slots: [
    { role: 'primary',   patterns: ['hinge'],         group: 'Hamstrings' },
    { role: 'secondary', patterns: ['hip_extension'], group: 'Glúteo' },
    { role: 'accessory', patterns: ['lunge'],         group: 'Glúteo' },
    { role: 'isolation', patterns: ['leg_curl_iso'],  group: 'Hamstrings', optional: true },
    { role: 'isolation', patterns: ['calf_raise'],    group: 'Gemelos' },
    { role: 'core',      patterns: ['core_flexion'],  group: 'Core', optional: true },
  ],
}

const PUSH_A = {
  dayName: 'Push A',
  rationale: 'Empuje con base plana: press horizontal pesado, hombro después, tríceps y laterales al final.',
  slots: [
    { role: 'primary',   patterns: ['horizontal_push'], group: 'Pecho' },
    { role: 'secondary', patterns: ['vertical_push'],   group: 'Hombro' },
    { role: 'accessory', patterns: ['incline_push'],    group: 'Pecho' },
    { role: 'isolation', patterns: ['lateral_raise'],   group: 'Hombro' },
    { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps' },
    { role: 'isolation', patterns: ['chest_iso'],       group: 'Pecho', optional: true },
  ],
}

const PUSH_B = {
  dayName: 'Push B',
  rationale: 'Empuje con base vertical e inclinada: hombro pesado, pecho superior y tríceps compuesto.',
  slots: [
    { role: 'primary',   patterns: ['vertical_push'],  group: 'Hombro' },
    { role: 'secondary', patterns: ['incline_push'],   group: 'Pecho' },
    { role: 'accessory', patterns: ['dip'],            group: 'Tríceps' },
    { role: 'isolation', patterns: ['lateral_raise'],  group: 'Hombro' },
    { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps', optional: true },
    { role: 'isolation', patterns: ['chest_iso'],      group: 'Pecho', optional: true },
  ],
}

const PULL_A = {
  dayName: 'Pull A',
  rationale: 'Jalón con base horizontal: remo pesado, jalón vertical detrás, hombro posterior y bíceps.',
  slots: [
    { role: 'primary',   patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'secondary', patterns: ['vertical_pull'],   group: 'Espalda' },
    { role: 'accessory', patterns: ['rear_delt'],       group: 'Espalda' },
    { role: 'isolation', patterns: ['curl'],            group: 'Bíceps' },
    { role: 'isolation', patterns: ['shrug'],           group: 'Espalda', optional: true },
    { role: 'core',      patterns: ['core_anti_extension'], group: 'Core', optional: true },
  ],
}

const PULL_B = {
  dayName: 'Pull B',
  rationale: 'Jalón con base vertical: dominadas o jalón pesado, remo detrás, dorsal aislado y doble bíceps.',
  slots: [
    { role: 'primary',   patterns: ['vertical_pull'],   group: 'Espalda' },
    { role: 'secondary', patterns: ['horizontal_pull'], group: 'Espalda' },
    { role: 'accessory', patterns: ['back_extension', 'shrug'], group: 'Espalda' },
    { role: 'isolation', patterns: ['curl'],            group: 'Bíceps' },
    { role: 'isolation', patterns: ['curl'],            group: 'Bíceps', optional: true },
    { role: 'core',      patterns: ['core_flexion'],    group: 'Core', optional: true },
  ],
}

const LEGS_A = {
  dayName: 'Legs A',
  rationale: 'Pierna anterior: sentadilla pesada, unilateral y extensión; femoral y gemelo cierran.',
  slots: [
    { role: 'primary',   patterns: ['squat'],        group: 'Cuádriceps' },
    { role: 'secondary', patterns: ['lunge'],        group: 'Cuádriceps' },
    { role: 'accessory', patterns: ['leg_curl_iso'], group: 'Hamstrings' },
    { role: 'isolation', patterns: ['quad_iso'],     group: 'Cuádriceps', optional: true },
    { role: 'isolation', patterns: ['calf_raise'],   group: 'Gemelos' },
  ],
}

const LEGS_B = {
  dayName: 'Legs B',
  rationale: 'Pierna posterior: bisagra pesada, hip thrust y unilateral de glúteo; femoral aislado.',
  slots: [
    { role: 'primary',   patterns: ['hinge'],         group: 'Hamstrings' },
    { role: 'secondary', patterns: ['hip_extension'], group: 'Glúteo' },
    { role: 'accessory', patterns: ['lunge'],         group: 'Glúteo' },
    { role: 'isolation', patterns: ['leg_curl_iso'],  group: 'Hamstrings' },
    { role: 'isolation', patterns: ['abduction'],     group: 'Glúteo', optional: true },
    { role: 'isolation', patterns: ['calf_raise'],    group: 'Gemelos', optional: true },
  ],
}

// ── Splits por días/semana (regla de producto fija) ─────────────────────────

export const SPLIT_5D_OPTIONS = [
  { value: 'ppl_ul',   label: 'PPL + Upper/Lower', description: 'Push, Pull, Legs y luego un día de torso y uno de pierna posterior.' },
  { value: 'ppl_pure', label: 'PPL puro',           description: 'Push, Pull, Legs y repites Push y Pull con variantes B.' },
]

const clone = (day) => ({ ...day, slots: day.slots.map(s => ({ ...s, patterns: [...s.patterns] })) })

export function getSplitDays(daysPerWeek, splitChoice = null) {
  switch (daysPerWeek) {
    case 2: return { splitName: 'Full Body ×2', days: [FULL_BODY_A, FULL_BODY_B].map(clone) }
    case 3: return { splitName: 'Full Body ×3', days: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C].map(clone) }
    case 4: return { splitName: 'Upper / Lower', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B].map(clone) }
    case 5: {
      if (splitChoice === 'ppl_pure') {
        return { splitName: 'PPL + Push/Pull B', days: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B].map(clone) }
      }
      return { splitName: 'PPL + Upper/Lower', days: [PUSH_A, PULL_A, LEGS_A, UPPER_B, LOWER_B].map(clone) }
    }
    case 6:
    default:
      return { splitName: 'Push / Pull / Legs ×2', days: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B].map(clone) }
  }
}

/**
 * Sesgo por sexo (sugerencia, nunca imposición): con sexo femenino, los días de
 * pierna anterior cambian su aislamiento opcional de cuádriceps por trabajo de
 * glúteo (abducción / empuje de cadera).
 */
export function applySexBias(days, sex) {
  if (sex !== 'Femenino') return days
  return days.map(day => {
    if (!['Lower A', 'Legs A'].includes(day.dayName)) return day
    return {
      ...day,
      slots: day.slots.map(s =>
        s.optional && s.patterns.includes('quad_iso')
          ? { ...s, patterns: ['abduction', 'hip_extension'], group: 'Glúteo' }
          : s
      ),
    }
  })
}

// ── Rutinas de un día (mismo motor, un solo día) ────────────────────────────

export const FOCUS_OPTIONS = [
  'Pecho', 'Espalda', 'Pierna', 'Hombro', 'Brazos', 'Upper', 'Lower',
  'Full Body', 'Push', 'Pull', 'Core', 'Funcional',
]

const SINGLE_DAY_TEMPLATES = {
  'Pecho': {
    dayName: 'Pecho',
    rationale: 'Sesión de pecho completa: plano pesado, inclinado, aislamiento y tríceps de cierre.',
    slots: [
      { role: 'primary',   patterns: ['horizontal_push'], group: 'Pecho' },
      { role: 'secondary', patterns: ['incline_push'],    group: 'Pecho' },
      { role: 'accessory', patterns: ['chest_iso'],       group: 'Pecho' },
      { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps' },
      { role: 'isolation', patterns: ['chest_iso'],       group: 'Pecho', optional: true },
    ],
  },
  'Espalda': {
    dayName: 'Espalda',
    rationale: 'Sesión de espalda: remo pesado, jalón vertical, hombro posterior y bíceps de cierre.',
    slots: [
      { role: 'primary',   patterns: ['horizontal_pull'], group: 'Espalda' },
      { role: 'secondary', patterns: ['vertical_pull'],   group: 'Espalda' },
      { role: 'accessory', patterns: ['rear_delt'],       group: 'Espalda' },
      { role: 'isolation', patterns: ['curl'],            group: 'Bíceps' },
      { role: 'isolation', patterns: ['shrug'],           group: 'Espalda', optional: true },
    ],
  },
  'Pierna': {
    dayName: 'Pierna',
    rationale: 'Pierna completa: sentadilla y bisagra pesadas, unilateral, femoral y gemelo.',
    slots: [
      { role: 'primary',   patterns: ['squat'],        group: 'Cuádriceps' },
      { role: 'secondary', patterns: ['hinge'],        group: 'Hamstrings' },
      { role: 'accessory', patterns: ['lunge'],        group: 'Glúteo' },
      { role: 'isolation', patterns: ['leg_curl_iso'], group: 'Hamstrings', optional: true },
      { role: 'isolation', patterns: ['calf_raise'],   group: 'Gemelos' },
    ],
  },
  'Hombro': {
    dayName: 'Hombro',
    rationale: 'Hombro en las tres cabezas: press pesado, laterales, posterior y frontal opcional.',
    slots: [
      { role: 'primary',   patterns: ['vertical_push'], group: 'Hombro' },
      { role: 'secondary', patterns: ['lateral_raise'], group: 'Hombro' },
      { role: 'accessory', patterns: ['rear_delt'],     group: 'Espalda' },
      { role: 'isolation', patterns: ['front_raise'],   group: 'Hombro', optional: true },
      { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps', optional: true },
    ],
  },
  'Brazos': {
    dayName: 'Brazos',
    rationale: 'Brazos con base compuesta: press cerrado o fondos primero, luego curls y extensiones.',
    slots: [
      { role: 'primary',   patterns: ['horizontal_push', 'dip'], group: 'Tríceps' },
      { role: 'secondary', patterns: ['curl'],              group: 'Bíceps' },
      { role: 'accessory', patterns: ['triceps_extension'], group: 'Tríceps' },
      { role: 'isolation', patterns: ['curl'],              group: 'Bíceps' },
      { role: 'isolation', patterns: ['triceps_extension'], group: 'Tríceps', optional: true },
    ],
  },
  'Upper': clone(UPPER_A),
  'Lower': {
    dayName: 'Lower',
    rationale: 'Pierna equilibrada: sentadilla, bisagra y empuje de cadera; gemelo de cierre.',
    slots: [
      { role: 'primary',   patterns: ['squat'],         group: 'Cuádriceps' },
      { role: 'secondary', patterns: ['hinge'],         group: 'Hamstrings' },
      { role: 'accessory', patterns: ['hip_extension'], group: 'Glúteo' },
      { role: 'isolation', patterns: ['quad_iso'],      group: 'Cuádriceps', optional: true },
      { role: 'isolation', patterns: ['calf_raise'],    group: 'Gemelos' },
    ],
  },
  'Full Body': clone(FULL_BODY_A),
  'Push': clone(PUSH_A),
  'Pull': clone(PULL_A),
  'Core': {
    dayName: 'Core',
    rationale: 'Core en sus tres funciones: anti-extensión, flexión y rotación, con carga opcional.',
    slots: [
      { role: 'primary',   patterns: ['core_anti_extension'], group: 'Core' },
      { role: 'secondary', patterns: ['core_flexion'],  group: 'Core' },
      { role: 'accessory', patterns: ['core_rotation'], group: 'Core' },
      { role: 'isolation', patterns: ['core_carry'],    group: 'Core', optional: true },
    ],
  },
  'Funcional': {
    dayName: 'Funcional',
    rationale: 'Patrones funcionales: unilateral, bisagra, cargas y anti-extensión.',
    slots: [
      { role: 'primary',   patterns: ['lunge'],      group: 'Glúteo' },
      { role: 'secondary', patterns: ['hinge'],      group: 'Hamstrings' },
      { role: 'accessory', patterns: ['core_carry'], group: 'Core' },
      { role: 'isolation', patterns: ['core_anti_extension'], group: 'Core' },
      { role: 'isolation', patterns: ['vertical_push'], group: 'Hombro', optional: true },
    ],
  },
}

export function getSingleDayTemplate(focus) {
  const t = SINGLE_DAY_TEMPLATES[focus] ?? SINGLE_DAY_TEMPLATES['Full Body']
  return clone({ ...t, dayName: focus })
}
