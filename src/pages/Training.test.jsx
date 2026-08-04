// @vitest-environment jsdom
// Inicio — la portada. Lo que se protege aquí no es el diseño, es que la
// pantalla no vuelva a duplicarse: durante un tiempo el mismo dato (las kcal de
// hoy) se imprimía dos veces y había cinco caminos distintos a /progreso desde
// una sola pantalla. Estas pruebas fijan el recuento.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

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

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

vi.mock('../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/calendar/Calendar', () => ({ default: () => <div data-testid="calendar" /> }))
vi.mock('../components/calendar/DaySheet', () => ({ default: () => null }))
vi.mock('../components/ui', () => ({
  Sheet: ({ children }) => <div>{children}</div>,
  Field: ({ children }) => <div>{children}</div>,
  Button: ({ children }) => <button>{children}</button>,
  LiveRegion: ({ children }) => <div>{children}</div>,
  UndoSnackbar: () => null,
}))

// ── Estado de los hooks, ajustable por prueba ───────────────────────────
let state

vi.mock('../hooks/useWorkout', () => ({
  useWorkouts: () => ({
    workouts: state.workouts, loading: false, error: null,
    createWorkout: vi.fn(), fetchWorkouts: vi.fn(),
  }),
}))
vi.mock('../hooks/useProfile', () => ({ useProfile: () => ({ profile: state.profile }) }))
vi.mock('../hooks/useNutrition', async () => {
  const real = await vi.importActual('../hooks/useNutrition')
  return {
    ...real,
    useNutritionDay: () => ({ totals: { kcal: state.kcal } }),
    useNutritionTargets: () => ({ targets: { kcal: 2400 } }),
  }
})
vi.mock('../hooks/useBodyWeight', () => ({ useBodyWeight: () => ({ latestLog: null }) }))
vi.mock('../hooks/useGoals', () => ({
  useGoals: () => ({ goals: [], createGoal: vi.fn(), deleteGoal: vi.fn() }),
}))
vi.mock('../hooks/useRoutines', () => ({
  useRoutines: () => ({ activeRoutine: null, routines: [] }),
  getNextRoutineDay: () => null,
}))
vi.mock('../hooks/useStartRoutineWorkout', () => ({
  useStartRoutineWorkout: () => ({ startWorkoutFromRoutineDay: vi.fn() }),
}))
vi.mock('../hooks/useInvites', () => ({ useInvites: () => ({ trainers: [] }) }))
vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ resolved: 'light', palette: 'slate' }) }))
vi.mock('../hooks/useSchedule', () => ({
  useSchedule: () => ({
    sessions: [], createSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(),
  }),
}))
vi.mock('../hooks/useUnreadCounts', () => ({ useUnreadCounts: () => ({ counts: {} }) }))
vi.mock('../hooks/useUndoableDelete', () => ({
  useUndoableDelete: () => ({ pending: null, liveMsg: '', request: vi.fn(), undo: vi.fn(), setLiveMsg: vi.fn() }),
}))

import Training from './Training'

beforeEach(() => {
  state = { workouts: [], profile: { name: 'Pedro', is_trainer: false }, kcal: 1200 }
  navigate.mockClear()
})
afterEach(cleanup)

// Un entreno terminado, suficiente para que la portada muestre los números.
const workout = {
  id: 'w1',
  name: 'Empuje',
  started_at: new Date().toISOString(),
  ended_at: new Date().toISOString(),
  workout_exercises: [
    { unit: 'kg', exercises: { name: 'Press banca' }, sets: [{ weight: 80, reps: 5 }] },
  ],
}

describe('Inicio — sin redundancias', () => {
  it('imprime las kcal de hoy una sola vez', () => {
    state.workouts = [workout]
    render(<Training />)
    // Antes aparecía en el chip "kcal hoy" y otra vez en el chip de sección
    // Nutrición, con el mismo número y el mismo destino. Ahora vive en el
    // anillo de la tarjeta de comida, que las parte en dos líneas: la cifra
    // dentro y el objetivo debajo.
    expect(screen.getAllByText('1.200')).toHaveLength(1)
    expect(screen.getAllByText('/ 2.400 kcal')).toHaveLength(1)
  })

  it('no repite en chips las secciones que ya son pestaña de la barra inferior', () => {
    state.workouts = [workout]
    render(<Training />)
    const resumen = screen.getByRole('navigation', { name: /resumen de hoy/i })
    expect(within(resumen).queryByText(/^Rutinas$/)).toBeNull()
    expect(within(resumen).queryByText(/^Progreso$/)).toBeNull()
  })

  it('no duplica en la portada lo que ya es pestaña: Perfil', () => {
    // Perfil pasó a ser la pestaña de la izquierda en la barra inferior, así que
    // el avatar que llevaba allí desde la cabecera sobra — es el mismo destino
    // dos veces en la misma pantalla.
    state.workouts = [workout]
    render(<Training />)
    expect(screen.queryByRole('button', { name: /perfil y ajustes/i })).toBeNull()
  })

  it('deja un solo acceso a Nutrición desde la portada', () => {
    state.workouts = [workout]
    render(<Training />)
    // La tarjeta de comida sustituyó al chip «Kcal hoy»: si volviera el chip,
    // serían dos caminos al mismo sitio con dos pesos distintos.
    expect(screen.getAllByText('Comida de hoy')).toHaveLength(1)
    expect(screen.queryByText(/kcal hoy/i)).toBeNull()
  })

  it('la comida de hoy pesa más que un chip', () => {
    // El motivo del cambio: era un chip del tamaño de «Racha» para algo que se
    // mira antes de cada comida. Ahora es una tarjeta con su anillo.
    state.workouts = [workout]
    render(<Training />)
    const resumen = screen.getByRole('navigation', { name: /resumen de hoy/i })
    expect(within(resumen).queryByText('Comida de hoy')).toBeNull()
    expect(screen.getByRole('img', { name: /1\.200 de 2\.400 kcal/ })).toBeTruthy()
  })

  it('el chip de Coach solo existe para entrenadores', () => {
    state.workouts = [workout]
    const { unmount } = render(<Training />)
    expect(screen.queryByText(/^coach$/i)).toBeNull()
    unmount()

    state.profile = { name: 'Pedro', is_trainer: true }
    render(<Training />)
    expect(screen.getByText(/^coach$/i)).toBeTruthy()
  })
})

describe('Inicio — primer uso', () => {
  it('deja crear una meta aunque no haya ningún entreno', () => {
    // La tarjeta de metas vivía dentro del bloque "hay entrenos", así que en el
    // primer uso era inalcanzable: justo cuando más sentido tiene fijar una.
    render(<Training />)
    expect(screen.getByText(/Todavía no tienes metas activas/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^crear meta$/i })).toBeTruthy()
  })

  it('muestra el arranque y el calendario, sin números de semana vacíos', () => {
    render(<Training />)
    expect(screen.getByText(/Registra tu primer entreno/i)).toBeTruthy()
    expect(screen.getByTestId('calendar')).toBeTruthy()
    expect(screen.queryByText(/^Esta semana$/)).toBeNull()
  })
})

describe('Inicio — la fecha', () => {
  it('se calcula en cada render, no al cargar el módulo', () => {
    // La PWA puede quedar abierta toda la noche; si la fecha se congelara al
    // importar el módulo, la portada seguiría anunciando ayer.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 26, 10, 0, 0))
      const { unmount } = render(<Training />)
      expect(screen.getByText(/26 de julio/i)).toBeTruthy()
      unmount()

      vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
      render(<Training />)
      expect(screen.getByText(/27 de julio/i)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
