// Este módulo decide cuánto va a comer alguien. Si se equivoca no falla una
// pantalla: falla una dieta. Se prueba a conciencia, empezando por los valores
// conocidos de las fórmulas y siguiendo por los casos donde faltan datos.

import { describe, it, expect } from 'vitest'
import {
  computeBmr, computeTdee, computeKcal, computeMacros, computeMicroTargets,
  recommendPlan, activityFromDays, toKg,
  ACTIVITY_LEVELS, PHASES, PHASE_FROM_GOAL,
} from './nutritionPlan'

const HOMBRE = { weightKg: 80, heightCm: 180, age: 30, sex: 'Masculino' }

describe('computeBmr', () => {
  it('Mifflin-St Jeor con un valor conocido', () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 1780
    const r = computeBmr(HOMBRE)
    expect(r.value).toBeCloseTo(1780, 5)
    expect(r.method).toBe('mifflin')
    expect(r.leanMassKg).toBeNull()
  })

  it('Mifflin femenino usa la constante −161', () => {
    expect(computeBmr({ ...HOMBRE, sex: 'Femenino' }).value).toBeCloseTo(1614, 5)
  })

  it('Katch-McArdle cuando hay % de grasa', () => {
    // masa magra 64 kg → 370 + 21,6×64 = 1752,4
    const r = computeBmr({ ...HOMBRE, bodyFatPct: 20 })
    expect(r.value).toBeCloseTo(1752.4, 1)
    expect(r.method).toBe('katch')
    expect(r.leanMassKg).toBeCloseTo(64, 5)
  })

  it('Katch solo si hay % de grasa, y no depende de altura ni edad', () => {
    expect(computeBmr({ weightKg: 80, bodyFatPct: 20 }).method).toBe('katch')
    expect(computeBmr({ weightKg: 80 })).toBeNull()
  })

  it('sexo «Otro» o ausente usa el término intermedio y no da NaN', () => {
    for (const sex of ['Otro', null, undefined]) {
      const r = computeBmr({ ...HOMBRE, sex })
      expect(Number.isFinite(r.value)).toBe(true)
      expect(r.value).toBeCloseTo(1697, 5)   // 1775 − 78
    }
  })

  it('sin peso no hay nada que calcular', () => {
    expect(computeBmr({ heightCm: 180, age: 30 })).toBeNull()
    expect(computeBmr({ weightKg: 0, heightCm: 180, age: 30 })).toBeNull()
  })
})

describe('computeTdee', () => {
  it('multiplica por el factor de cada nivel', () => {
    for (const a of ACTIVITY_LEVELS) {
      expect(computeTdee(1780, a.id).tdee).toBeCloseTo(1780 * a.factor, 5)
    }
  })

  it('un nivel desconocido cae en moderado en vez de dar NaN', () => {
    expect(computeTdee(1780, 'inventado').factor).toBe(1.55)
  })
})

describe('computeKcal', () => {
  const args = { tdee: 3000, sex: 'Masculino', bmrValue: 1780 }

  it('aplica el delta de cada fase', () => {
    expect(computeKcal({ ...args, phaseId: 'definicion' }).kcal).toBe(2400)
    expect(computeKcal({ ...args, phaseId: 'mantener' }).kcal).toBe(3000)
    expect(computeKcal({ ...args, phaseId: 'volumen' }).kcal).toBe(3300)
  })

  it('nunca baja del basal: un déficit sobre un gasto bajo se recorta', () => {
    const r = computeKcal({ tdee: 1900, phaseId: 'definicion', sex: 'Femenino', bmrValue: 1600 })
    expect(r.kcal).toBe(1600)      // 1900 × 0,8 = 1520 estaría por debajo
    expect(r.floored).toBe(true)
    expect(r.floor).toBe(1600)
  })

  it('sin recorte, no marca la bandera', () => {
    expect(computeKcal({ ...args, phaseId: 'definicion' }).floored).toBe(false)
  })

  it('con un basal muy bajo sigue habiendo un suelo absoluto', () => {
    const r = computeKcal({ tdee: 1200, phaseId: 'definicion', sex: 'Femenino', bmrValue: 1000 })
    expect(r.kcal).toBe(1200)
    expect(r.floored).toBe(true)
  })
})

describe('computeMacros', () => {
  it('con % de grasa, la proteína sale de la masa magra', () => {
    const r = computeMacros({ kcal: 2400, weightKg: 80, bodyFatPct: 20, phaseId: 'definicion' })
    expect(r.proteinBasis).toBe('lbm')
    expect(r.protein_g).toBe(160)          // 64 kg × 2,5
  })

  it('sin % de grasa, la proteína sale del peso', () => {
    const r = computeMacros({ kcal: 2400, weightKg: 80, phaseId: 'definicion' })
    expect(r.proteinBasis).toBe('bw')
    expect(r.protein_g).toBe(176)          // 80 kg × 2,2
  })

  it('la grasa toma el 22% cuando supera el piso de 0,6 g/kg', () => {
    const r = computeMacros({ kcal: 3000, weightKg: 70, phaseId: 'mantener' })
    expect(r.fatFloored).toBe(false)
    expect(r.fat_g).toBe(73)               // 3000 × 0,22 / 9 = 73,3 > 42
  })

  it('la grasa toma el piso cuando el 22% se queda corto', () => {
    const r = computeMacros({ kcal: 1600, weightKg: 100, phaseId: 'definicion' })
    expect(r.fatFloored).toBe(true)
    expect(r.fat_g).toBe(60)               // 0,6 × 100 = 60 > 1600×0,22/9 = 39
  })

  it('los carbos nunca son negativos, y avisa cuando no caben', () => {
    const r = computeMacros({ kcal: 1200, weightKg: 120, phaseId: 'definicion' })
    expect(r.carbs_g).toBe(0)
    expect(r.carbsShort).toBe(true)
  })

  it('4P + 4C + 9G reconstruye las calorías — el invariante que asume la pantalla', () => {
    for (const kcal of [1800, 2200, 2500, 3000, 3600]) {
      const r = computeMacros({ kcal, weightKg: 80, bodyFatPct: 18, phaseId: 'mantener' })
      expect(r.carbsShort).toBe(false)
      const suma = r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9
      expect(Math.abs(suma - kcal)).toBeLessThanOrEqual(20)
    }
  })
})

describe('computeMicroTargets', () => {
  it('la fibra escala con las calorías: 14 g por cada 1.000', () => {
    expect(computeMicroTargets({ kcal: 1600, sex: 'Masculino', age: 30 }).fibra).toBe(22.4)
    expect(computeMicroTargets({ kcal: 3200, sex: 'Masculino', age: 30 }).fibra).toBe(44.8)
  })

  it('los techos de azúcar y grasa saturada también escalan', () => {
    const a = computeMicroTargets({ kcal: 2000, sex: 'Masculino', age: 30 })
    expect(a.azucar).toBe(75)              // 2000 × 0,15 / 4
    expect(a.grasa_saturada).toBe(22.2)    // 2000 × 0,10 / 9
  })

  it('sodio y colesterol son techos fijos', () => {
    const a = computeMicroTargets({ kcal: 3500, sex: 'Femenino', age: 40 })
    expect(a.sodio).toBe(2300)
    expect(a.colesterol).toBe(300)
  })

  it('el hierro depende de sexo y edad', () => {
    expect(computeMicroTargets({ kcal: 2000, sex: 'Masculino', age: 30 }).hierro).toBe(8)
    expect(computeMicroTargets({ kcal: 2000, sex: 'Femenino',  age: 30 }).hierro).toBe(18)
    expect(computeMicroTargets({ kcal: 2000, sex: 'Femenino',  age: 55 }).hierro).toBe(8)
  })

  it('el calcio sube con la edad, en bandas distintas por sexo', () => {
    expect(computeMicroTargets({ kcal: 2000, sex: 'Femenino',  age: 55 }).calcio).toBe(1200)
    expect(computeMicroTargets({ kcal: 2000, sex: 'Masculino', age: 55 }).calcio).toBe(1000)
    expect(computeMicroTargets({ kcal: 2000, sex: 'Masculino', age: 75 }).calcio).toBe(1200)
  })

  it('sexo desconocido toma el piso MÁS exigente — 8 mg de hierro a quien menstrúa sería el fallo', () => {
    for (const sex of ['Otro', null, undefined]) {
      const a = computeMicroTargets({ kcal: 2000, sex, age: 30 })
      expect(a.hierro).toBe(18)
      expect(a.zinc).toBe(11)
      expect(a.vitamina_c).toBe(90)
    }
  })

  it('sin edad usa la banda 19-50', () => {
    const sinEdad = computeMicroTargets({ kcal: 2000, sex: 'Femenino' })
    const con30 = computeMicroTargets({ kcal: 2000, sex: 'Femenino', age: 30 })
    expect(sinEdad).toEqual(con30)
  })

  it('devuelve las dieciséis claves y ningún NaN', () => {
    const a = computeMicroTargets({ kcal: 2400, sex: 'Masculino', age: 30 })
    expect(Object.keys(a)).toHaveLength(16)
    for (const v of Object.values(a)) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('puentes desde los campos que ya existen', () => {
  it('activityFromDays cubre todo el rango de days_per_week', () => {
    expect(activityFromDays(1)).toBe('ligero')
    expect(activityFromDays(3)).toBe('ligero')
    expect(activityFromDays(4)).toBe('moderado')
    expect(activityFromDays(5)).toBe('moderado')
    expect(activityFromDays(6)).toBe('alto')
    expect(activityFromDays(7)).toBe('alto')
    expect(activityFromDays(0)).toBeNull()
    expect(activityFromDays(null)).toBeNull()
  })

  it('PHASE_FROM_GOAL cubre los cinco valores de profiles.goal', () => {
    const metas = ['Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener']
    for (const m of metas) {
      expect(PHASE_FROM_GOAL[m]).toBeDefined()
      expect(PHASES.some(p => p.id === PHASE_FROM_GOAL[m])).toBe(true)
    }
  })

  it('toKg convierte libras y deja los kilos en paz', () => {
    expect(toKg(100, 'kg')).toBe(100)
    expect(toKg(220, 'lb')).toBeCloseTo(99.79, 1)
  })
})

describe('recommendPlan', () => {
  const completo = { ...HOMBRE, bodyFatPct: 18, activityId: 'moderado', phaseId: 'definicion' }

  it('con datos completos devuelve un plan coherente', () => {
    const r = recommendPlan(completo)
    expect(r.ok).toBe(true)
    expect(r.kcal).toBeGreaterThan(1500)
    expect(r.method.bmr).toBe('katch')
    expect(Object.keys(r.micros)).toHaveLength(16)
  })

  it('sin altura ni edad, pero con % de grasa, sigue pudiendo calcular', () => {
    const r = recommendPlan({ weightKg: 80, bodyFatPct: 18, sex: 'Masculino' })
    expect(r.ok).toBe(true)
    expect(r.method.bmr).toBe('katch')
  })

  it('sin % de grasa, la altura y la edad pasan a ser obligatorias', () => {
    const r = recommendPlan({ weightKg: 80, sex: 'Masculino' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['heightCm', 'age'])
  })

  it('sin peso no hay plan, y lo dice en vez de lanzar', () => {
    expect(recommendPlan({}).ok).toBe(false)
    expect(recommendPlan({}).missing).toContain('weightKg')
    expect(() => recommendPlan()).not.toThrow()
    expect(() => recommendPlan({ weightKg: 'hola' })).not.toThrow()
  })

  it('deduce actividad y fase de los campos que ya existen, y lo advierte', () => {
    const r = recommendPlan({ ...HOMBRE, daysPerWeek: 5, goal: 'Perder grasa' })
    expect(r.ok).toBe(true)
    expect(r.method.activityId).toBe('moderado')
    expect(r.method.phaseId).toBe('definicion')
    expect(r.warnings.map(w => w.id)).toContain('guessed_activity')
    expect(r.warnings.map(w => w.id)).toContain('guessed_phase')
  })

  it('avisa de que el % de grasa estimado tiene margen', () => {
    const estimado = recommendPlan({ ...completo, bodyFatSource: 'estimado' })
    expect(estimado.warnings.map(w => w.id)).toContain('bf_estimated')

    const medido = recommendPlan({ ...completo, bodyFatSource: 'medido' })
    expect(medido.warnings.map(w => w.id)).not.toContain('bf_estimated')
  })

  it('sin % de grasa invita a añadirlo', () => {
    const r = recommendPlan({ ...HOMBRE, activityId: 'moderado', phaseId: 'mantener' })
    expect(r.warnings.map(w => w.id)).toContain('no_body_fat')
  })

  it('sexo desconocido se avisa, porque cambia los micros', () => {
    const r = recommendPlan({ ...completo, sex: 'Otro' })
    expect(r.warnings.map(w => w.id)).toContain('sex_unknown')
  })

  it('los macros que devuelve tienen la forma que espera saveTargets', () => {
    const r = recommendPlan(completo)
    for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g']) {
      expect(Number.isInteger(r[k])).toBe(true)
    }
  })

  // Una etiqueta metida en una frase es a su vez una cadena traducible. Sin
  // marcarla, en inglés salía «Moderado activity»: la frase traducida con la
  // palabra en español dentro.
  it('marca en tvars las variables que hay que traducir antes de interpolar', () => {
    const r = recommendPlan({ ...HOMBRE, daysPerWeek: 5, goal: 'Perder grasa' })
    const porId = Object.fromEntries([...r.reasons, ...r.warnings].map(m => [m.id, m]))
    expect(porId.tdee.tvars).toContain('label')
    expect(porId.phase_definicion.tvars).toContain('label')
    expect(porId.guessed_phase.tvars).toContain('goal')
  })

  it('toda variable con texto en español está declarada en tvars', () => {
    const r = recommendPlan({ ...HOMBRE, daysPerWeek: 5, goal: 'Perder grasa' })
    for (const m of [...r.reasons, ...r.warnings]) {
      for (const [k, v] of Object.entries(m.vars)) {
        // Un valor que es texto con letras (no un número ni un «+10») tiene que
        // ir traducido; si no, se cuela sin traducir dentro de la frase.
        if (typeof v === 'string' && /[a-zá-úñ]{3}/i.test(v)) {
          expect(m.tvars || [], `${m.id} → {${k}} = "${v}" sin declarar en tvars`).toContain(k)
        }
      }
    }
  })

  // El fallo clásico: renombrar una variable y dejar el {marcador} huérfano en
  // la cadena, que en pantalla se ve como «Actividad {label}».
  it('cada {marcador} de cada razón y aviso tiene su valor', () => {
    const casos = [
      completo,
      { ...HOMBRE, sex: 'Otro' },
      { ...HOMBRE, daysPerWeek: 5, goal: 'Perder grasa' },
      { weightKg: 120, heightCm: 160, age: 60, sex: 'Femenino', phaseId: 'definicion', activityId: 'sedentario' },
    ]
    for (const caso of casos) {
      const r = recommendPlan(caso)
      expect(r.ok).toBe(true)
      for (const m of [...r.reasons, ...r.warnings]) {
        expect(typeof m.key).toBe('string')
        expect(m.key.length).toBeGreaterThan(0)
        expect(m.id).toBeTruthy()
        for (const [, name] of m.key.matchAll(/\{(\w+)\}/g)) {
          expect(m.vars, `${m.id} → {${name}}`).toHaveProperty(name)
          expect(m.vars[name]).not.toBeUndefined()
        }
      }
    }
  })
})
