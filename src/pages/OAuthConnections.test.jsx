// @vitest-environment jsdom
// Las conexiones activas, en Perfil.
//
// Autorizar un conector era de ida: no había forma de ver qué tiene acceso a
// la cuenta ni de cortarlo desde la app. Y como el registro de clientes OAuth
// es abierto, alguien puede registrar uno llamado "Claude" y mandar el enlace
// de autorización. Lo que se prueba aquí es lo que esa persona necesitaría:
// ver la conexión, que la pantalla no le venda el nombre como verificado, y
// poder cortarla sin lograrlo de un roce accidental.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('recharts', () => ({
  BarChart: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Bar: () => null, Line: () => null, Area: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Cell: () => null, Legend: () => null,
}))
vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
    locale: 'es-CO', lang: 'es',
  }),
}))

// Estado mutable: cada prueba decide qué conexiones hay.
const estado = { connections: [], loading: false, error: null }
const revoke = vi.fn().mockResolvedValue(undefined)

vi.mock('../hooks/useOAuthConnections', () => ({
  useOAuthConnections: () => ({
    ...estado, refetch: () => {}, revoke, revoking: null, revokeError: null,
  }),
}))

import { ClaudeSection } from './Profile'

const CONEXION = {
  id: 'c1',
  client_name: 'Claude',
  registration_type: 'dynamic',
  granted_at: '2026-07-20T04:38:44Z',
  active_sessions: 1,
}

beforeEach(() => {
  estado.connections = [CONEXION]
  estado.loading = false
  estado.error = null
  revoke.mockClear()
})
afterEach(cleanup)

describe('conexiones activas', () => {
  it('muestra qué está conectado y desde cuándo', () => {
    render(<ClaudeSection />)
    expect(screen.getByText('Conexiones activas')).toBeTruthy()
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText(/Autorizada el/)).toBeTruthy()
  })

  // El nombre lo elige quien registra el cliente. Presentarlo a secas sería
  // prestarle la credibilidad de RAW a un dato que RAW no ha comprobado.
  it('avisa de que el nombre no está verificado', () => {
    render(<ClaudeSection />)
    expect(screen.getByText(/RAW no verifica este nombre/)).toBeTruthy()
  })

  it('sin conexiones no pinta la sección: no hay nada que decir', () => {
    estado.connections = []
    render(<ClaudeSection />)
    expect(screen.queryByText('Conexiones activas')).toBeNull()
  })

  // Cortar el acceso es irreversible desde aquí (hay que volver a autorizar en
  // Claude), así que no puede pasar de un roce.
  it('revocar pide confirmación antes de hacer nada', () => {
    render(<ClaudeSection />)
    fireEvent.click(screen.getByText('Revocar'))
    expect(revoke).not.toHaveBeenCalled()
    expect(screen.getByText('¿Seguro?')).toBeTruthy()
  })

  it('el segundo toque sí revoca, y con el id correcto', async () => {
    render(<ClaudeSection />)
    fireEvent.click(screen.getByText('Revocar'))
    fireEvent.click(screen.getByText('¿Seguro?'))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('c1'))
  })

  it('salir del botón cancela la confirmación', () => {
    render(<ClaudeSection />)
    const btn = screen.getByText('Revocar')
    fireEvent.click(btn)
    fireEvent.blur(screen.getByText('¿Seguro?'))
    expect(screen.getByText('Revocar')).toBeTruthy()
    expect(revoke).not.toHaveBeenCalled()
  })
})
