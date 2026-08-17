import { describe, it, expect } from 'vitest'
import {
  progressPct, computePace, computeGoalProgress, computeGoals, isRecurring,
  groupGoals,
} from './goals'

// Un entreno terminado con una sola serie del ejercicio dado.
const workout = (date, exercise, sets, unit = 'kg') => ({
  started_at: `${date}T10:00:00.000Z`,
  ended_at: `${date}T11:00:00.000Z`,
  workout_exercises: [{ unit, exercises: { name: exercise }, sets }],
})

describe('progressPct', () => {
  it('mide desde el inicio, no desde cero', () => {
    // El bug que motivó start_value: 90 → 100 marcaba 90 % el primer día.
    expect(progressPct(90, 100, 90)).toBe(0)
    expect(progressPct(95, 100, 90)).toBe(50)
    expect(progressPct(100, 100, 90)).toBe(100)
  })

  it('sin inicio se comporta como antes (desde cero)', () => {
    expect(progressPct(90, 100, null)).toBe(90)
  })

  it('funciona hacia abajo (peso corporal)', () => {
    expect(progressPct(82, 76, 82)).toBe(0)
    expect(progressPct(79, 76, 82)).toBe(50)
    expect(progressPct(76, 76, 82)).toBe(100)
    expect(progressPct(74, 76, 82)).toBe(100) // pasarse no es más del 100 %
  })

  it('no baja de 0 ni pasa de 100', () => {
    expect(progressPct(85, 100, 90)).toBe(0)   // retrocediste
    expect(progressPct(120, 100, 90)).toBe(100)
  })

  it('objetivo igual al inicio no divide por cero', () => {
    expect(progressPct(90, 90, 90)).toBe(100)
    expect(progressPct(80, 90, 90)).toBe(0)
  })
})

describe('computePace', () => {
  const now = new Date('2026-08-15T12:00:00')

  it('sin fecha objetivo no hay ritmo', () => {
    expect(computePace({ created_at: '2026-08-01' }, 50, now)).toBeNull()
  })

  it('a mitad de plazo con la mitad hecha va a tiempo', () => {
    const pace = computePace(
      { created_at: '2026-08-01T00:00:00', target_date: '2026-08-29' }, 50, now
    )
    expect(pace.expectedPct).toBe(50)
    expect(pace.onTrack).toBe(true)
    expect(pace.daysLeft).toBe(14)
  })

  it('a mitad de plazo con un 10 % hecho va atrasado', () => {
    const pace = computePace(
      { created_at: '2026-08-01T00:00:00', target_date: '2026-08-29' }, 10, now
    )
    expect(pace.onTrack).toBe(false)
    expect(pace.overdue).toBe(false)
  })

  it('marca fuera de plazo cuando la fecha pasó sin cumplirse', () => {
    const pace = computePace(
      { created_at: '2026-07-01T00:00:00', target_date: '2026-08-10' }, 80, now
    )
    expect(pace.daysLeft).toBeLessThan(0)
    expect(pace.overdue).toBe(true)
  })

  it('cumplida no está fuera de plazo aunque la fecha pasara', () => {
    const pace = computePace(
      { created_at: '2026-07-01T00:00:00', target_date: '2026-08-10' }, 100, now
    )
    expect(pace.overdue).toBe(false)
  })
})

describe('computeGoalProgress — exercise_weight', () => {
  const workouts = [
    workout('2026-08-01', 'Sentadilla', [{ weight: 90, reps: 5 }]),
    workout('2026-08-08', 'Sentadilla', [{ weight: 95, reps: 5 }]),
  ]

  it('usa el 1RM estimado cuando no hay reps objetivo', () => {
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 120, unit: 'kg' },
      { workouts }
    )
    // Epley sobre 95×5 ≈ 110,8
    expect(g.current).toBeCloseTo(110.8, 1)
    expect(g.pct).toBe(92)
  })

  it('con reps objetivo exige el peso real a esas reps', () => {
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 100, target_reps: 5, unit: 'kg' },
      { workouts }
    )
    expect(g.current).toBe(95)
  })

  it('ignora las series que no llegan a las reps objetivo', () => {
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 100, target_reps: 8, unit: 'kg' },
      { workouts }
    )
    expect(g.current).toBe(0)
  })

  it('compara en la unidad de la meta, no en la del entreno', () => {
    // El bug de unidades: la meta está en libras y la serie en kilos.
    // 100 kg ≈ 220,5 lb, no "100".
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Peso muerto', target_value: 315, target_reps: 1, unit: 'lb' },
      { workouts: [workout('2026-08-01', 'Peso muerto', [{ weight: 100, reps: 1 }], 'kg')] }
    )
    expect(g.current).toBeCloseTo(220.5, 0)
  })

  it('no cuenta entrenos sin terminar', () => {
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 200, target_reps: 1, unit: 'kg' },
      { workouts: [{ started_at: '2026-08-10T10:00:00Z', ended_at: null, workout_exercises: [
        { unit: 'kg', exercises: { name: 'Sentadilla' }, sets: [{ weight: 180, reps: 1 }] },
      ] }] }
    )
    expect(g.current).toBe(0)
  })

  it('mide el tramo propuesto cuando hay start_value', () => {
    const g = computeGoalProgress(
      { type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 100, target_reps: 5, unit: 'kg', start_value: 90 },
      { workouts }
    )
    expect(g.current).toBe(95)
    expect(g.pct).toBe(50)      // sin start_value habría dicho 95 %
    expect(g.remaining).toBe(5)
  })
})

describe('computeGoalProgress — días y sesiones', () => {
  const now = new Date('2026-08-15T12:00:00') // sábado

  it('days_trained cuenta días distintos, no entrenos', () => {
    const g = computeGoalProgress(
      { type: 'days_trained', target_value: 20, unit: 'días' },
      {
        workouts: [
          workout('2026-08-03', 'A', [{ weight: 50, reps: 5 }]),
          // Dos sesiones el mismo día: es UN día entrenado.
          workout('2026-08-04', 'A', [{ weight: 50, reps: 5 }]),
          workout('2026-08-04', 'B', [{ weight: 50, reps: 5 }]),
        ],
        now,
      }
    )
    expect(g.current).toBe(2)
  })

  it('days_trained ignora otros meses', () => {
    const g = computeGoalProgress(
      { type: 'days_trained', target_value: 20, unit: 'días' },
      {
        workouts: [
          workout('2026-07-30', 'A', [{ weight: 50, reps: 5 }]),
          workout('2026-08-04', 'A', [{ weight: 50, reps: 5 }]),
        ],
        now,
      }
    )
    expect(g.current).toBe(1)
  })

  it('sessions_per_week cuenta solo desde el lunes', () => {
    const g = computeGoalProgress(
      { type: 'sessions_per_week', target_value: 4, unit: 'días' },
      {
        workouts: [
          workout('2026-08-09', 'A', [{ weight: 50, reps: 5 }]), // domingo anterior
          workout('2026-08-10', 'A', [{ weight: 50, reps: 5 }]), // lunes
          workout('2026-08-12', 'A', [{ weight: 50, reps: 5 }]),
        ],
        now,
      }
    )
    expect(g.current).toBe(2)
    expect(g.pct).toBe(50)
  })

  it('las metas recurrentes se reconocen como tales', () => {
    expect(isRecurring({ type: 'sessions_per_week' })).toBe(true)
    expect(isRecurring({ type: 'days_trained' })).toBe(true)
    expect(isRecurring({ type: 'exercise_weight' })).toBe(false)
  })
})

describe('computeGoalProgress — body_weight', () => {
  const logs = [
    { weight: 82, unit: 'kg', logged_at: '2026-07-01T08:00:00Z' },
    { weight: 79, unit: 'kg', logged_at: '2026-08-10T08:00:00Z' },
  ]

  it('mide una bajada desde el inicio guardado', () => {
    const g = computeGoalProgress(
      { type: 'body_weight', target_value: 76, unit: 'kg', start_value: 82 },
      { bodyWeightLogs: logs }
    )
    expect(g.current).toBe(79)
    expect(g.pct).toBe(50)
    expect(g.remaining).toBe(3)
  })

  it('mide una subida igual de bien', () => {
    const g = computeGoalProgress(
      { type: 'body_weight', target_value: 85, unit: 'kg', start_value: 79 },
      { bodyWeightLogs: [{ weight: 82, unit: 'kg', logged_at: '2026-08-10T08:00:00Z' }] }
    )
    expect(g.pct).toBe(50)
  })

  it('sin start_value deduce el registro anterior a la meta', () => {
    const g = computeGoalProgress(
      { type: 'body_weight', target_value: 76, unit: 'kg', created_at: '2026-07-15T00:00:00Z' },
      { bodyWeightLogs: logs }
    )
    expect(g.start).toBe(82)
    expect(g.pct).toBe(50)
  })

  it('convierte la báscula a la unidad de la meta', () => {
    const g = computeGoalProgress(
      { type: 'body_weight', target_value: 165, unit: 'lb', start_value: 180 },
      { bodyWeightLogs: [{ weight: 80, unit: 'kg', logged_at: '2026-08-10T08:00:00Z' }] }
    )
    expect(g.current).toBeCloseTo(176.4, 0)
  })

  it('sin báscula se queda en 0 %, no en "ya cumplida"', () => {
    const g = computeGoalProgress(
      { type: 'body_weight', target_value: 76, unit: 'kg', start_value: 82 },
      { bodyWeightLogs: [] }
    )
    expect(g.pct).toBe(0)
  })
})

describe('computeGoals', () => {
  it('deja lo pendiente primero y lo más cerca de caer arriba', () => {
    const goals = [
      { id: 'a', type: 'days_trained', target_value: 10, unit: 'días' },
      { id: 'b', type: 'days_trained', target_value: 4,  unit: 'días' },
      { id: 'c', type: 'days_trained', target_value: 100, unit: 'días' },
    ]
    const out = computeGoals(goals, {
      workouts: [
        workout('2026-08-03', 'A', [{ weight: 50, reps: 5 }]),
        workout('2026-08-04', 'A', [{ weight: 50, reps: 5 }]),
        workout('2026-08-05', 'A', [{ weight: 50, reps: 5 }]),
        workout('2026-08-06', 'A', [{ weight: 50, reps: 5 }]),
      ],
      now: new Date('2026-08-15T12:00:00'),
    })
    // 'b' está cumplida (4/4) y se va al final; entre las pendientes manda 'a'
    // (40 %) sobre 'c' (4 %).
    expect(out.map(g => g.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('groupGoals', () => {
  const ctx = {
    workouts: [workout('2026-08-10', 'Sentadilla', [{ weight: 95, reps: 5 }])],
    bodyWeightLogs: [{ weight: 79, unit: 'kg', logged_at: '2026-08-10T08:00:00Z' }],
    now: new Date('2026-08-15T12:00:00'),
  }

  it('separa fuerza, cuerpo y constancia, en ese orden', () => {
    const out = groupGoals([
      { id: 'c', type: 'sessions_per_week', target_value: 4, unit: 'días' },
      { id: 'b', type: 'body_weight', target_value: 76, unit: 'kg', start_value: 82 },
      { id: 'a', type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 100, target_reps: 5, unit: 'kg' },
    ], ctx)

    expect(out.map(g => g.kind)).toEqual(['strength', 'body', 'consistency'])
    expect(out.map(g => g.goals.map(x => x.id))).toEqual([['a'], ['b'], ['c']])
  })

  it('no devuelve grupos vacíos', () => {
    const out = groupGoals([
      { id: 'a', type: 'exercise_weight', exercise_name: 'Sentadilla', target_value: 100, target_reps: 5, unit: 'kg' },
    ], ctx)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('strength')
  })

  it('las mensuales y las semanales caen juntas en constancia', () => {
    const out = groupGoals([
      { id: 'm', type: 'days_trained', target_value: 20, unit: 'días' },
      { id: 's', type: 'sessions_per_week', target_value: 4, unit: 'días' },
    ], ctx)
    expect(out).toHaveLength(1)
    expect(out[0].goals).toHaveLength(2)
  })

  it('sin metas no hay grupos', () => {
    expect(groupGoals([], ctx)).toEqual([])
  })
})
