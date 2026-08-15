import { describe, it, expect } from 'vitest'
import { weeklyActivity, consistency, adherence, progression, workoutVolume } from './statsAnalysis'

// 15 de agosto de 2026 es sábado; el lunes de esa semana es el 10.
const NOW = new Date('2026-08-15T12:00:00')

const w = (date, exercises = [{ name: 'Sentadilla', sets: [{ weight: 100, reps: 5 }] }], unit = 'kg') => ({
  started_at: `${date}T10:00:00`,
  ended_at: `${date}T11:00:00`,
  workout_exercises: exercises.map(e => ({
    unit: e.unit || unit,
    exercises: { name: e.name },
    sets: e.sets,
  })),
})

describe('workoutVolume', () => {
  it('suma peso × reps en kilos', () => {
    expect(workoutVolume(w('2026-08-10'))).toBe(500)
  })

  it('convierte las libras antes de sumar', () => {
    const vol = workoutVolume(w('2026-08-10', [{ name: 'A', sets: [{ weight: 100, reps: 1 }] }], 'lb'))
    expect(vol).toBeCloseTo(45.36, 1)
  })
})

describe('weeklyActivity', () => {
  it('agrupa por semana empezando en lunes', () => {
    const out = weeklyActivity([
      w('2026-08-10'),  // lunes de esta semana
      w('2026-08-15'),  // sábado de esta semana
      w('2026-08-09'),  // domingo de la anterior
    ], { weeks: 4, now: NOW })

    expect(out).toHaveLength(4)
    expect(out[3].sessions).toBe(2)   // semana en curso
    expect(out[3].current).toBe(true)
    expect(out[2].sessions).toBe(1)
  })

  it('deja en cero las semanas sin entrenos en vez de omitirlas', () => {
    const out = weeklyActivity([w('2026-08-10')], { weeks: 4, now: NOW })
    expect(out.map(b => b.sessions)).toEqual([0, 0, 0, 1])
  })

  it('ignora los entrenos sin terminar', () => {
    const open = { started_at: '2026-08-11T10:00:00', ended_at: null, workout_exercises: [] }
    const out = weeklyActivity([open], { weeks: 2, now: NOW })
    expect(out[1].sessions).toBe(0)
  })
})

describe('consistency', () => {
  it('compara las 4 semanas anteriores con las 4 previas', () => {
    const workouts = [
      // Ventana reciente (13 jul – 9 ago): 4 entrenos
      w('2026-07-14'), w('2026-07-21'), w('2026-07-28'), w('2026-08-04'),
      // Ventana previa (15 jun – 12 jul): 2 entrenos
      w('2026-06-16'), w('2026-06-23'),
    ]
    const c = consistency(workouts, { now: NOW })
    expect(c.last4).toBe(4)
    expect(c.prev4).toBe(2)
    expect(c.perWeek).toBe(1)
    expect(c.deltaPerWeek).toBe(100)
  })

  it('deja la semana en curso fuera de las ventanas', () => {
    // Un entreno de esta misma semana no puede contar en «últimas 4 semanas»:
    // la semana está a medias y bajaría el promedio cada lunes.
    const c = consistency([w('2026-08-11')], { now: NOW })
    expect(c.last4).toBe(0)
  })

  it('sin ventana previa no inventa un porcentaje', () => {
    const c = consistency([w('2026-08-04')], { now: NOW })
    expect(c.prev4).toBe(0)
    expect(c.deltaPerWeek).toBeNull()
  })

  it('cuenta la racha de semanas seguidas', () => {
    const c = consistency([
      w('2026-08-11'), // semana en curso
      w('2026-08-04'),
      w('2026-07-28'),
    ], { now: NOW })
    expect(c.streakWeeks).toBe(3)
  })

  it('una semana en curso vacía no rompe la racha todavía', () => {
    const c = consistency([w('2026-08-04'), w('2026-07-28')], { now: NOW })
    expect(c.streakWeeks).toBe(2)
  })

  it('mide el hueco más largo y los días desde el último', () => {
    const c = consistency([w('2026-07-01'), w('2026-07-20'), w('2026-08-10')], { now: NOW })
    expect(c.longestGapDays).toBe(21)
    expect(c.daysSinceLast).toBe(5)
  })

  it('sin entrenos no revienta', () => {
    const c = consistency([], { now: NOW })
    expect(c.last4).toBe(0)
    expect(c.daysSinceLast).toBeNull()
    expect(c.longestGapDays).toBe(0)
  })
})

describe('adherence', () => {
  const S = (date, kind, status) => ({ date, kind, status })

  it('cuenta lo cumplido sobre lo planeado ya vencido', () => {
    const a = adherence([
      S('2026-08-10', 'strength', 'done'),
      S('2026-08-11', 'strength', 'planned'),
      S('2026-08-12', 'cardio', 'done'),
      S('2026-08-13', 'strength', 'skipped'),
    ], { now: NOW })
    expect(a.planned).toBe(4)
    expect(a.done).toBe(2)
    expect(a.pct).toBe(50)
  })

  it('no cuenta los planes futuros', () => {
    // Planear el resto del mes no puede empeorar la adherencia de hoy.
    const a = adherence([
      S('2026-08-10', 'strength', 'done'),
      S('2026-08-20', 'strength', 'planned'),
      S('2026-08-25', 'strength', 'planned'),
    ], { now: NOW })
    expect(a.planned).toBe(1)
    expect(a.pct).toBe(100)
  })

  it('descanso y notas no son tareas que se cumplan', () => {
    const a = adherence([
      S('2026-08-10', 'strength', 'done'),
      S('2026-08-11', 'rest', 'planned'),
      S('2026-08-12', 'note', 'planned'),
    ], { now: NOW })
    expect(a.planned).toBe(1)
  })

  it('sin nada planeado devuelve null, no un 0 %', () => {
    expect(adherence([], { now: NOW })).toBeNull()
  })
})

describe('progression', () => {
  it('compara la ventana reciente con la anterior', () => {
    const out = progression([
      // Ventana previa (8-16 semanas atrás)
      w('2026-05-20', [{ name: 'Sentadilla', sets: [{ weight: 100, reps: 5 }] }]),
      // Ventana reciente (últimas 8 semanas)
      w('2026-08-05', [{ name: 'Sentadilla', sets: [{ weight: 110, reps: 5 }] }]),
    ], { now: NOW })

    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Sentadilla')
    expect(out[0].deltaPct).toBe(10)
    expect(out[0].status).toBe('up')
  })

  it('marca estancado lo que no se movió', () => {
    const out = progression([
      w('2026-05-20', [{ name: 'Press banca', sets: [{ weight: 80, reps: 5 }] }]),
      w('2026-08-05', [{ name: 'Press banca', sets: [{ weight: 80, reps: 5 }] }]),
    ], { now: NOW })
    expect(out[0].deltaPct).toBe(0)
    expect(out[0].status).toBe('flat')
  })

  it('marca bajada cuando retrocede', () => {
    const out = progression([
      w('2026-05-20', [{ name: 'Remo', sets: [{ weight: 100, reps: 5 }] }]),
      w('2026-08-05', [{ name: 'Remo', sets: [{ weight: 80, reps: 5 }] }]),
    ], { now: NOW })
    expect(out[0].status).toBe('down')
    expect(out[0].deltaPct).toBe(-20)
  })

  it('excluye los ejercicios sin marca en las dos ventanas', () => {
    // Empezado el mes pasado: no es que suba un 100 %, es que no hay contra
    // qué compararlo.
    const out = progression([
      w('2026-08-05', [{ name: 'Nuevo', sets: [{ weight: 60, reps: 5 }] }]),
    ], { now: NOW })
    expect(out).toEqual([])
  })

  it('compara en kilos aunque las series vengan en libras', () => {
    const out = progression([
      w('2026-05-20', [{ name: 'Peso muerto', sets: [{ weight: 100, reps: 1 }] }], 'kg'),
      // 242,5 lb ≈ 110 kg: es una subida, no una bajada de 100 a 242.
      w('2026-08-05', [{ name: 'Peso muerto', sets: [{ weight: 242.5, reps: 1 }] }], 'lb'),
    ], { now: NOW })
    expect(out[0].status).toBe('up')
    expect(out[0].deltaPct).toBe(10)
    expect(out[0].unit).toBe('lb')      // se pinta como se levantó
  })

  it('ordena de mayor a menor progreso', () => {
    const out = progression([
      w('2026-05-20', [
        { name: 'A', sets: [{ weight: 100, reps: 1 }] },
        { name: 'B', sets: [{ weight: 100, reps: 1 }] },
      ]),
      w('2026-08-05', [
        { name: 'A', sets: [{ weight: 105, reps: 1 }] },
        { name: 'B', sets: [{ weight: 120, reps: 1 }] },
      ]),
    ], { now: NOW })
    expect(out.map(x => x.name)).toEqual(['B', 'A'])
  })
})
