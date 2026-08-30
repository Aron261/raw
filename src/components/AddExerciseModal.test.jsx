// @vitest-environment jsdom
// Buscar un ejercicio que YA tienes.
//
// El fallo que fija esta prueba pasó de verdad, dos veces en dos días: en el
// gimnasio se tecleó «Single Leg Seated Curl» y «Machine Chest Flyes», la lista
// salió vacía, y como el único botón que quedaba era «+ Crear», nacieron dos
// ejercicios nuevos con el historial en blanco de dos que ya existían.
//
// La causa estaba repartida entre la RPC de la biblioteca y un `ilike '%q%'`
// sobre los ejercicios propios: los dos exigían la frase entera, seguida y en
// ese orden. Lo que se prueba aquí es el lado del cliente — que el modal pide
// las dos búsquedas por RPC, que no duplica lo que ya es tuyo, y que no ofrece
// crear algo que está en la lista. El lado SQL vive en
// supabase/exercises_search_words.sql.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }))
vi.mock('../hooks/useWorkout', () => ({ useWorkouts: () => ({ workouts: [] }) }))
vi.mock('../hooks/useExerciseLang', () => ({ useExerciseLang: () => ({ term: x => x }) }))
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: x => x }) }))
vi.mock('./ui', () => ({
  Sheet: ({ children }) => <div>{children}</div>,
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}))
vi.mock('./ExerciseGif', () => ({ default: () => null }))

import AddExerciseModal from './AddExerciseModal'

// Respuestas por nombre de RPC, ajustables en cada prueba.
let own, lib
beforeEach(() => {
  own = []
  lib = []
  rpc.mockReset()
  rpc.mockImplementation((fn) =>
    Promise.resolve({ data: fn === 'search_my_exercises' ? own : lib })
  )
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); cleanup() })

const type = (text) => {
  fireEvent.change(screen.getByLabelText('Buscar o crear ejercicio'), { target: { value: text } })
  vi.advanceTimersByTime(240)   // el debounce del buscador
}

describe('Buscar ejercicio', () => {
  it('busca lo propio por RPC, no por ilike', async () => {
    // El `ilike '%q%'` era el agujero: exigía la frase entera y seguida, y
    // encima no ignoraba acentos. Si vuelve, esta prueba lo ve.
    render(<AddExerciseModal userId="u1" onAdd={vi.fn()} onClose={vi.fn()} />)
    type('single leg seated curl')

    await waitFor(() => expect(rpc).toHaveBeenCalled())
    const llamadas = rpc.mock.calls.map(c => c[0])
    expect(llamadas).toContain('search_my_exercises')
    expect(llamadas).toContain('search_exercise_library')
  })

  it('no ofrece de la biblioteca lo que ya es tuyo', async () => {
    // Mismo ejercicio por los dos lados: tu fila enlazada a la biblioteca, y la
    // fila de la biblioteca. Enseñar las dos es ofrecerte elegir entre tu
    // historial y empezar de cero, con el mismo nombre en las dos líneas.
    own = [{ id: 'mine', name: 'Curl femoral sentado', custom_name: null, library_id: 'L1' }]
    lib = [{ id: 'L1', name: 'Curl femoral sentado' }, { id: 'L2', name: 'Curl femoral tumbado' }]

    render(<AddExerciseModal userId="u1" onAdd={vi.fn()} onClose={vi.fn()} />)
    type('curl femoral')

    await waitFor(() => expect(screen.getAllByText('Curl femoral sentado')).toHaveLength(1))
    expect(screen.getByText('Curl femoral tumbado')).toBeTruthy()
  })

  it('enseña el nombre que le pusiste, pero agrega por su nombre canónico', async () => {
    // `custom_name` es la etiqueta; `name` es la clave con la que se resuelve.
    // Agregar por la etiqueta crearía otra fila: exactamente el duplicado que
    // todo esto viene a evitar.
    const onAdd = vi.fn()
    own = [{ id: 'mine', name: 'Curl femoral sentado', custom_name: 'Femoral máquina', library_id: 'L1' }]

    render(<AddExerciseModal userId="u1" onAdd={onAdd} onClose={vi.fn()} />)
    type('femoral')

    await waitFor(() => expect(screen.getByText('Femoral máquina')).toBeTruthy())
    fireEvent.click(screen.getByText('Femoral máquina'))
    expect(onAdd).toHaveBeenCalledWith('Curl femoral sentado')
  })

  it('no ofrece crear lo que ya está en la lista', async () => {
    // Con resultados, «+ Crear» sobra: es el botón que fabricó los duplicados.
    own = [{ id: 'mine', name: 'Curl femoral sentado', custom_name: 'Femoral máquina', library_id: 'L1' }]

    render(<AddExerciseModal userId="u1" onAdd={vi.fn()} onClose={vi.fn()} />)
    type('Femoral máquina')

    await waitFor(() => expect(screen.getByText('Femoral máquina')).toBeTruthy())
    expect(screen.queryByText(/\+ Crear/)).toBeNull()
  })

  it('deja crear lo que de verdad no existe', async () => {
    render(<AddExerciseModal userId="u1" onAdd={vi.fn()} onClose={vi.fn()} />)
    type('Remo marciano')

    await waitFor(() => expect(screen.getByText(/Remo marciano/)).toBeTruthy())
  })
})
