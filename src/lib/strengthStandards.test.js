import { describe, it, expect } from 'vitest'
import {
  patternOf, thresholds, levelFor, nextLevel, rankByRelativeStrength, LEVELS,
} from './strengthStandards'

describe('patternOf', () => {
  it('reconoce los básicos con los nombres reales de la biblioteca', () => {
    expect(patternOf('Sentadilla con barra')).toBe('squat')
    expect(patternOf('Press de banca con barra')).toBe('bench')
    expect(patternOf('Dominadas agarre prono')).toBe('pullup')
    expect(patternOf('Remo con barra')).toBe('row')
  })

  it('no confunde una variante con el básico que lleva en el nombre', () => {
    // Todas contienen el nombre de un básico y ninguna se mide con su vara.
    expect(patternOf('Sentadilla búlgara')).toBeNull()
    expect(patternOf('Sentadilla goblet')).toBeNull()
    expect(patternOf('Sentadilla en Smith')).toBeNull()
    expect(patternOf('Peso muerto rumano')).toBeNull()
    expect(patternOf('Press de Pecho en Máquina')).toBeNull()
    expect(patternOf('Prensa de pierna unilateral')).toBeNull()
  })

  it('los accesorios no tienen patrón', () => {
    expect(patternOf('Curl con mancuernas de pie')).toBeNull()
    expect(patternOf('Crossover en polea alta')).toBeNull()
    expect(patternOf('Elevaciones laterales con mancuernas')).toBeNull()
  })

  it('aguanta acentos, mayúsculas y vacíos', () => {
    expect(patternOf('SENTADILLA CON BARRA')).toBe('squat')
    expect(patternOf('')).toBeNull()
    expect(patternOf(null)).toBeNull()
  })
})

describe('thresholds', () => {
  it('la mujer tiene umbrales más bajos que el hombre', () => {
    const h = thresholds('bench', 'Masculino')
    const m = thresholds('bench', 'Femenino')
    expect(m.every((v, i) => v < h[i])).toBe(true)
  })

  it('el factor no es el mismo en todos los patrones', () => {
    // Si fuera un factor único, estas dos razones serían iguales.
    const sq = thresholds('squat', 'Femenino')[0] / thresholds('squat', 'Masculino')[0]
    const bp = thresholds('bench', 'Femenino')[0] / thresholds('bench', 'Masculino')[0]
    expect(sq).not.toBeCloseTo(bp, 2)
  })

  it('sin patrón no hay umbrales', () => {
    expect(thresholds(null)).toBeNull()
  })
})

describe('levelFor', () => {
  it('sitúa una sentadilla al doble del peso corporal en Avanzado', () => {
    expect(levelFor(2.3, 'squat')).toBe('Avanzado')
  })

  it('por debajo del primer umbral no etiqueta', () => {
    // "Peor que principiante" es un juicio, no un dato.
    expect(levelFor(0.5, 'squat')).toBeNull()
  })

  it('el tope es Élite', () => {
    expect(levelFor(5, 'squat')).toBe('Élite')
    expect(LEVELS[LEVELS.length - 1]).toBe('Élite')
  })

  it('sin patrón no hay nivel', () => {
    expect(levelFor(1.5, null)).toBeNull()
  })
})

describe('nextLevel', () => {
  it('dice cuánto falta para el siguiente escalón', () => {
    const n = nextLevel(1.5, 'squat')
    expect(n.level).toBe('Intermedio')
    expect(n.ratio).toBe(1.75)
    expect(n.gap).toBeCloseTo(0.25, 2)
  })

  it('en Élite ya no hay siguiente', () => {
    expect(nextLevel(5, 'squat')).toBeNull()
  })
})

describe('rankByRelativeStrength', () => {
  const lifts = [
    { name: 'Peso muerto convencional', best1RMKg: 140 },
    { name: 'Sentadilla con barra', best1RMKg: 120 },
    { name: 'Curl con mancuernas de pie', best1RMKg: 30 },
  ]

  it('ordena por razón, no por kilos', () => {
    const out = rankByRelativeStrength(lifts, { bodyWeightKg: 80 })
    expect(out[0].name).toBe('Peso muerto convencional')
    expect(out[0].ratio).toBe(1.75)
    expect(out[1].ratio).toBe(1.5)
  })

  it('los que tienen estándar van antes que los accesorios', () => {
    const out = rankByRelativeStrength([
      { name: 'Curl con mancuernas de pie', best1RMKg: 200 },  // razón altísima, sin estándar
      { name: 'Sentadilla con barra', best1RMKg: 100 },
    ], { bodyWeightKg: 80 })
    expect(out[0].name).toBe('Sentadilla con barra')
    expect(out[0].level).toBeTruthy()
    expect(out[1].level).toBeNull()
  })

  it('en dominadas suma el peso corporal al lastre', () => {
    // 0 kg de lastre pesando 80 es mover 80: razón 1, no 0.
    const out = rankByRelativeStrength(
      [{ name: 'Dominadas agarre prono', best1RMKg: 0.0001 }], { bodyWeightKg: 80 })
    expect(out[0].ratio).toBeCloseTo(1, 1)
    expect(out[0].level).toBe('Principiante')
  })

  it('sin peso corporal no inventa un ranking', () => {
    expect(rankByRelativeStrength(lifts, {})).toEqual([])
    expect(rankByRelativeStrength(lifts, { bodyWeightKg: 0 })).toEqual([])
  })

  it('descarta marcas vacías', () => {
    const out = rankByRelativeStrength(
      [{ name: 'Sentadilla con barra', best1RMKg: 0 }], { bodyWeightKg: 80 })
    expect(out).toEqual([])
  })

  it('el sexo cambia el nivel para la misma marca', () => {
    const opts = { bodyWeightKg: 70 }
    const h = rankByRelativeStrength([{ name: 'Press de banca con barra', best1RMKg: 70 }], { ...opts, sex: 'Masculino' })
    const m = rankByRelativeStrength([{ name: 'Press de banca con barra', best1RMKg: 70 }], { ...opts, sex: 'Femenino' })
    expect(h[0].ratio).toBe(m[0].ratio)
    expect(LEVELS.indexOf(m[0].level)).toBeGreaterThan(LEVELS.indexOf(h[0].level))
  })
})
