/*
 * De qué está hecho un objetivo de calorías.
 *
 * Antes la app pedía un número y no daba ninguna forma de saber cuál. «2.500
 * kcal» era un default inventado, y como nadie sabe de dónde sale un número
 * así, casi todo el mundo lo dejaba puesto. Aquí está el cálculo que lo
 * sustituye: gasto basal → gasto total → ajuste por fase → reparto de macros →
 * objetivos de micros.
 *
 * Módulo puro: sin React, sin Supabase, sin traducir. Devuelve CLAVES de
 * diccionario, no frases hechas, porque las razones se pintan en pantalla y
 * tienen que poder salir en inglés. (Es la diferencia con lib/engine/rationale.js,
 * cuyo texto se guarda en la base y por eso sí es prosa cerrada.)
 *
 * Lo que NO hace este archivo, y conviene tener presente: medir. Cualquier
 * fórmula de gasto es una conjetura educada con un ±10% de su parte. El dato
 * que de verdad manda —cuánto comiste y qué hizo tu peso durante tres semanas—
 * ya está en la base y se calculará cuando el registro diario sea un hábito.
 */

import { NUTRIENT_BY_KEY } from './nutrients'

// Conversiones de los insumos. Están aquí y no en un módulo de unidades
// porque el peso y la altura solo entran al cálculo por esta puerta.
/** Libras a kilos. */
export const toKg = (weight, unit) => (unit === 'lb' ? weight * 0.453592 : weight)
/** Pies (decimales, como los guarda el perfil) a centímetros. */
export const toCm = (height, unit) => (unit === 'ft' ? height * 30.48 : height)

// ── Constantes ───────────────────────────────────────────────────────────

export const ACTIVITY_LEVELS = [
  { id: 'sedentario', factor: 1.20,  label: 'Sedentario', hint: 'Escritorio, sin entrenar' },
  { id: 'ligero',     factor: 1.375, label: 'Ligero',     hint: '1-3 entrenos por semana' },
  { id: 'moderado',   factor: 1.55,  label: 'Moderado',   hint: '3-5 entrenos por semana' },
  { id: 'alto',       factor: 1.725, label: 'Alto',       hint: '6-7 entrenos por semana' },
  { id: 'muy_alto',   factor: 1.90,  label: 'Muy alto',   hint: 'Trabajo físico y entreno diario' },
]

// La proteína se fija por kg de masa magra cuando se conoce el % de grasa, y
// por kg de peso cuando no: 2,5 g/kg sobre alguien con 35% de grasa sería una
// cifra absurda, y sobre la masa magra es exactamente la correcta.
export const PHASES = [
  { id: 'definicion', kcalPct: -0.20, proteinPerKgLbm: 2.5, proteinPerKgBw: 2.2, label: 'Definición' },
  { id: 'mantener',   kcalPct:  0.00, proteinPerKgLbm: 2.2, proteinPerKgBw: 1.9, label: 'Mantener' },
  // «Ganar volumen» y no «Volumen» a secas: en el diccionario, «Volumen» ya es
  // el volumen de entrenamiento (kg levantados) y la clave ES la cadena en
  // español, así que la fase habría salido como «Volume» en inglés.
  { id: 'volumen',    kcalPct:  0.10, proteinPerKgLbm: 2.0, proteinPerKgBw: 1.8, label: 'Ganar volumen' },
]

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITY_LEVELS.map(a => [a.id, a]))
export const PHASE_BY_ID = Object.fromEntries(PHASES.map(p => [p.id, p]))

// Puentes desde los campos que YA existen en profiles. Sin ellos, la
// recomendación se estrenaría como una pantalla vacía para todo el mundo:
// así funciona desde el primer día y solo pide datos para afinar.
export const PHASE_FROM_GOAL = {
  'Perder grasa':  'definicion',
  'Ganar músculo': 'volumen',
  'Fuerza':        'mantener',
  'Resistencia':   'mantener',
  'Mantener':      'mantener',
}

export function activityFromDays(daysPerWeek) {
  const d = Number(daysPerWeek)
  if (!Number.isFinite(d) || d <= 0) return null
  if (d <= 3) return 'ligero'
  if (d <= 5) return 'moderado'
  return 'alto'
}

// Por debajo de esto un déficit deja de ser un déficit y pasa a ser otra cosa.
const KCAL_FLOOR = { m: 1500, f: 1200 }
const DEFAULT_AGE = 30          // banda 19-50, la de la mayoría de las tablas
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

/** 'Masculino' | 'Femenino' | 'Otro' | null → 'm' | 'f' | null */
function sexKey(sex) {
  if (sex === 'Masculino') return 'm'
  if (sex === 'Femenino') return 'f'
  return null
}

// ── Gasto ────────────────────────────────────────────────────────────────

/**
 * Metabolismo basal. Con % de grasa usa Katch-McArdle, que parte de la masa
 * magra y por eso no necesita ni altura ni edad. Sin él, Mifflin-St Jeor.
 */
export function computeBmr({ weightKg, heightCm, age, sex, bodyFatPct }) {
  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0) return null

  const bf = Number(bodyFatPct)
  if (Number.isFinite(bf) && bf > 0) {
    const leanMassKg = w * (1 - bf / 100)
    return { value: 370 + 21.6 * leanMassKg, method: 'katch', leanMassKg }
  }

  const h = Number(heightCm)
  const a = Number(age)
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(a) || a <= 0) return null

  // Sexo desconocido: el término intermedio entre +5 y −161, para no inclinar
  // el resultado hacia ninguno de los dos.
  const s = { m: 5, f: -161 }[sexKey(sex)] ?? -78
  return { value: 10 * w + 6.25 * h - 5 * a + s, method: 'mifflin', leanMassKg: null }
}

export function computeTdee(bmrValue, activityId) {
  const factor = ACTIVITY_BY_ID[activityId]?.factor ?? ACTIVITY_BY_ID.moderado.factor
  return { tdee: bmrValue * factor, factor }
}

/**
 * Calorías objetivo. El piso de seguridad importa: un −20% sobre un gasto
 * total ya bajo puede acabar por debajo del propio metabolismo basal, que es
 * donde una dieta deja de funcionar y empieza a costar músculo.
 */
export function computeKcal({ tdee, phaseId, sex, bmrValue }) {
  const phase = PHASE_BY_ID[phaseId] || PHASE_BY_ID.mantener
  const raw = tdee * (1 + phase.kcalPct)
  const floor = Math.max(bmrValue, KCAL_FLOOR[sexKey(sex)] ?? KCAL_FLOOR.m)
  const floored = raw < floor
  return { kcal: Math.round(floored ? floor : raw), floored, floor: Math.round(floor) }
}

// ── Macros ───────────────────────────────────────────────────────────────

/**
 * La grasa es un PISO, no un porcentaje fijo: 0,6 g/kg es el mínimo por debajo
 * del cual empieza a notarse en las hormonas, y el 22% de las calorías es lo
 * razonable cuando ese mínimo se queda corto. Gana el mayor de los dos.
 * Los carbos son lo que sobra.
 */
export function computeMacros({ kcal, weightKg, bodyFatPct, phaseId }) {
  const phase = PHASE_BY_ID[phaseId] || PHASE_BY_ID.mantener
  const w = Number(weightKg)
  const bf = Number(bodyFatPct)
  const hasBf = Number.isFinite(bf) && bf > 0

  const proteinBasis = hasBf ? 'lbm' : 'bw'
  const proteinRef = hasBf ? w * (1 - bf / 100) : w
  const perKg = hasBf ? phase.proteinPerKgLbm : phase.proteinPerKgBw
  const protein_g = Math.round(proteinRef * perKg)

  const fatFloorG = 0.6 * w
  const fatFromPct = (kcal * 0.22) / KCAL_PER_G.fat
  const fatFloored = fatFloorG > fatFromPct
  const fat_g = Math.round(Math.max(fatFloorG, fatFromPct))

  const left = kcal - protein_g * KCAL_PER_G.protein - fat_g * KCAL_PER_G.fat
  const carbsShort = left < 0
  const carbs_g = Math.max(0, Math.round(left / KCAL_PER_G.carbs))

  return { protein_g, carbs_g, fat_g, proteinBasis, perKg, proteinRef, fatFloored, carbsShort }
}

// ── Micros ───────────────────────────────────────────────────────────────

// Pisos por sexo y banda de edad. `f` es una función de la edad solo donde la
// edad cambia algo; el resto son números.
const FLOOR_RDA = {
  potasio:      { m: () => 3400, f: () => 2600 },
  calcio:       { m: (a) => (a >= 71 ? 1200 : 1000), f: (a) => (a >= 51 ? 1200 : 1000) },
  hierro:       { m: () => 8,    f: (a) => (a >= 51 ? 8 : 18) },
  magnesio:     { m: (a) => (a >= 31 ? 420 : 400), f: (a) => (a >= 31 ? 320 : 310) },
  zinc:         { m: () => 11,   f: () => 8 },
  omega3:       { m: () => 1.6,  f: () => 1.1 },
  vitamina_c:   { m: () => 90,   f: () => 75 },
  vitamina_b12: { m: () => 2.4,  f: () => 2.4 },
  vitamina_a:   { m: () => 900,  f: () => 700 },
  vitamina_d:   { m: (a) => (a >= 71 ? 20 : 15), f: (a) => (a >= 71 ? 20 : 15) },
  folato:       { m: () => 400,  f: () => 400 },
}

const CEILING_FLAT = { sodio: 2300, colesterol: 300 }

/**
 * Objetivos de micros. Tres orígenes distintos y conviene no mezclarlos:
 *
 *   · Escalados por calorías — fibra, azúcar y grasa saturada. Comer 1.600 o
 *     3.200 kcal no son la misma dieta, así que estos no pueden ser fijos.
 *   · Techos fijos — sodio y colesterol.
 *   · Pisos RDA — el resto, por sexo y edad.
 *
 * El azúcar es un techo del 15% de las calorías, no del 10% de la OMS: aquel
 * 10% es para azúcar AÑADIDO y todo lo que la app va a recibir es azúcar
 * TOTAL. Con un techo del 10%, un día de fruta entera sale en rojo, que es la
 * clase de error que enseña a ignorar la pantalla.
 *
 * Sexo desconocido: los pisos toman el MAYOR de los dos y los techos el MENOR.
 * Un piso alto de más es inofensivo (significa comer más espinaca); un piso
 * bajo de menos le manda 8 mg de hierro a quien necesita 18.
 */
export function computeMicroTargets({ kcal, sex, age }) {
  const k = Number(kcal) || 0
  const a = Number.isFinite(Number(age)) && Number(age) > 0 ? Number(age) : DEFAULT_AGE
  const sk = sexKey(sex)

  const out = {
    fibra:          (14 * k) / 1000,
    azucar:         (k * 0.15) / KCAL_PER_G.carbs,
    grasa_saturada: (k * 0.10) / KCAL_PER_G.fat,
    ...CEILING_FLAT,
  }

  for (const [key, byS] of Object.entries(FLOOR_RDA)) {
    out[key] = sk ? byS[sk](a) : Math.max(byS.m(a), byS.f(a))
  }

  for (const key of Object.keys(out)) {
    const d = NUTRIENT_BY_KEY[key].decimals
    const f = 10 ** d
    out[key] = Math.round(out[key] * f) / f
  }
  return out
}

// ── La función que llama la interfaz ─────────────────────────────────────

/**
 * Devuelve `{ok: false, missing}` cuando faltan datos, o el plan completo con
 * sus razones y avisos. Nunca lanza: una pantalla de objetivos no puede
 * romperse porque a alguien le falte la altura.
 *
 * `reasons` y `warnings` son `{id, key, vars, tvars?}` — la clave es la cadena
 * en español, que es como funciona el diccionario de esta app, y `vars` se
 * interpola con `t(key, vars)`.
 *
 * `tvars` lista las variables que son a su vez claves de diccionario y hay que
 * traducir ANTES de interpolar. Sin eso, en inglés salía «Moderado activity»:
 * la frase traducida con la etiqueta en español metida dentro.
 */
export function recommendPlan(input = {}) {
  const {
    weightKg, heightCm, age, sex, bodyFatPct, bodyFatSource,
    activityId, phaseId, daysPerWeek, goal,
  } = input

  const bf = Number(bodyFatPct)
  const hasBf = Number.isFinite(bf) && bf > 0

  // Katch solo necesita peso y % de grasa; Mifflin necesita además altura y
  // edad. Por eso lo que falta depende de lo que ya haya.
  const missing = []
  if (!(Number(weightKg) > 0)) missing.push('weightKg')
  if (!hasBf) {
    if (!(Number(heightCm) > 0)) missing.push('heightCm')
    if (!(Number(age) > 0)) missing.push('age')
  }
  if (missing.length) return { ok: false, missing }

  const reasons = []
  const warnings = []

  const resolvedActivity = activityId || activityFromDays(daysPerWeek) || 'moderado'
  if (!activityId) {
    warnings.push(daysPerWeek
      ? { id: 'guessed_activity', key: 'Actividad deducida de tus {n} días por semana. Ajústala en Perfil.', vars: { n: daysPerWeek } }
      : { id: 'guessed_activity_default', key: 'Sin nivel de actividad, se asume moderado. Ajústalo en Perfil.', vars: {} })
  }

  const resolvedPhase = phaseId || PHASE_FROM_GOAL[goal] || 'mantener'
  if (!phaseId && goal && PHASE_FROM_GOAL[goal]) {
    warnings.push({ id: 'guessed_phase', key: 'Fase deducida de tu meta «{goal}».', vars: { goal }, tvars: ['goal'] })
  }

  const bmr = computeBmr({ weightKg, heightCm, age, sex, bodyFatPct })
  if (!bmr) return { ok: false, missing: ['weightKg'] }

  const { tdee, factor } = computeTdee(bmr.value, resolvedActivity)
  const { kcal, floored, floor } = computeKcal({ tdee, phaseId: resolvedPhase, sex, bmrValue: bmr.value })
  const macros = computeMacros({ kcal, weightKg, bodyFatPct, phaseId: resolvedPhase })
  const micros = computeMicroTargets({ kcal, sex, age })

  // ── Razones ──
  if (bmr.method === 'katch') {
    reasons.push({
      id: 'bmr_katch',
      key: 'Katch-McArdle con {bf}% de grasa: {lbm} kg de masa magra, {bmr} kcal en reposo.',
      vars: { bf: Math.round(bf * 10) / 10, lbm: Math.round(bmr.leanMassKg), bmr: Math.round(bmr.value) },
    })
  } else {
    reasons.push({
      id: 'bmr_mifflin',
      key: 'Mifflin-St Jeor con peso, altura y edad: {bmr} kcal en reposo.',
      vars: { bmr: Math.round(bmr.value) },
    })
  }

  reasons.push({
    id: 'tdee',
    key: 'Actividad {label} (×{factor}): {tdee} kcal para mantenerte.',
    vars: { label: ACTIVITY_BY_ID[resolvedActivity].label, factor: factor, tdee: Math.round(tdee) },
    tvars: ['label'],
  })

  const phase = PHASE_BY_ID[resolvedPhase]
  reasons.push({
    id: `phase_${resolvedPhase}`,
    key: phase.kcalPct === 0
      ? 'Mantener: sin ajuste sobre ese gasto.'
      : 'Fase {label}: {pct}% sobre el gasto.',
    vars: { label: phase.label, pct: `${phase.kcalPct > 0 ? '+' : '−'}${Math.abs(Math.round(phase.kcalPct * 100))}` },
    tvars: ['label'],
  })

  reasons.push(macros.proteinBasis === 'lbm'
    ? { id: 'protein_lbm', key: 'Proteína a {perKg} g por kg de masa magra: {g} g.', vars: { perKg: macros.perKg, g: macros.protein_g } }
    : { id: 'protein_bw',  key: 'Proteína a {perKg} g por kg de peso: {g} g.',       vars: { perKg: macros.perKg, g: macros.protein_g } })

  reasons.push(macros.fatFloored
    ? { id: 'fat_floor', key: 'Grasa al piso de 0,6 g/kg ({g} g) para no tocar las hormonas.', vars: { g: macros.fat_g } }
    : { id: 'fat_pct',   key: 'Grasa al 22% de las calorías: {g} g.', vars: { g: macros.fat_g } })

  reasons.push({ id: 'carbs_rest', key: 'Los carbos son lo que queda: {g} g.', vars: { g: macros.carbs_g } })
  reasons.push({ id: 'fiber_scaled', key: 'Fibra a 14 g por cada 1.000 kcal: {g} g.', vars: { g: micros.fibra } })
  reasons.push({ id: 'ceilings', key: 'Sodio, azúcar, grasa saturada y colesterol son techos, no metas.', vars: {} })

  // ── Avisos ──
  if (floored) {
    warnings.push({ id: 'kcal_floored', key: 'El déficit se recortó: por debajo de {floor} kcal estarías comiendo menos de lo que gastas en reposo.', vars: { floor } })
  }
  if (macros.carbsShort) {
    warnings.push({ id: 'carbs_short', key: 'Con esas calorías, la proteína y la grasa no dejan sitio para carbos. Sube las calorías o baja la proteína.', vars: {} })
  }
  if (hasBf && bodyFatSource !== 'medido') {
    warnings.push({ id: 'bf_estimated', key: 'El % de grasa es una estimación visual: cuenta con ±5 puntos.', vars: {} })
  }
  if (!hasBf) {
    warnings.push({ id: 'no_body_fat', key: 'Añade tu % de grasa en Perfil y el cálculo pasa a usar tu masa magra.', vars: {} })
  }
  if (!sexKey(sex)) {
    warnings.push({ id: 'sex_unknown', key: 'Sin sexo en el perfil se usan los valores más exigentes de micros.', vars: {} })
  }

  return {
    ok: true,
    kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    micros,
    method: {
      bmr: bmr.method,
      bmrValue: Math.round(bmr.value),
      leanMassKg: bmr.leanMassKg == null ? null : Math.round(bmr.leanMassKg * 10) / 10,
      tdee: Math.round(tdee),
      activityFactor: factor,
      activityId: resolvedActivity,
      phaseId: resolvedPhase,
    },
    reasons,
    warnings,
  }
}
