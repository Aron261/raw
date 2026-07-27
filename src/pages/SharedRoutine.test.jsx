// @vitest-environment jsdom
// La pantalla pública de una rutina compartida.
//
// Tres cosas tienen que ser ciertas aquí, y las tres se rompen en silencio:
// que quien llega SIN cuenta vea el plan entero (si no, el enlace no sirve de
// nada), que al guardar sin sesión se vuelva al mismo enlace después del login
// (perder el token allí deja a la persona en la app sin la rutina que le
// mandaron), y que la copia se guarde marcada como 'shared'.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const state = {
  shared: null,
  loading: false,
  error: null,
  user: null,
  betaApproved: false,
  betaLoading: false,
}

const noteImport = vi.fn()
const createRoutine = vi.fn()

vi.mock('../hooks/useSharedRoutine', () => ({
  useSharedRoutine: () => ({
    shared: state.shared,
    loading: state.loading,
    error: state.error,
    notFound: !state.loading && !state.error && !state.shared,
    reload: () => {},
    noteImport,
  }),
}))

vi.mock('../hooks/useRoutines', () => ({
  useRoutines: () => ({ createRoutine }),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: state.user, loading: false }),
}))

vi.mock('../hooks/useBetaGate', () => ({
  useBetaGate: () => ({ approved: state.betaApproved, loading: state.betaLoading }),
}))

import SharedRoutine from './SharedRoutine'

const PLAN = {
  name: 'Push Pull Legs',
  type: 'cycle',
  goal: 'Hipertrofia',
  level: 'Intermedio',
  days_per_week: 3,
  shared_by: 'Pedro',
  token: 'tok-123',
  days: [
    {
      day_name: 'Push',
      focus: 'Pecho',
      exercises: [{ exercise_name: 'Press de banca con barra', sets: 4, reps: '6-8' }],
    },
    {
      day_name: 'Pull',
      focus: null,
      exercises: [{ exercise_name: 'Dominadas', sets: 4, reps: 'Al fallo' }],
    },
  ],
}

function Probe({ label }) {
  const { pathname, search } = useLocation()
  return <p>{`${label}|${pathname}${search}`}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/r/tok-123']}>
      <Routes>
        <Route path="/r/:token" element={<SharedRoutine />} />
        <Route path="/login" element={<Probe label="LOGIN" />} />
        <Route path="/rutinas" element={<Probe label="RUTINAS" />} />
        <Route path="/" element={<Probe label="HOME" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  state.shared = PLAN
  state.loading = false
  state.error = null
  state.user = null
  state.betaApproved = false
  state.betaLoading = false
  noteImport.mockReset().mockResolvedValue(undefined)
  createRoutine.mockReset().mockResolvedValue({ id: 'nueva' })
})

afterEach(cleanup)

describe('SharedRoutine', () => {
  it('muestra el plan completo sin sesión', () => {
    renderPage()

    expect(screen.getByText('Push Pull Legs')).toBeTruthy()
    expect(screen.getByText('Pedro')).toBeTruthy()
    expect(screen.getByText('Push')).toBeTruthy()
    expect(screen.getByText('Pull')).toBeTruthy()
    expect(screen.getByText('Press de banca con barra')).toBeTruthy()
    expect(screen.getByText('Dominadas')).toBeTruthy()
    expect(screen.getByText('4 × 6-8')).toBeTruthy()
  })

  it('sin sesión, guardar lleva al login conservando el enlace', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(screen.getByText(`LOGIN|/login?redirect=${encodeURIComponent('/r/tok-123')}`)).toBeTruthy()
    expect(createRoutine).not.toHaveBeenCalled()
  })

  it('con sesión y beta, guarda una copia marcada como compartida', async () => {
    state.user = { id: 'u1' }
    state.betaApproved = true
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /guardar en mis rutinas/i }))

    await waitFor(() => expect(createRoutine).toHaveBeenCalledTimes(1))
    const payload = createRoutine.mock.calls[0][0]
    expect(payload.source).toBe('shared')
    expect(payload.name).toBe('Push Pull Legs')
    expect(payload.days).toHaveLength(2)
    expect(payload.days[0].exercises[0].exercise_name).toBe('Press de banca con barra')

    await waitFor(() => expect(screen.getByText('RUTINAS|/rutinas')).toBeTruthy())
    expect(noteImport).toHaveBeenCalled()
  })

  // El contador del dueño es decoración: si falla, la copia ya está guardada y
  // no hay nada que decirle a quien la guardó.
  it('un fallo del contador no impide guardar', async () => {
    state.user = { id: 'u1' }
    state.betaApproved = true
    noteImport.mockRejectedValue(new Error('offline'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /guardar en mis rutinas/i }))

    await waitFor(() => expect(screen.getByText('RUTINAS|/rutinas')).toBeTruthy())
  })

  it('si falla el guardado, lo dice y no navega', async () => {
    state.user = { id: 'u1' }
    state.betaApproved = true
    createRoutine.mockRejectedValue(new Error('Sin conexión'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /guardar en mis rutinas/i }))

    await waitFor(() => expect(screen.getByText('Sin conexión')).toBeTruthy())
    expect(screen.queryByText('RUTINAS|/rutinas')).toBeNull()
  })

  it('un enlace desactivado no ofrece guardar nada', () => {
    state.shared = null
    renderPage()

    expect(screen.getByText(/ya no está disponible/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /guardar/i })).toBeNull()
  })
})
