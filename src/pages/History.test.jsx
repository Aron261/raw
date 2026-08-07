// @vitest-environment jsdom
//
// El historial dejó de ser solo de fuerza. Lo que se prueba aquí es que las
// dos fuentes —entrenos (timestamp) y sesiones de cardio/movilidad (fecha
// suelta)— se mezclen en el mes correcto y en el orden correcto, sin que la
// cuenta de entrenos del encabezado se contamine con lo que no es un entreno.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

vi.mock('../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/ui', () => ({
  LiveRegion: ({ children }) => <div>{children}</div>,
  UndoSnackbar: () => null,
}))
vi.mock('../components/WorkoutCard', () => ({
  default: ({ workout }) => <div data-kind="workout">{workout.name}</div>,
}))

let mockWorkouts = []
let mockSessions = []
vi.mock('../hooks/useWorkout', async () => {
  const actual = await vi.importActual('../lib/progress')
  return {
    useWorkouts: () => ({
      workouts: mockWorkouts,
      loading: false,
      error: null,
      fetchWorkouts: vi.fn(),
      deleteWorkout: vi.fn(),
      duplicateWorkout: vi.fn(),
    }),
    calc1RM: actual.calc1RM,
    calcVolume: () => 0,
  }
})
vi.mock('../hooks/useSchedule', () => ({
  useSchedule: () => ({ sessions: mockSessions }),
}))

import History from './History'

const workout = (id, iso, name) => ({
  id, name, started_at: `${iso}T10:00:00`, ended_at: `${iso}T11:00:00`,
  workout_exercises: [],
})
const session = (id, iso, over = {}) => ({
  id, date: iso, kind: 'cardio', title: null, status: 'done',
  duration_min: 40, distance_km: null, rpe: null, ...over,
})

afterEach(() => { cleanup(); mockWorkouts = []; mockSessions = [] })

describe('History — fuerza y lo demás en la misma lista', () => {
  it('intercala una sesión registrada entre los entrenos, por fecha', () => {
    mockWorkouts = [workout('w1', '2026-08-03', 'Upper'), workout('w2', '2026-08-10', 'Lower')]
    mockSessions = [session('s1', '2026-08-06', { title: 'Bici' })]
    render(<History />)

    const rows = [...document.querySelectorAll('[data-kind="workout"], button')]
      .map(e => e.textContent)
      .filter(txt => /Upper|Lower|Bici/.test(txt))
    // Más reciente primero: Lower (10) · Bici (6) · Upper (3)
    expect(rows[0]).toContain('Lower')
    expect(rows[1]).toContain('Bici')
    expect(rows[2]).toContain('Upper')
  })

  it('la cuenta del mes sigue siendo de entrenos; los minutos van aparte', () => {
    mockWorkouts = [workout('w1', '2026-08-03', 'Upper')]
    mockSessions = [session('s1', '2026-08-06'), session('s2', '2026-08-07', { duration_min: 20 })]
    render(<History />)

    // Un entreno, no tres — una salida en bici no es un entreno de fuerza.
    const header = screen.getByText(/60 min/)
    expect(header.textContent).toMatch(/^1 entreno/)
  })

  it('un plan sin cumplir no es historial', () => {
    mockWorkouts = [workout('w1', '2026-08-03', 'Upper')]
    mockSessions = [
      session('s1', '2026-08-06', { title: 'Planeado', status: 'planned' }),
      session('s2', '2026-08-07', { title: 'Saltado', status: 'skipped' }),
    ]
    render(<History />)
    expect(screen.queryByText(/Planeado/)).toBeNull()
    expect(screen.queryByText(/Saltado/)).toBeNull()
  })

  it('la fuerza planeada no se cuela: eso ya son entrenos', () => {
    mockWorkouts = []
    mockSessions = [session('s1', '2026-08-06', { kind: 'strength', title: 'Upper A' })]
    render(<History />)
    expect(screen.queryByText('Upper A')).toBeNull()
  })

  it('enseña las cifras de la sesión, no solo su nombre', () => {
    mockSessions = [session('s1', '2026-08-06', { title: 'Bici', distance_km: 8.2, rpe: 7 })]
    render(<History />)
    expect(screen.getByText(/40 min · 8,2 km · RPE 7/)).toBeTruthy()
  })

  it('separa por mes cada fuente en el suyo', () => {
    mockWorkouts = [workout('w1', '2026-07-28', 'Upper')]
    mockSessions = [session('s1', '2026-08-06', { title: 'Bici' })]
    render(<History />)
    const julio = screen.getByText(/^Julio/).closest('div').parentElement
    const agosto = screen.getByText(/^Agosto/).closest('div').parentElement
    expect(within(julio).queryByText(/Bici/)).toBeNull()
    expect(within(agosto).queryByText('Upper')).toBeNull()
  })
})
