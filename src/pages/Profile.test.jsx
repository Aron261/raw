// @vitest-environment jsdom
// Perfil — la pantalla de configuración. Antes era una pila de seis tarjetas
// todas abiertas y había que recorrerla entera para llegar a cualquier cosa.
// Aquí se fija que entra plegada, que cada apartado se abre por su cuenta, y
// que lo que solo es de administradores no aparece para el resto.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

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
let searchParams = new URLSearchParams()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [searchParams, vi.fn()],
}))

vi.mock('../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))

let state
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({
    profile: state.profile, loading: false, saving: false,
    saveError: null, saveSuccess: false, saveProfile: vi.fn(), age: 30,
  }),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'pedro@example.com' }, signOut: vi.fn() }),
}))
vi.mock('../hooks/useBodyWeight', () => ({
  useBodyWeight: () => ({ logs: [], latestLog: null, loading: false, addLog: vi.fn(), deleteLog: vi.fn() }),
}))
vi.mock('../hooks/useTrainer', () => ({
  useTrainer: () => ({ isTrainer: false, toggling: false, error: null, toggleTrainer: vi.fn() }),
}))
vi.mock('../hooks/useInvites', () => ({
  useInvites: () => ({
    trainers: [], invites: [], error: null, loading: false,
    redeemCode: vi.fn(), createInvite: vi.fn(), revokeInvite: vi.fn(), unlinkTrainer: vi.fn(),
  }),
}))
vi.mock('../hooks/useUnreadCounts', () => ({ useUnreadCounts: () => ({ counts: {} }) }))
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    preference: 'auto', setPreference: vi.fn(),
    palette: 'slate', setPalette: vi.fn(), resolved: 'light',
  }),
}))

import Profile from './Profile'

const SECTIONS = ['Mis características', 'Entrenamiento', 'Apariencia', 'Cuenta']

beforeEach(() => {
  state = { profile: { name: 'Pedro', is_admin: false, is_trainer: false, exercise_lang: 'es' } }
  searchParams = new URLSearchParams()
  navigate.mockClear()
})
afterEach(cleanup)

describe('Perfil — plegado', () => {
  it('entra con todos los apartados cerrados', () => {
    render(<Profile />)
    for (const s of SECTIONS) {
      const btn = screen.getByRole('button', { name: new RegExp(s, 'i') })
      expect(btn.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('cada apartado se abre y se cierra por su cuenta', () => {
    render(<Profile />)
    const apariencia = screen.getByRole('button', { name: /apariencia/i })

    fireEvent.click(apariencia)
    expect(apariencia.getAttribute('aria-expanded')).toBe('true')
    // Abrir uno no cierra los demás ni los abre.
    expect(screen.getByRole('button', { name: /cuenta/i }).getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(apariencia)
    expect(apariencia.getAttribute('aria-expanded')).toBe('false')
  })

  it('el resumen de cada apartado dice algo real estando cerrado', () => {
    render(<Profile />)
    // Si la cabecera solo dijera el título, plegar sería esconder.
    expect(screen.getByRole('button', { name: /cuenta/i }).textContent).toMatch(/pedro@example\.com/)
    expect(screen.getByRole('button', { name: /apariencia/i }).textContent).toMatch(/Auto/)
  })

  it('un enlace con ?s= abre el apartado al que apunta', () => {
    // El chip de peso en Inicio enlaza a ?s=caracteristicas; si cayera en la
    // lista plegada, el usuario tendría que volver a buscar dónde estaba.
    searchParams = new URLSearchParams('s=caracteristicas')
    render(<Profile />)
    expect(screen.getByRole('button', { name: /mis características/i }).getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Perfil — qué vive dentro', () => {
  it('la biblioteca de ejercicios se entra desde Entrenamiento', () => {
    // Ya no es pestaña de la barra inferior: se mudó aquí dentro.
    render(<Profile />)
    fireEvent.click(screen.getByRole('button', { name: /entrenamiento/i }))
    fireEvent.click(screen.getByRole('button', { name: /mis ejercicios/i }))
    expect(navigate).toHaveBeenCalledWith('/ejercicios')
  })

  it('el panel de administración no existe para quien no es admin', () => {
    render(<Profile />)
    expect(screen.queryByText(/Panel de administración/i)).toBeNull()
  })

  it('y sí para quien lo es', () => {
    state.profile = { ...state.profile, is_admin: true }
    render(<Profile />)
    fireEvent.click(screen.getByRole('button', { name: /panel de administración/i }))
    expect(navigate).toHaveBeenCalledWith('/admin')
  })
})
