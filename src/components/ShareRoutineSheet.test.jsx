// @vitest-environment jsdom
// La hoja de compartir, desde el lado del dueño del plan.
//
// Lo que se verifica aquí es que las dos vías de compartir hacen lo que
// prometen: el enlace se entrega tal cual (copiarlo mal es entregar un enlace
// muerto) y la copia que se manda a un cliente se escribe EN LA CUENTA DEL
// CLIENTE (user_id), no en la del entrenador — el fallo silencioso más caro de
// este flujo, porque el entrenador cree que su cliente ya tiene el ciclo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const state = {
  share: null,
  isTrainer: false,
  clients: [],
}

const createLink = vi.fn()
const revokeLink = vi.fn()
const rpc = vi.fn()

vi.mock('../hooks/useRoutineShare', () => ({
  useRoutineShare: () => ({
    share: state.share,
    url: state.share ? `https://raw.test/r/${state.share.token}` : '',
    loading: false,
    working: false,
    error: null,
    createLink,
    revokeLink,
    refetch: () => {},
  }),
}))

vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: { is_trainer: state.isTrainer } }),
}))

vi.mock('../hooks/useTrainer', () => ({
  useTrainer: () => ({ clients: state.clients, loading: false }),
}))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args) => rpc(...args) } }))

import ShareRoutineSheet from './ShareRoutineSheet'

const ROUTINE = {
  id: 'rut-1',
  name: 'Push Pull Legs',
  type: 'cycle',
  goal: 'Hipertrofia',
  level: 'Intermedio',
  days_per_week: 3,
  routine_days: [
    {
      id: 'd1', day_name: 'Push', day_order: 0, focus: 'Pecho',
      routine_day_exercises: [
        { id: 'e1', exercise_name: 'Press de banca con barra', exercise_order: 0, sets: 4, reps: '6-8', rest_seconds: 150, notes: null },
      ],
    },
    {
      id: 'd2', day_name: 'Pull', day_order: 1, focus: null,
      routine_day_exercises: [
        { id: 'e2', exercise_name: 'Dominadas', exercise_order: 0, sets: 4, reps: 'Al fallo', rest_seconds: null, notes: null },
      ],
    },
  ],
}

beforeEach(() => {
  state.share = null
  state.isTrainer = false
  state.clients = []
  createLink.mockReset().mockResolvedValue(undefined)
  revokeLink.mockReset().mockResolvedValue(undefined)
  rpc.mockReset().mockResolvedValue({ data: { routine_id: 'nueva' }, error: null })
})

afterEach(cleanup)

describe('ShareRoutineSheet', () => {
  it('sin enlace, ofrece crearlo', () => {
    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /crear enlace/i }))
    expect(createLink).toHaveBeenCalled()
  })

  it('con enlace, lo muestra entero y lo copia tal cual', async () => {
    state.share = { id: 's1', token: 'tok-123', import_count: 0 }
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)

    expect(screen.getByText('https://raw.test/r/tok-123')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /copiar enlace/i }))
    expect(writeText).toHaveBeenCalledWith('https://raw.test/r/tok-123')
    await waitFor(() => expect(screen.getByRole('button', { name: /copiado/i })).toBeTruthy())
  })

  it('dice cuánta gente la ha guardado', () => {
    state.share = { id: 's1', token: 'tok-123', import_count: 1 }
    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)
    expect(screen.getByText(/1 persona la ha guardado/i)).toBeTruthy()
  })

  it('desactivar el enlace pide confirmación y avisa de lo que implica', async () => {
    state.share = { id: 's1', token: 'tok-123', import_count: 0 }
    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /desactivar enlace/i }))
    expect(screen.getByText(/dejará de funcionar para todo el mundo/i)).toBeTruthy()
    expect(revokeLink).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }))
    await waitFor(() => expect(revokeLink).toHaveBeenCalled())
  })

  it('quien no entrena a nadie no ve la sección de clientes', () => {
    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)
    expect(screen.queryByText(/enviar a un cliente/i)).toBeNull()
  })

  it('un entrenador manda la copia a la cuenta del cliente', async () => {
    state.isTrainer = true
    state.clients = [
      { clientId: 'cli-1', status: 'active', profile: { name: 'Ana' } },
      { clientId: 'cli-2', status: 'pending', profile: { name: 'Pendiente' } },
    ]

    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)

    // Un vínculo pendiente todavía no es un cliente al que mandarle nada.
    expect(screen.queryByText('Pendiente')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /enviar a ana/i }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('create_routine_tree')
    expect(args.p.user_id).toBe('cli-1')
    expect(args.p.source).toBe('shared')
    expect(args.p.name).toBe('Push Pull Legs')
    expect(args.p.days).toHaveLength(2)
    expect(args.p.days[0].exercises[0].exercise_name).toBe('Press de banca con barra')
    expect(args.p.days[0].exercises[0].sets).toBe(4)

    await waitFor(() => expect(screen.getByRole('button', { name: /enviar otra copia a ana/i })).toBeTruthy())
  })

  it('si el envío falla, lo dice y no se marca como enviada', async () => {
    state.isTrainer = true
    state.clients = [{ clientId: 'cli-1', status: 'active', profile: { name: 'Ana' } }]
    rpc.mockResolvedValue({ data: null, error: new Error('Vínculo revocado') })

    render(<ShareRoutineSheet routine={ROUTINE} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /enviar a ana/i }))

    await waitFor(() => expect(screen.getByText('Vínculo revocado')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /enviar otra copia/i })).toBeNull()
  })
})
