// @vitest-environment jsdom
// El checklist de suplementos.
//
// Las tablas llevaban meses en la base sin pantalla. Lo que se prueba aquí es
// lo que hace que valgan: que marcar sea un toque y se vea al instante, y que
// quitar algo del stack no borre el historial de habértelo tomado — eso es una
// baja lógica, no un delete, porque dejar de tomar algo no es no haberlo
// tomado nunca.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
    locale: 'es-CO', lang: 'es',
  }),
}))

const estado = { supplements: [], loading: false, error: null }
const setTaken = vi.fn().mockResolvedValue(undefined)
const addSupplement = vi.fn().mockResolvedValue({})
const removeSupplement = vi.fn().mockResolvedValue(undefined)

vi.mock('../hooks/useSupplements', () => ({
  useSupplements: () => ({ ...estado, refetch: () => {}, setTaken, addSupplement, removeSupplement }),
}))

import Longevidad from './Longevidad'

const CREATINA = { id: 's1', name: 'Creatina', dose: '5 g', timing: ['AM'], taken: false }
const OMEGA = { id: 's2', name: 'Omega-3', dose: '2 g', timing: ['Con comida'], taken: true }

beforeEach(() => {
  estado.supplements = [CREATINA, OMEGA]
  estado.loading = false
  estado.error = null
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('checklist del día', () => {
  it('lista el stack con su dosis y su momento', () => {
    render(<Longevidad />)
    expect(screen.getByText('Creatina')).toBeTruthy()
    expect(screen.getByText(/5 g — AM/)).toBeTruthy()
  })

  it('dice cuántos llevas, que es a lo que se entra', () => {
    render(<Longevidad />)
    expect(screen.getByText('1 de 2 hoy')).toBeTruthy()
  })

  it('marcar es un toque', async () => {
    render(<Longevidad />)
    fireEvent.click(screen.getByLabelText('Marcar Creatina como tomado'))
    await waitFor(() => expect(setTaken).toHaveBeenCalledWith('s1', true))
  })

  it('y desmarcar también: equivocarse no puede ser irreversible', async () => {
    render(<Longevidad />)
    fireEvent.click(screen.getByLabelText('Marcar Omega-3 como tomado'))
    await waitFor(() => expect(setTaken).toHaveBeenCalledWith('s2', false))
  })

  it('el estado se lee sin abrir nada', () => {
    render(<Longevidad />)
    expect(screen.getByLabelText('Marcar Creatina como tomado').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByLabelText('Marcar Omega-3 como tomado').getAttribute('aria-checked')).toBe('true')
  })

  it('quitar del stack pasa por el hook, que da de baja sin borrar el historial', async () => {
    render(<Longevidad />)
    fireEvent.click(screen.getByLabelText('Quitar Creatina del stack'))
    await waitFor(() => expect(removeSupplement).toHaveBeenCalledWith('s1'))
  })
})

describe('estados', () => {
  it('sin stack, invita a montarlo en vez de dejar la pantalla muda', () => {
    estado.supplements = []
    render(<Longevidad />)
    expect(screen.getByText('Sin suplementos todavía')).toBeTruthy()
  })

  // Un fallo de carga y un stack vacío no se parecen: uno se arregla
  // reintentando y el otro añadiendo.
  it('un fallo no se disfraza de stack vacío', () => {
    estado.supplements = []
    estado.error = 'network'
    render(<Longevidad />)
    expect(screen.getByText('No pudimos cargar tus suplementos.')).toBeTruthy()
    expect(screen.queryByText('Sin suplementos todavía')).toBeNull()
  })
})

describe('añadir', () => {
  it('exige nombre: un suplemento sin nombre no es nada', () => {
    estado.supplements = []
    render(<Longevidad />)
    fireEvent.click(screen.getByLabelText('Añadir suplemento'))
    expect(screen.getByText('Añadir').disabled).toBe(true)
  })

  it('guarda nombre, dosis y momento', async () => {
    estado.supplements = []
    render(<Longevidad />)
    fireEvent.click(screen.getByLabelText('Añadir suplemento'))
    fireEvent.change(screen.getByPlaceholderText('Creatina'), { target: { value: 'Vitamina D' } })
    fireEvent.change(screen.getByPlaceholderText('5 g'), { target: { value: '4000 UI' } })
    fireEvent.click(screen.getByText('Con comida'))
    fireEvent.click(screen.getByText('Añadir'))
    await waitFor(() => expect(addSupplement).toHaveBeenCalledWith({
      name: 'Vitamina D', dose: '4000 UI', timing: ['Con comida'],
    }))
  })
})
