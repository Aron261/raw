
// Recorrido en inglés: lo que se ve de punta a punta, no solo el diccionario.
import { describe, it, expect } from 'vitest'
import { translate, localeFor } from './i18n'
import { monthLabel, weekRangeLabel, longDate } from './calendar'
import { compareSet, formatDelta, describeDelta } from './progress'

const en = (k, v) => translate('en', k, v)
const L = localeFor('en')

describe('la app en inglés', () => {
  it('traduce la portada', () => {
    expect(en('Esta semana')).toBe('This week')
    expect(en('entrenos')).toBe('workouts')
    expect(en('días este mes')).toBe('days this month')
    expect(en('Empezar entreno')).toBe('Start workout')
  })

  it('traduce el veredicto de una serie', () => {
    const c = compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 77.5 })
    expect(formatDelta(c, 'kg', en, L)).toBe('+2.5 kg')
    expect(describeDelta(c, 'kg', en, L)).toBe('2.5 kg more than last time')
    expect(en('vs. la vez anterior')).toBe('vs. last time')
  })

  it('los números siguen al idioma, no solo las palabras', () => {
    // En español es "2,5"; en inglés "2.5". Si el locale no viajara, una app
    // en inglés escribiría los decimales con coma.
    const c = compareSet({ reps: 5, weight: 80 }, { reps: 5, weight: 77.5 })
    expect(formatDelta(c, 'kg', (x) => x, 'es-CO')).toBe('+2,5 kg')
    expect(formatDelta(c, 'kg', en, L)).toBe('+2.5 kg')
  })

  it('las fechas también', () => {
    expect(monthLabel(2026, 6, 'es-CO')).toMatch(/julio/i)
    expect(monthLabel(2026, 6, L)).toMatch(/July/i)
    expect(longDate(new Date(2026, 6, 21), L)).toMatch(/July/i)
  })

  it('el rango de semana no deja "de" suelto en inglés', () => {
    // Traducir solo el nombre del mes dejaba "13 – 19 de July".
    const d = new Date(2026, 6, 15)
    expect(weekRangeLabel(d, 'es-CO')).toMatch(/ de /)
    expect(weekRangeLabel(d, L)).not.toMatch(/ de /)
    expect(weekRangeLabel(d, L)).toMatch(/July/i)
  })

  it('traduce Rutinas y Nutrición', () => {
    expect(en('Ciclos y plantillas')).toBe('Cycles and templates')
    expect(en('Rutina de un día')).toBe('One-day routine')
    expect(en('Crear ciclo')).toBe('Create cycle')
    expect(en('Registra tu primera comida')).toBe('Log your first meal')
    expect(en('Objetivos diarios')).toBe('Daily targets')
    expect(en('Hoy')).toBe('Today')
    expect(en('Ayer')).toBe('Yesterday')
  })

  it('el plural funciona en las dos formas', () => {
    expect(en('entreno')).toBe('workout')
    expect(en('entrenos')).toBe('workouts')
    expect(en('semana')).toBe('week')
    expect(en('semanas')).toBe('weeks')
  })
})
