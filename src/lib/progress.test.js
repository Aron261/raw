// La única parte de la app que decide si progresaste. Si se equivoca, miente
// sobre el entrenamiento de alguien — así que se prueba sola y a conciencia.

import { describe, it, expect } from 'vitest'
import { calc1RM, calc1RMKg, convertWeight, compareSet, formatDelta, describeDelta } from './progress'

describe('calc1RM (Epley)', () => {
  it('a una repetición el 1RM es el peso', () => {
    expect(calc1RM(100, 1)).toBe(100)
  })

  it('estima por encima con más repeticiones', () => {
    expect(calc1RM(100, 5)).toBeCloseTo(116.7, 1)
  })

  it('no devuelve NaN con basura', () => {
    expect(calc1RM(undefined, undefined)).toBe(0)
    expect(calc1RM(100, 0)).toBe(0)
    expect(calc1RM(100, -3)).toBe(0)
  })
})

describe('compareSet — el eje lo elige lo que cambió', () => {
  it('mismas reps: manda el peso', () => {
    const c = compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 77.5 })
    expect(c).toEqual({ verdict: 'beat', axis: 'weight', delta: 2.5 })
    expect(formatDelta(c, 'kg')).toBe('+2,5 kg')
  })

  it('mismo peso: mandan las reps', () => {
    const c = compareSet({ reps: 8, weight: 60 }, { reps: 6, weight: 60 })
    expect(c).toEqual({ verdict: 'beat', axis: 'reps', delta: 2 })
    expect(formatDelta(c, 'kg')).toBe('+2 reps')
  })

  it('idénticas: la igualaste', () => {
    const c = compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 80 })
    expect(c.verdict).toBe('matched')
    expect(formatDelta(c, 'kg')).toBe('=')
  })

  it('quedarse corto se dice, no se esconde', () => {
    const c = compareSet({ reps: 5, weight: 70 }, { reps: 5, weight: 80 })
    expect(c.verdict).toBe('short')
    expect(formatDelta(c, 'kg')).toBe('−10 kg')
  })

  it('singular de rep', () => {
    const c = compareSet({ reps: 6, weight: 60 }, { reps: 5, weight: 60 })
    expect(formatDelta(c, 'kg')).toBe('+1 rep')
  })
})

describe('compareSet — cuando se mueven las dos', () => {
  it('más peso y menos reps: decide el 1RM estimado', () => {
    // 80×5 → 1RM 93,3 · 85×3 → 1RM 93,5. Subir el peso bajando reps apenas
    // movió la aguja, y decir "+5 kg" sería mentir sobre el progreso.
    const c = compareSet({ reps: 3, weight: 85 }, { reps: 5, weight: 80 })
    expect(c.axis).toBe('e1rm')
    expect(c.verdict).toBe('beat')
    expect(formatDelta(c, 'kg')).toBe('+0,2 kg 1RM')
  })

  it('bajar mucho el peso por dos reps más es quedarse corto', () => {
    const c = compareSet({ reps: 7, weight: 60 }, { reps: 5, weight: 80 })
    expect(c.axis).toBe('e1rm')
    expect(c.verdict).toBe('short')
  })
})

describe('compareSet — cuándo callarse', () => {
  it('sin serie anterior no se inventa un veredicto', () => {
    expect(compareSet({ reps: 5, weight: 80 }, null)).toBeNull()
    expect(compareSet(null, { reps: 5, weight: 80 })).toBeNull()
  })

  it('sin reps no hay serie que comparar', () => {
    expect(compareSet({ reps: 0, weight: 80 }, { reps: 5, weight: 80 })).toBeNull()
    expect(compareSet({ reps: '', weight: '' }, { reps: 5, weight: 80 })).toBeNull()
  })
})

describe('compareSet — peso corporal', () => {
  it('dominadas a peso 0 se comparan por reps, no se descartan', () => {
    // weight 0 es un valor legítimo (dominadas, fondos, abdominales); si el
    // guard lo tratara como vacío, media sesión se quedaría sin comparación.
    const c = compareSet({ reps: 12, weight: 0 }, { reps: 10, weight: 0 })
    expect(c).toEqual({ verdict: 'beat', axis: 'reps', delta: 2 })
  })
})

describe('describeDelta — lo que se oye', () => {
  it('dice el veredicto con palabras, no con el signo', () => {
    // El color y el "+" no llegan a quien usa lector de pantalla.
    expect(describeDelta(compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 77.5 }), 'kg'))
      .toBe('2,5 kg más que la vez anterior')
    expect(describeDelta(compareSet({ reps: 5, weight: 70 }, { reps: 5, weight: 80 }), 'kg'))
      .toBe('10 kg menos que la vez anterior')
    expect(describeDelta(compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 80 }), 'kg'))
      .toBe('Igual que la vez anterior')
  })

  it('respeta la unidad del ejercicio', () => {
    expect(describeDelta(compareSet({ reps: 5, weight: 180 }, { reps: 5, weight: 175 }), 'lb'))
      .toBe('5 lb más que la vez anterior')
  })
})

describe('unidades — el récord no depende de la unidad en que se escribió', () => {
  // 100 lb son ~45 kg: si el 1RM se compara sin convertir, 100 lb "gana" a
  // 90 kg y la app celebra un récord falso — o calla uno real. La señal
  // central de la app deja de ser confiable en cuanto alguien toca el toggle.
  it('calc1RMKg normaliza antes de estimar', () => {
    expect(calc1RMKg(100, 1, 'lb')).toBeCloseTo(45.36, 1)
    expect(calc1RMKg(100, 1, 'kg')).toBe(100)
    expect(calc1RMKg(100, 1, 'lb')).toBeLessThan(calc1RMKg(90, 1, 'kg'))
  })

  it('convertWeight pasa el peso de la vez anterior a la unidad actual', () => {
    expect(convertWeight(100, 'lb', 'kg')).toBeCloseTo(45.4, 1)
    expect(convertWeight(45.4, 'kg', 'lb')).toBeCloseTo(100.1, 1)
    expect(convertWeight(80, 'kg', 'kg')).toBe(80)
    expect(convertWeight(80, null, 'kg')).toBe(80)
  })

  it('comparar contra una sesión en otra unidad no miente', () => {
    // Hoy 60 kg × 5; la vez pasada 100 lb (≈45,4 kg) × 5 → superada por ~14,6 kg.
    const prev = { reps: 5, weight: convertWeight(100, 'lb', 'kg') }
    const c = compareSet({ reps: 5, weight: 60 }, prev)
    expect(c.verdict).toBe('beat')
    expect(c.axis).toBe('weight')
    expect(c.delta).toBeCloseTo(14.6, 1)
  })
})
