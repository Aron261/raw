// @vitest-environment jsdom
// La tarjeta de una meta.
//
// Se prueba porque es lo que alguien lee para saber si va bien: el porcentaje,
// cuánto falta y cuánto queda de plazo. Dos de esas tres cifras estaban mal o
// no existían antes de este cambio —el progreso se medía desde cero y no había
// plazo— así que conviene que no puedan volver a torcerse en silencio.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// El idioma cuelga del perfil, y el perfil de la sesión: sin esto la tarjeta
// no se puede montar suelta. Se fija el español, que es la clave del
// diccionario y por tanto el texto literal que se afirma abajo.
vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ t: (k, vars) => (
    vars ? Object.keys(vars).reduce((s, v) => s.replaceAll(`{${v}}`, String(vars[v])), k) : k
  ), locale: 'es-CO', lang: 'es' }),
}))

import GoalRow from './GoalRow'
import { computeGoalProgress } from '../lib/goals'

afterEach(cleanup)

const NOW = new Date('2026-08-15T12:00:00')

const workout = (date, name, sets, unit = 'kg') => ({
  started_at: `${date}T10:00:00`,
  ended_at: `${date}T11:00:00`,
  workout_exercises: [{ unit, exercises: { name }, sets }],
})

const row = (goal, ctx = {}) =>
  computeGoalProgress(goal, { now: NOW, ...ctx })

describe('GoalRow', () => {
  it('mide el tramo propuesto, no la fuerza que ya tenías', () => {
    const g = row({
      id: '1', label: 'Sentadilla 100 kg', type: 'exercise_weight',
      exercise_name: 'Sentadilla', target_value: 100, target_reps: 5,
      unit: 'kg', start_value: 90,
    }, { workouts: [workout('2026-08-04', 'Sentadilla', [{ weight: 95, reps: 5 }])] })

    render(<GoalRow goal={g} />)

    // Sin start_value esto habría dicho 95 %.
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText(/95 \/ 100 kg × 5 reps/)).toBeTruthy()
    expect(screen.getByText(/5 kg/)).toBeTruthy()   // lo que falta
  })

  it('dice cuánto queda de plazo en vez de dar ánimos', () => {
    const g = row({
      id: '2', label: 'Press banca 100 kg', type: 'exercise_weight',
      exercise_name: 'Press banca', target_value: 100, target_reps: 1,
      unit: 'kg', start_value: 90,
      created_at: '2026-08-01T00:00:00', target_date: '2026-08-29',
    }, { workouts: [workout('2026-08-05', 'Press banca', [{ weight: 95, reps: 1 }])] })

    render(<GoalRow goal={g} />)
    expect(screen.getByText(/quedan 14 días/)).toBeTruthy()
    // La arenga que había antes no vuelve.
    expect(screen.queryByText(/Ya casi/)).toBeNull()
    expect(screen.queryByText(/Sigue así/)).toBeNull()
  })

  it('avisa cuando vas por detrás del plazo', () => {
    const g = row({
      id: '3', label: 'Peso muerto 200 kg', type: 'exercise_weight',
      exercise_name: 'Peso muerto', target_value: 200, target_reps: 1,
      unit: 'kg', start_value: 100,
      created_at: '2026-08-01T00:00:00', target_date: '2026-08-29',
    }, { workouts: [workout('2026-08-05', 'Peso muerto', [{ weight: 105, reps: 1 }])] })

    render(<GoalRow goal={g} />)
    expect(screen.getByText(/vas por detrás/)).toBeTruthy()
  })

  it('una meta de peso corporal cuenta hacia abajo', () => {
    const g = row({
      id: '4', label: 'Peso corporal 76 kg', type: 'body_weight',
      target_value: 76, unit: 'kg', start_value: 82,
    }, { bodyWeightLogs: [{ weight: 79, unit: 'kg', logged_at: '2026-08-10T08:00:00Z' }] })

    render(<GoalRow goal={g} />)
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText(/79 \/ 76 kg/)).toBeTruthy()
  })

  it('una meta de días por semana se lee en días', () => {
    const g = row({
      id: '5', label: '4 días por semana', type: 'sessions_per_week',
      target_value: 4, unit: 'días',
    }, { workouts: [
      workout('2026-08-10', 'A', [{ weight: 50, reps: 5 }]),
      workout('2026-08-12', 'A', [{ weight: 50, reps: 5 }]),
    ] })

    render(<GoalRow goal={g} />)
    expect(screen.getByText(/2 \/ 4 días esta semana/)).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('ofrece guardar una meta lograda en vez de solo borrarla', () => {
    const g = row({
      id: '6', label: 'Sentadilla 100 kg', type: 'exercise_weight',
      exercise_name: 'Sentadilla', target_value: 100, target_reps: 1,
      unit: 'kg', start_value: 90,
    }, { workouts: [workout('2026-08-04', 'Sentadilla', [{ weight: 100, reps: 1 }])] })

    render(<GoalRow goal={g} onComplete={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Cumplida')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Guardar como cumplida/ })).toBeTruthy()
  })

  it('no ofrece archivar una meta recurrente: vuelve a jugarse cada semana', () => {
    const g = row({
      id: '7', label: '1 día por semana', type: 'sessions_per_week',
      target_value: 1, unit: 'días',
    }, { workouts: [workout('2026-08-10', 'A', [{ weight: 50, reps: 5 }])] })

    render(<GoalRow goal={g} onComplete={() => {}} />)
    expect(screen.queryByRole('button', { name: /Guardar como cumplida/ })).toBeNull()
  })

  it('una meta archivada dice cuándo se cumplió y se puede reabrir', () => {
    const g = row({
      id: '8', label: 'Sentadilla 100 kg', type: 'exercise_weight',
      exercise_name: 'Sentadilla', target_value: 100, target_reps: 1,
      unit: 'kg', start_value: 90, completed_at: '2026-08-03T10:00:00Z',
    }, { workouts: [workout('2026-08-03', 'Sentadilla', [{ weight: 100, reps: 1 }])] })

    render(<GoalRow goal={g} onReopen={() => {}} />)
    expect(screen.getByText(/Cumplida el 3 de agosto/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reabrir/ })).toBeTruthy()
  })

  it('dice de quién es la meta cuando la asignó un entrenador', () => {
    const g = row({
      id: '9', label: 'Sentadilla 120 kg', type: 'exercise_weight',
      exercise_name: 'Sentadilla', target_value: 120, unit: 'kg',
      assigned_by: 'coach-1',
    }, { workouts: [] })

    render(<GoalRow goal={g} coachName="Ana" />)
    expect(screen.getByText(/Meta de/)).toBeTruthy()
    expect(screen.getByText(/Ana/)).toBeTruthy()
  })

  it('expone el progreso a lectores de pantalla', () => {
    const g = row({
      id: '10', label: 'Sentadilla 100 kg', type: 'exercise_weight',
      exercise_name: 'Sentadilla', target_value: 100, target_reps: 5,
      unit: 'kg', start_value: 90,
    }, { workouts: [workout('2026-08-04', 'Sentadilla', [{ weight: 95, reps: 5 }])] })

    render(<GoalRow goal={g} />)
    const bar = screen.getByRole('progressbar', { name: 'Sentadilla 100 kg' })
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
  })
})
