// Las dos metas REALES que había en producción cuando se arregló el cálculo
// (15/8/2026), con sus números tal cual salieron de la base:
//
//   «Squat»    → 225 lb × 5 reps; mejor serie a 5+ reps: 215 lb, registrada en lb
//   «Pull ups» →  45 lb × 5 reps; mejor serie a 5+ reps:  40 lb, registrada en lb
//   perfil     → weight_unit = 'kg'
//
// Ese último dato es el que rompía todo: el progreso se calculaba en la unidad
// del PERFIL (kg) y se comparaba contra un objetivo escrito en LIBRAS. La
// sentadilla marcaba 43 % cuando iba por el 96 %, y las dominadas 40 % cuando
// iban por el 89 % — la app le decía a alguien que estaba a mitad de camino de
// algo que casi tenía.
//
// Se prueba con los números reales, y no solo con un caso inventado, porque
// esta es la clase de error que vuelve en silencio: cualquiera que "simplifique"
// el cálculo usando la unidad del perfil lo reintroduce entero.

import { describe, it, expect } from 'vitest'
import { computeGoalProgress } from './goals'
import { convertWeight } from './progress'

const workoutWith = (name, weight, reps, unit) => ({
  started_at: '2026-08-01T10:00:00',
  ended_at: '2026-08-01T11:00:00',
  workout_exercises: [{ unit, exercises: { name }, sets: [{ weight, reps }] }],
})

// Reproduce lo que hacía la portada: convertir a la unidad del perfil y
// compararlo contra un objetivo que está en otra.
const pctAsProfileUnit = (bestWeight, loggedUnit, profileUnit, target) =>
  Math.min(100, Math.round((convertWeight(bestWeight, loggedUnit, profileUnit) / target) * 100))

describe('regresión: metas en libras con el perfil en kilos', () => {
  it('Squat 225 lb × 5 con 215 lb levantados marca 96 %, no 43 %', () => {
    const g = computeGoalProgress(
      {
        type: 'exercise_weight', exercise_name: 'Sentadilla con barra',
        target_value: 225, target_reps: 5, unit: 'lb', start_value: null,
      },
      { workouts: [workoutWith('Sentadilla con barra', 215, 5, 'lb')] }
    )
    expect(g.current).toBe(215)
    expect(g.pct).toBe(96)
    expect(g.remaining).toBe(10)

    // Lo que enseñaba antes, para que se vea el tamaño del error.
    expect(pctAsProfileUnit(215, 'lb', 'kg', 225)).toBe(43)
  })

  it('Pull ups 45 lb × 5 con 40 lb levantados marca 89 %, no 40 %', () => {
    const g = computeGoalProgress(
      {
        type: 'exercise_weight', exercise_name: 'Dominadas agarre prono',
        target_value: 45, target_reps: 5, unit: 'lb', start_value: null,
      },
      { workouts: [workoutWith('Dominadas agarre prono', 40, 5, 'lb')] }
    )
    expect(g.current).toBe(40)
    expect(g.pct).toBe(89)
    expect(g.remaining).toBe(5)

    expect(pctAsProfileUnit(40, 'lb', 'kg', 45)).toBe(40)
  })
})
