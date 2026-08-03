// La lista de claves es un contrato con tres partes que no se hablan: las
// columnas jsonb de Postgres, la pantalla y el servidor MCP. Se prueba como
// contrato, no como detalle de implementación.

import { describe, it, expect } from 'vitest'
import {
  NUTRIENTS, MICRO_KEYS, NUTRIENT_BY_KEY, CEILINGS, FLOORS,
  sumMicros, addMicros, scaleMicros, sanitizeMicros, nonZeroKeys,
  formatNutrient, scaleFood, round1,
} from './nutrients'

describe('el registro', () => {
  it('son dieciséis nutrientes, sin claves repetidas', () => {
    expect(NUTRIENTS).toHaveLength(16)
    expect(new Set(MICRO_KEYS).size).toBe(16)
  })

  it('las claves son ASCII sin acentos (trampa de normalización en jsonb)', () => {
    for (const key of MICRO_KEYS) expect(key).toMatch(/^[a-z0-9_]+$/)
  })

  it('cada entrada trae unidad, decimales, dirección y máximo válidos', () => {
    for (const n of NUTRIENTS) {
      expect(['g', 'mg', 'mcg']).toContain(n.unit)
      expect(['floor', 'ceiling']).toContain(n.dir)
      expect(n.decimals).toBeGreaterThanOrEqual(0)
      expect(n.max).toBeGreaterThan(0)
      expect(n.label.length).toBeGreaterThan(0)
    }
  })

  it('los techos son exactamente estos cuatro', () => {
    expect(CEILINGS.map(n => n.key)).toEqual(
      ['azucar', 'grasa_saturada', 'sodio', 'colesterol']
    )
    expect(FLOORS).toHaveLength(12)
  })

  it('los techos van primero: son los de etiqueta y los más fiables', () => {
    expect(NUTRIENTS.slice(0, 4).every(n => n.dir === 'ceiling')).toBe(true)
  })
})

describe('sumMicros', () => {
  it('una clave que no aparece en ninguno tampoco aparece en el total', () => {
    const out = sumMicros([{ fibra: 3 }, { sodio: 200 }, {}])
    expect(out).toEqual({ fibra: 3, sodio: 200 })
    expect('calcio' in out).toBe(false)
  })

  it('suma la misma clave a través de varias comidas', () => {
    expect(sumMicros([{ fibra: 3.2 }, { fibra: 1.1 }]).fibra).toBe(4.3)
  })

  it('sin comidas, sin claves', () => {
    expect(sumMicros([])).toEqual({})
    expect(sumMicros(null)).toEqual({})
  })

  it('ignora nulos y claves desconocidas', () => {
    expect(sumMicros([null, { fibra: 2, inventado: 99 }])).toEqual({ fibra: 2 })
  })

  it('redondea con los decimales de cada nutriente', () => {
    // sodio no lleva decimales; la suma de dos flotantes no puede colarlos
    expect(sumMicros([{ sodio: 100.4 }, { sodio: 100.4 }]).sodio).toBe(201)
  })

  it('addMicros es la versión binaria', () => {
    expect(addMicros({ fibra: 2 }, { fibra: 3, sodio: 10 })).toEqual({ fibra: 5, sodio: 10 })
  })
})

describe('scaleMicros', () => {
  it('respeta los decimales del registro', () => {
    // fibra lleva un decimal: 3,33 × 2 es 6,7, no 6,66
    expect(scaleMicros({ fibra: 3.33 }, 2).fibra).toBe(6.7)
    // omega3 lleva dos
    expect(scaleMicros({ omega3: 0.333 }, 2).omega3).toBe(0.67)
  })

  it('lo desconocido sigue desconocido por mucho que se multiplique', () => {
    const out = scaleMicros({ fibra: 3 }, 2)
    expect(out).toEqual({ fibra: 6 })
    expect('sodio' in out).toBe(false)
  })

  it('descarta claves desconocidas en vez de propagarlas', () => {
    expect(scaleMicros({ fibra: 3, inventado: 50 }, 2)).toEqual({ fibra: 6 })
  })

  it('media porción', () => {
    expect(scaleMicros({ sodio: 400, fibra: 5 }, 0.5)).toEqual({ sodio: 200, fibra: 2.5 })
  })

  it('sin objeto devuelve objeto vacío, no explota', () => {
    expect(scaleMicros(null, 2)).toEqual({})
    expect(scaleMicros(undefined, 2)).toEqual({})
  })
})

describe('sanitizeMicros', () => {
  it('descarta los ceros: contar comidas con datos depende de ello', () => {
    expect(sanitizeMicros({ fibra: 0 })).toEqual({})
    expect(sanitizeMicros({ fibra: 0, sodio: 200 })).toEqual({ sodio: 200 })
  })

  it('descarta negativos, NaN, cadenas y claves desconocidas', () => {
    expect(sanitizeMicros({
      fibra: -3, sodio: NaN, calcio: 'mucho', inventado: 10, hierro: 8,
    })).toEqual({ hierro: 8 })
  })

  it('recorta al máximo plausible', () => {
    expect(sanitizeMicros({ sodio: 999999 }).sodio).toBe(30000)
  })

  it('no acepta arrays ni primitivos donde debería haber un objeto', () => {
    expect(sanitizeMicros([1, 2, 3])).toEqual({})
    expect(sanitizeMicros('fibra')).toEqual({})
    expect(sanitizeMicros(null)).toEqual({})
  })

  it('convierte números que llegan como texto (los inputs devuelven strings)', () => {
    expect(sanitizeMicros({ fibra: '3.5' })).toEqual({ fibra: 3.5 })
  })
})

describe('nonZeroKeys', () => {
  it('devuelve en el orden del registro, no en el de inserción', () => {
    expect(nonZeroKeys({ hierro: 8, azucar: 2, fibra: 3 })).toEqual(['azucar', 'fibra', 'hierro'])
  })

  it('omite los ceros y aguanta la ausencia', () => {
    expect(nonZeroKeys({ fibra: 0, sodio: 5 })).toEqual(['sodio'])
    expect(nonZeroKeys(null)).toEqual([])
  })
})

describe('formatNutrient', () => {
  it('pone la unidad del registro', () => {
    expect(formatNutrient('sodio', 1240, 'es-CO')).toBe('1.240 mg')
  })

  it('no inventa decimales donde no los hay', () => {
    expect(formatNutrient('sodio', 1240.7, 'es-CO')).toBe('1.241 mg')
  })

  it('conserva los que sí hay', () => {
    expect(formatNutrient('omega3', 1.6, 'es-CO')).toBe('1,6 g')
  })
})

describe('scaleFood', () => {
  const base = { kcal: 200, protein_g: 10, carbs_g: 30.5, fat_g: 4, micros: { fibra: 3, sodio: 400 } }

  it('escala macros y micros a la vez', () => {
    expect(scaleFood(base, 2)).toEqual({
      kcal: 400, protein_g: 20, carbs_g: 61, fat_g: 8,
      micros: { fibra: 6, sodio: 800 },
    })
  })

  it('kcal entero, macros a un decimal', () => {
    const out = scaleFood(base, 0.33)
    expect(Number.isInteger(out.kcal)).toBe(true)
    expect(out.protein_g).toBe(3.3)
  })

  it('una comida sin micros sigue sin micros', () => {
    expect(scaleFood({ kcal: 100 }, 2).micros).toEqual({})
  })

  it('round1 redondea a un decimal', () => {
    expect(round1(3.333)).toBe(3.3)
    expect(round1(3.35)).toBe(3.4)
  })
})
