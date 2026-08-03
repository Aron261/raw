// @vitest-environment jsdom
// El reparto de series del ciclo, ahora con músculos secundarios.
//
// Lo que se comprueba aquí es lo que un usuario puede contar con los dedos: un
// ciclo con tres series de press de banca y nada más tiene que decir 3 de
// pecho, 1,5 de tríceps y 1,5 de hombro. Si esta tarjeta se equivoca, se
// equivoca en la única cifra por la que alguien decide si le falta volumen.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import CycleMuscleDistribution from './CycleMuscleDistribution'

const state = { lib: [], own: [], level: 'Intermedio' }

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: { level: state.level } }),
}))

// supabase.from(tabla).select(cols).in/eq(...) → thenable con los datos falsos.
vi.mock('../lib/supabase', () => {
  const result = (table) => {
    const data = table === 'exercises_library' ? state.lib : state.own
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      then: (resolve) => resolve({ data, error: null }),
    }
    return chain
  }
  return { supabase: { from: (table) => result(table) } }
})

const routineWith = (exercises) => ({
  routine_days: [{ routine_day_exercises: exercises }],
})

const PRESS = {
  name: 'Press de banca con barra',
  muscle_group: 'Pecho',
  secondary_muscles: ['Tríceps', 'Hombro'],
}

beforeEach(() => {
  state.lib = [PRESS]
  state.own = []
  state.level = 'Intermedio'
})
afterEach(cleanup)

describe('CycleMuscleDistribution', () => {
  it('acredita media serie a cada músculo secundario', async () => {
    render(<CycleMuscleDistribution routine={routineWith([
      { exercise_name: 'Press de banca con barra', sets: 3 },
    ])} />)

    await waitFor(() => expect(screen.getByText('Pecho')).toBeTruthy())
    expect(screen.getByText('3 series')).toBeTruthy()
    // Dos grupos con la misma cifra: tríceps y hombro, media serie por serie.
    expect(screen.getAllByText('1,5 series')).toHaveLength(2)
    expect(screen.getByText('Tríceps')).toBeTruthy()
    expect(screen.getByText('Hombro')).toBeTruthy()
  })

  it('desglosa lo directo de lo indirecto', async () => {
    render(<CycleMuscleDistribution routine={routineWith([
      { exercise_name: 'Press de banca con barra', sets: 4 },
      { exercise_name: 'Extensión de tríceps en polea', sets: 3 },
    ])} />)
    state.lib.push({ name: 'Extensión de tríceps en polea', muscle_group: 'Tríceps', secondary_muscles: [] })

    await waitFor(() => expect(screen.getByText('Tríceps')).toBeTruthy())
    // 3 propias + 2 heredadas del press = 5
    expect(screen.getByText('5 series')).toBeTruthy()
    expect(screen.getByText('3 directas + 2 indirectas')).toBeTruthy()
    // El pecho no recibe nada indirecto, así que no lleva desglose.
    expect(screen.queryByText('4 directas + 0 indirectas')).toBeNull()
  })

  it('muestra el objetivo semanal del nivel del perfil', async () => {
    state.level = 'Avanzado'
    render(<CycleMuscleDistribution routine={routineWith([
      { exercise_name: 'Press de banca con barra', sets: 3 },
    ])} />)

    await waitFor(() => expect(screen.getByText('Pecho')).toBeTruthy())
    expect(screen.getByText('objetivo 14–18')).toBeTruthy()          // Tríceps / Avanzado
    expect(screen.getAllByText('objetivo 16–20')).toHaveLength(2)    // Pecho y Hombro
  })

  it('la clasificación del usuario manda, pero los secundarios siguen contando', async () => {
    state.own = [{ name: 'Press de banca con barra', muscle_group: 'Hombro' }]
    render(<CycleMuscleDistribution routine={routineWith([
      { exercise_name: 'Press de banca con barra', sets: 4 },
    ])} />)

    await waitFor(() => expect(screen.getByText('Hombro')).toBeTruthy())
    // Hombro es principal (4) y además secundario de la biblioteca: no dobla.
    expect(screen.getByText('4 series')).toBeTruthy()
    expect(screen.getByText('2 series')).toBeTruthy()   // Tríceps
    expect(screen.queryByText('Pecho')).toBeNull()
  })

  it('un ejercicio que no está en la biblioteca cae en Otros y sin objetivo', async () => {
    render(<CycleMuscleDistribution routine={routineWith([
      { exercise_name: 'Invento del gimnasio de abajo', sets: 2 },
    ])} />)

    await waitFor(() => expect(screen.getByText('Otros')).toBeTruthy())
    expect(screen.getByText('2 series')).toBeTruthy()
    expect(screen.queryByText(/objetivo/)).toBeNull()
  })
})
