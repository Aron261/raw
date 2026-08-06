// @vitest-environment jsdom
// El entreno activo, montado de verdad.
//
// Esta pantalla no tenía prueba de render, y es justo la que más piezas
// coordina: la baraja, la regleta, la carta de cierre y las superseries. Un
// nombre mal escrito o una constante declarada después de usarse no la detecta
// ni el build ni los tipos — solo montarla. Eso es lo que se hace aquí, más el
// recorrido completo: pasar de carta, cerrar un ejercicio y verlo salir de la
// baraja sin salir de la sesión.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => vi.fn(),
}))
vi.mock('../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))
// Sheet arrastra media API de motion (gestos, valores animados, sus
// suscripciones). Aquí solo importa que renderice.
vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  useMotionValue: (v) => ({ get: () => v, set: () => {}, on: () => () => {} }),
  useMotionValueEvent: () => {},
  useDragControls: () => ({ start: () => {} }),
  animate: () => ({ stop: () => {} }),
  AnimatePresence: ({ children }) => children,
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }) => {
      const { drag, dragDirectionLock, dragSnapToOrigin, dragElastic, dragControls,
              dragListener, dragConstraints, onDragEnd, initial, animate: _a, exit,
              transition, whileTap, layout, ...dom } = rest
      return <div {...dom}>{children}</div>
    },
  }),
}))
vi.mock('../lib/chime', () => ({ primeChime: () => {} }))
// Cadena encadenable y siempre thenable: la pantalla consulta récords y el
// aviso de entreno abierto sella `last_seen_at`, y ninguna de las dos debe
// obligar a esta prueba a saber por dónde va la cadena.
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, {
    get: (_t, prop) => (prop === 'then'
      ? (res) => Promise.resolve({ data: [], error: null }).then(res)
      : () => chain()),
    apply: () => chain(),
  })
  return { supabase: { from: chain, rpc: chain } }
})
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: (x, v) => (v ? Object.entries(v).reduce((s, [k, val]) => s.replaceAll(`{${k}}`, val), x) : x), locale: 'es-CO', lang: 'es' }) }))
vi.mock('../hooks/useExerciseLang', () => ({ useExerciseLang: () => ({ label: (e) => e?.name || '' }) }))
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }))
vi.mock('../components/RestTimerSheet', () => ({ default: () => <div data-testid="rest-pill" /> }))
vi.mock('../components/AddExerciseModal', () => ({ default: () => null }))
vi.mock('../components/ExerciseGif', () => ({ default: () => null }))

// ExerciseRow entero es otra pantalla; aquí solo hace falta que exponga los
// dos botones por los que pasa el recorrido.
vi.mock('../components/ExerciseRow', () => ({
  default: ({ workoutExercise, isExerciseFinished, onToggleFinish, onRestStart, groupLabel }) => (
    <div data-testid="row">
      <span data-testid="row-name">{workoutExercise.exercises.name}</span>
      {groupLabel && <span data-testid="row-group">{groupLabel}</span>}
      {isExerciseFinished && <span data-testid="row-done">hecho</span>}
      <button onClick={() => onToggleFinish(workoutExercise.id, !isExerciseFinished)}>
        {isExerciseFinished ? 'Reabrir' : 'Finalizar ejercicio'}
      </button>
      <button onClick={() => onRestStart?.(90, { workoutExerciseId: workoutExercise.id })}>
        Serie hecha
      </button>
    </div>
  ),
}))

let state

vi.mock('../hooks/useWorkout', () => ({
  useActiveWorkout: () => ({
    workout: { id: 'w1', name: 'Empuje', started_at: new Date('2026-08-05T10:00:00Z').toISOString(), ended_at: null },
    workoutExercises: state.exercises,
    loading: false, error: null, stale: false,
    updateWorkoutName: vi.fn(), finishWorkout: vi.fn(), addExercise: vi.fn(), replaceExercise: vi.fn(),
    updateUnit: vi.fn(), updateExerciseNotes: vi.fn(), addSet: vi.fn(), updateSet: vi.fn(),
    deleteSet: vi.fn(), removeExercise: vi.fn(), moveExercise: vi.fn(),
    linkWithNext: vi.fn(), unlinkExercise: vi.fn(),
  }),
  useWorkouts: () => ({ deleteWorkout: vi.fn() }),
  useOutboxCount: () => 0,
  useExercisePR: () => ({ prSets: [], allTimePR: null, loading: false }),
  useExerciseAllTimeBest: () => ({ allTimeBestWeight: 0 }),
  usePreviousSets: () => ({ previousSets: [] }),
  calc1RM: (w, r) => (r ? Math.round(w * (1 + r / 30)) : w),
  calcVolume: (sets) => sets.reduce((a, s) => a + s.reps * s.weight, 0),
}))

import ActiveWorkout from './ActiveWorkout'

const ex = (id, name, over = {}) => ({
  id, sort_order: 0, unit: 'kg', notes: null, group_id: null, group_order: 0,
  exercises: { id: `e-${id}`, name }, sets: [{ id: `s-${id}`, set_number: 1, reps: 8, weight: 60 }],
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  state = {
    exercises: [
      ex('x1', 'Press banca', { sort_order: 0 }),
      ex('x2', 'Remo', { sort_order: 1 }),
      ex('x3', 'Sentadilla', { sort_order: 2 }),
    ],
  }
})
afterEach(cleanup)

const currentName = () => screen.getByTestId('row-name').textContent
const next = () => fireEvent.click(screen.getByLabelText('Ejercicio siguiente'))

describe('ActiveWorkout — la baraja monta y se recorre', () => {
  it('monta y arranca en el primer ejercicio', () => {
    render(<ActiveWorkout />)
    expect(currentName()).toBe('Press banca')
  })

  it('del último se pasa a la carta de cierre y de ahí al primero', () => {
    render(<ActiveWorkout />)
    next(); next()
    expect(currentName()).toBe('Sentadilla')
    next()
    expect(screen.getByText('Te faltan 3 ejercicios')).toBeTruthy()
    next()
    expect(currentName()).toBe('Press banca')
  })

  it('la carta de cierre dice lo que falta y deja volver a ello', () => {
    render(<ActiveWorkout />)
    next(); next(); next()
    expect(screen.getByText('Te faltan 3 ejercicios')).toBeTruthy()
    fireEvent.click(screen.getByText('Remo'))
    expect(currentName()).toBe('Remo')
  })
})

describe('ActiveWorkout — terminar un ejercicio', () => {
  it('lo pliega en su resumen y después lo saca de la baraja', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByText('Finalizar ejercicio'))
    // Se queda a la vista un momento, ya como resumen.
    expect(screen.getByTestId('row-done')).toBeTruthy()
    expect(currentName()).toBe('Press banca')
    // Y entonces la baraja pasa sola al siguiente que queda.
    await vi.advanceTimersByTimeAsync(600)
    await waitFor(() => expect(currentName()).toBe('Remo'))
    vi.useRealTimers()
  })

  it('el que ya está hecho deja de aparecer al pasar de carta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByText('Finalizar ejercicio'))
    await vi.advanceTimersByTimeAsync(600)
    await waitFor(() => expect(currentName()).toBe('Remo'))
    next() // Remo → Sentadilla
    next() // Sentadilla → cierre
    next() // cierre → Remo, NO Press banca: ese ya está hecho
    expect(currentName()).toBe('Remo')
    vi.useRealTimers()
  })

  it('sigue siendo alcanzable desde la regleta y se puede reabrir', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByText('Finalizar ejercicio'))
    await vi.advanceTimersByTimeAsync(600)
    await waitFor(() => expect(currentName()).toBe('Remo'))

    fireEvent.click(screen.getByLabelText('Press banca'))
    expect(currentName()).toBe('Press banca')
    expect(screen.getByTestId('row-done')).toBeTruthy()

    fireEvent.click(screen.getByText('Reabrir'))
    expect(screen.queryByTestId('row-done')).toBeNull()
    vi.useRealTimers()
  })
})

describe('ActiveWorkout — aviso de entreno abierto', () => {
  // 20 minutos es el umbral; 25 lo pasa de sobra.
  const volverTrasUnRato = () => localStorage.setItem('raw_last_seen_w1', String(Date.now() - 25 * 60_000))

  it('al volver tras un rato largo pregunta si sigues entrenando', () => {
    volverTrasUnRato()
    render(<ActiveWorkout />)
    expect(screen.getByText('¿Sigues entrenando?')).toBeTruthy()
    expect(screen.getByText('Sigo entrenando')).toBeTruthy()
  })

  it('no ofrece notificaciones: están apagadas por ahora', () => {
    volverTrasUnRato()
    render(<ActiveWorkout />)
    expect(screen.queryByText(/Avisarme con una notificación/)).toBeNull()
    expect(screen.queryByText(/notificación/i)).toBeNull()
  })

  it('sin ausencia larga no molesta', () => {
    localStorage.setItem('raw_last_seen_w1', String(Date.now() - 60_000))
    render(<ActiveWorkout />)
    expect(screen.queryByText('¿Sigues entrenando?')).toBeNull()
  })
})

describe('ActiveWorkout — superseries', () => {
  beforeEach(() => {
    state.exercises = [
      ex('x1', 'Press banca', { sort_order: 0, group_id: 'g1', group_order: 0 }),
      ex('x2', 'Remo', { sort_order: 1, group_id: 'g1', group_order: 1 }),
      ex('x3', 'Sentadilla', { sort_order: 2 }),
    ]
  })

  it('marca a los miembros con su letra de la vuelta', () => {
    render(<ActiveWorkout />)
    expect(screen.getByTestId('row-group').textContent).toBe('A')
  })

  it('cerrar una serie de A lleva a B sin arrancar el descanso', () => {
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByText('Serie hecha'))
    expect(currentName()).toBe('Remo')
    expect(screen.queryByTestId('rest-pill')).toBeNull()
  })

  it('cerrar la vuelta en B descansa y devuelve a A', () => {
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByText('Serie hecha')) // A → B
    fireEvent.click(screen.getByText('Serie hecha')) // B → descanso + vuelta a A
    expect(currentName()).toBe('Press banca')
    expect(screen.getByTestId('rest-pill')).toBeTruthy()
  })

  it('un ejercicio suelto descansa y no se mueve', () => {
    render(<ActiveWorkout />)
    fireEvent.click(screen.getByLabelText('Sentadilla'))
    fireEvent.click(screen.getByText('Serie hecha'))
    expect(currentName()).toBe('Sentadilla')
    expect(screen.getByTestId('rest-pill')).toBeTruthy()
  })
})
