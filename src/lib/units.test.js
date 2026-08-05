import { describe, it, expect } from 'vitest'
import { defaultLiftUnit } from './units'

describe('defaultLiftUnit', () => {
  it('quien se pesa en libras arranca en libras', () => {
    expect(defaultLiftUnit({ weight_unit: 'lb' })).toBe('lb')
  })

  it('quien se pesa en kilos arranca en kilos', () => {
    expect(defaultLiftUnit({ weight_unit: 'kg' })).toBe('kg')
  })

  // Antes era 'lb' en una app es-CO: cada ejercicio nuevo nacía en la unidad
  // equivocada y había que cambiarla a mano.
  it('sin perfil todavía cargado, kilo', () => {
    expect(defaultLiftUnit(null)).toBe('kg')
    expect(defaultLiftUnit(undefined)).toBe('kg')
    expect(defaultLiftUnit({})).toBe('kg')
  })

  it('un valor raro no se propaga a la base', () => {
    expect(defaultLiftUnit({ weight_unit: 'stone' })).toBe('kg')
  })
})
