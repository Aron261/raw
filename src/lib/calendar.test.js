import { describe, it, expect } from 'vitest'
import {
  mondayOf, weekKey, monthMatrix, computeStreak, toLocalISODate,
  weekDays, weekRangeLabel,
} from './calendar'

// Entreno terminado en una fecha local dada.
const done = (iso) => ({ started_at: `${iso}T10:00:00`, ended_at: `${iso}T11:00:00` })

describe('mondayOf / weekKey', () => {
  it('lleva cualquier día a su lunes', () => {
    // 2026-07-21 es martes → lunes 2026-07-20
    expect(toLocalISODate(mondayOf(new Date(2026, 6, 21)))).toBe('2026-07-20')
    // El domingo pertenece a la semana que empezó el lunes anterior
    expect(toLocalISODate(mondayOf(new Date(2026, 6, 26)))).toBe('2026-07-20')
    // Un lunes se queda donde está
    expect(toLocalISODate(mondayOf(new Date(2026, 6, 20)))).toBe('2026-07-20')
  })

  it('agrupa la semana bajo una sola clave', () => {
    expect(weekKey(new Date(2026, 6, 20))).toBe(weekKey(new Date(2026, 6, 26)))
    expect(weekKey(new Date(2026, 6, 26))).not.toBe(weekKey(new Date(2026, 6, 27)))
  })
})

describe('monthMatrix', () => {
  it('devuelve 42 celdas empezando en lunes', () => {
    const cells = monthMatrix(2026, 6) // julio 2026
    expect(cells).toHaveLength(42)
    expect(cells[0].getDay()).toBe(1) // lunes
    // Julio 2026 empieza en miércoles → la rejilla arranca el lunes 29 de junio
    expect(toLocalISODate(cells[0])).toBe('2026-06-29')
    expect(cells.some(d => toLocalISODate(d) === '2026-07-01')).toBe(true)
    expect(cells.some(d => toLocalISODate(d) === '2026-07-31')).toBe(true)
  })
})

describe('weekDays / weekRangeLabel', () => {
  it('devuelve los 7 días de lunes a domingo', () => {
    const days = weekDays(new Date(2026, 6, 23)) // jueves
    expect(days.map(toLocalISODate)).toEqual([
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23',
      '2026-07-24', '2026-07-25', '2026-07-26',
    ])
  })

  it('etiqueta la semana, nombrando ambos meses cuando cruza', () => {
    expect(weekRangeLabel(new Date(2026, 6, 23))).toBe('20 – 26 de julio')
    // Semana del 27 jul al 2 ago
    expect(weekRangeLabel(new Date(2026, 6, 30))).toBe('27 de julio – 2 de agosto')
  })
})

describe('computeStreak', () => {
  const now = new Date(2026, 6, 21) // martes 21 jul 2026, semana del lunes 20

  it('sin entrenos, no hay racha', () => {
    expect(computeStreak([], now)).toBe(0)
  })

  it('cuenta semanas seguidas hacia atrás', () => {
    const workouts = [done('2026-07-21'), done('2026-07-14'), done('2026-07-07')]
    expect(computeStreak(workouts, now)).toBe(3)
  })

  it('una semana en curso sin entrenar todavía no rompe la racha', () => {
    const workouts = [done('2026-07-14'), done('2026-07-07')]
    expect(computeStreak(workouts, now)).toBe(2)
  })

  it('un hueco de una semana corta la racha', () => {
    // Nada en la semana del 13; sí en la del 6 → la racha ya está muerta
    const workouts = [done('2026-07-06'), done('2026-06-29')]
    expect(computeStreak(workouts, now)).toBe(0)
  })

  it('ignora entrenos sin terminar', () => {
    const workouts = [{ started_at: '2026-07-21T10:00:00', ended_at: null }]
    expect(computeStreak(workouts, now)).toBe(0)
  })

  it('varios entrenos en la misma semana cuentan una vez', () => {
    const workouts = [done('2026-07-20'), done('2026-07-21'), done('2026-07-22')]
    expect(computeStreak(workouts, now)).toBe(1)
  })
})
