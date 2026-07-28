// @vitest-environment jsdom
// El constructor de rutinas del cliente (Coach → cliente → Rutinas).
//
// Lo que se prueba es la vía corta del entrenador: cargar una rutina PROPIA
// dentro del constructor y ajustarla antes de asignarla. Los dos fallos que
// importan son silenciosos: que la copia pierda series/reps por el camino (el
// entrenador asigna un plan a medio llenar sin notarlo) y que se guarde en la
// cuenta equivocada — de ahí que se verifique el payload completo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('recharts', () => ({
  // El mock cubre lo que monta chartTheme además de lo que monta la pantalla:
  // GridThemed/AreaThemed importan de recharts por su cuenta, así que un mock
  // parcial revienta al renderizar aunque la pantalla no use esa pieza.
  BarChart: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Bar: () => null, Line: () => null, Area: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Cell: () => null, Legend: () => null,
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
// useLang cuelga de useProfile → useAuth, que necesita el provider. Aquí solo
// hace falta que traduzca; las aserciones son sobre el español, que es la clave.
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }) }))

const mine = {
  routines: [
    {
      id: 'r1', name: 'Push Pull Legs', type: 'cycle',
      routine_days: [
        {
          id: 'd1', day_name: 'Push', day_order: 0, focus: 'Pecho',
          routine_day_exercises: [
            { id: 'e1', exercise_name: 'Press de banca con barra', exercise_order: 0, sets: 4, reps: '6-8', notes: 'Sin rebote' },
          ],
        },
        {
          id: 'd2', day_name: 'Pull', day_order: 1, focus: null,
          routine_day_exercises: [
            { id: 'e2', exercise_name: 'Dominadas', exercise_order: 0, sets: 4, reps: 'Al fallo', notes: null },
          ],
        },
      ],
    },
    { id: 'r2', name: 'Full Body', type: 'single_day', routine_days: [] },
  ],
  loading: false,
}

vi.mock('../hooks/useRoutines', () => ({
  useRoutines: () => mine,
  getNextRoutineDay: () => null,
}))

import { BuildRoutineModal } from './ClientDetail'

const onCreate = vi.fn()
const onClose = vi.fn()

beforeEach(() => {
  onCreate.mockReset().mockResolvedValue({ id: 'nueva' })
  onClose.mockReset()
})

afterEach(cleanup)

const open = (props = {}) =>
  render(<BuildRoutineModal clientName="Ana" initialType="cycle" onClose={onClose} onCreate={onCreate} {...props} />)

describe('BuildRoutineModal', () => {
  it('ofrece partir de una rutina propia', () => {
    open()
    expect(screen.getByRole('button', { name: /usar una de mis rutinas/i })).toBeTruthy()
  })

  it('abre directo en el selector cuando se entra por «De mis rutinas»', () => {
    open({ startPicking: true })
    expect(screen.getByText('Push Pull Legs')).toBeTruthy()
    expect(screen.getByText(/ciclo · 2 días · 2 ejercicios/i)).toBeTruthy()
  })

  it('carga la rutina elegida en el constructor, con sus series y reps', () => {
    open({ startPicking: true })
    fireEvent.click(screen.getByText('Push Pull Legs'))

    // Nombre y días quedan editables, ya rellenos.
    expect(screen.getByDisplayValue('Push Pull Legs')).toBeTruthy()
    expect(screen.getByDisplayValue('Push')).toBeTruthy()
    expect(screen.getByDisplayValue('Pull')).toBeTruthy()
    expect(screen.getByDisplayValue('Press de banca con barra')).toBeTruthy()
    expect(screen.getByDisplayValue('6-8')).toBeTruthy()
    expect(screen.getByDisplayValue('Sin rebote')).toBeTruthy()
    // Y queda claro que es una copia.
    expect(screen.getByText(/copiada de «Push Pull Legs»/i)).toBeTruthy()
  })

  it('asigna la copia al cliente con el plan entero', async () => {
    open({ startPicking: true })
    fireEvent.click(screen.getByText('Push Pull Legs'))
    fireEvent.click(screen.getByRole('button', { name: /asignar rutina/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const payload = onCreate.mock.calls[0][0]
    expect(payload.name).toBe('Push Pull Legs')
    expect(payload.type).toBe('cycle')
    expect(payload.source).toBe('shared')     // copiada, no escrita a mano
    expect(payload.is_active).toBe(false)     // activar es un verbo aparte
    expect(payload.days).toHaveLength(2)
    expect(payload.days[0]).toMatchObject({ day_name: 'Push', focus: 'Pecho' })
    expect(payload.days[0].exercises[0]).toMatchObject({
      exercise_name: 'Press de banca con barra', sets: 4, reps: '6-8', notes: 'Sin rebote',
    })
    expect(payload.days[1].exercises[0]).toMatchObject({ exercise_name: 'Dominadas', sets: 4 })
  })

  it('lo que se edita tras copiar es lo que se asigna', async () => {
    open({ startPicking: true })
    fireEvent.click(screen.getByText('Push Pull Legs'))

    fireEvent.change(screen.getByDisplayValue('Push Pull Legs'), { target: { value: 'PPL de Ana' } })
    fireEvent.change(screen.getByDisplayValue('6-8'), { target: { value: '10-12' } })
    fireEvent.click(screen.getByRole('button', { name: /asignar rutina/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const payload = onCreate.mock.calls[0][0]
    expect(payload.name).toBe('PPL de Ana')
    expect(payload.days[0].exercises[0].reps).toBe('10-12')
  })

  // Copiar un ciclo estando en el formulario de "un día" recortaría el plan al
  // primer día sin decir nada: el tipo lo manda la rutina de origen.
  it('el tipo lo manda la rutina copiada, no el botón por el que se entró', async () => {
    open({ initialType: 'single_day', startPicking: true })
    fireEvent.click(screen.getByText('Push Pull Legs'))
    fireEvent.click(screen.getByRole('button', { name: /asignar rutina/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(onCreate.mock.calls[0][0].type).toBe('cycle')
    expect(onCreate.mock.calls[0][0].days).toHaveLength(2)
  })

  it('sin copiar nada, sigue siendo una rutina escrita a mano', async () => {
    open()
    fireEvent.change(screen.getByPlaceholderText(/Ej: Fuerza 4 días/i), { target: { value: 'A medida' } })
    fireEvent.change(screen.getByPlaceholderText(/Ejercicio 1/i), { target: { value: 'Sentadilla' } })
    fireEvent.click(screen.getByRole('button', { name: /asignar rutina/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(onCreate.mock.calls[0][0].source).toBe('manual')
  })

  it('una rutina copiada sin ejercicios no se asigna en silencio', async () => {
    open({ startPicking: true })
    fireEvent.click(screen.getByText('Full Body'))
    fireEvent.click(screen.getByRole('button', { name: /asignar rutina/i }))

    await waitFor(() => expect(screen.getByText(/agrega al menos un ejercicio/i)).toBeTruthy())
    expect(onCreate).not.toHaveBeenCalled()
  })
})
