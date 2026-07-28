import { describe, it, expect } from 'vitest'
import { formatVolume, formatCount } from './format'

describe('formatVolume', () => {
  it('redondea: la conversión de libras no llega a pantalla', () => {
    // 140 lb × 8 reps convertidos a kilos dan 507,6230…
    expect(formatVolume(3195.782, 'es-CO')).toBe('3.196')
    expect(formatVolume(3195.782, 'en-US')).toBe('3,196')
  })

  it('sigue al locale en los miles y en los decimales', () => {
    expect(formatVolume(5535.32, 'es-CO')).toBe('5.535')
    expect(formatVolume(5535.32, 'en-US')).toBe('5,535')
    // Por encima de 10k manda el orden de magnitud, con su coma o su punto.
    expect(formatVolume(136900, 'es-CO')).toBe('136,9k')
    expect(formatVolume(136900, 'en-US')).toBe('136.9k')
  })

  it('deja elegir qué se pinta cuando no hay nada', () => {
    expect(formatVolume(0, 'es-CO')).toBe('—')
    expect(formatVolume(0, 'es-CO', { empty: '0' })).toBe('0')
    expect(formatVolume(null, 'es-CO')).toBe('—')
  })
})

describe('formatCount', () => {
  it('nunca lleva decimales', () => {
    expect(formatCount(387, 'es-CO')).toBe('387')
    expect(formatCount(1234, 'es-CO')).toBe('1.234')
    expect(formatCount(0, 'es-CO')).toBe('0')
  })
})
