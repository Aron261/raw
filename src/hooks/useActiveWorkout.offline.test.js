// @vitest-environment jsdom
// El síntoma que motivó esto: el sistema mata la pestaña (o alguien recarga)
// en mitad de un entreno, sin señal en el sótano del gimnasio. El shell de la
// PWA arrancaba porque está precacheado, pero el entreno no: la caché vivía en
// un Map en memoria, así que la pantalla decía "Entreno no encontrado". Las
// series estaban a salvo en el outbox, pero invisibles y sin poder continuar.
//
// Estas pruebas montan el hook de verdad con la red caída y comprueban que se
// pinta la foto guardada, no un error.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Constructor encadenable: en supabase-js casi todo devuelve el propio builder
// y solo el final se espera, así que se hace "thenable" para poder await-earlo.
const RESULTS = {}
const builder = (result) => {
  const b = {}
  const encadenables = [
    'select', 'eq', 'order', 'limit', 'gte', 'lte', 'ilike',
    'update', 'insert', 'delete', 'upsert',
  ]
  for (const m of encadenables) b[m] = () => b
  b.single = () => Promise.resolve(result)
  b.maybeSingle = () => Promise.resolve(result)
  b.then = (res, rej) => Promise.resolve(result).then(res, rej)
  return b
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table) => builder(RESULTS[table] ?? { data: null, error: null }),
  },
}))

// El objeto tiene que ser ESTABLE entre renders: fetchWorkout lo lleva en sus
// dependencias, así que devolver uno nuevo cada vez lo reconstruye, vuelve a
// disparar el efecto y deja el hook en un bucle de refetch.
const USUARIO = { id: 'u1' }
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: USUARIO }) }))

// Caché real, respaldada en memoria: se prueba el trato con ella, no un doble.
vi.mock('../lib/sessionCache', async () => {
  const { createSessionCache } = await vi.importActual('../lib/sessionCache')
  const { memoryStore } = await vi.importActual('../lib/idb')
  return { sessionCache: createSessionCache(memoryStore('workoutId')) }
})

import { useActiveWorkout } from './useWorkout'
import { sessionCache } from '../lib/sessionCache'
import { outbox } from '../lib/outbox'

const ENTRENO = { id: 'w1', name: 'Push', started_at: '2026-08-05T10:00:00Z', routine_day_id: null }
const EJERCICIOS = [{
  id: 'we1', sort_order: 0, unit: 'kg', notes: null,
  exercises: { id: 'e1', name: 'Press de banca' },
  sets: [{ id: 's1', set_number: 1, reps: 8, weight: 60 }],
}]

const conRed = () => {
  RESULTS.workouts = { data: ENTRENO, error: null }
  RESULTS.workout_exercises = { data: EJERCICIOS, error: null }
}
const sinRed = () => {
  const fallo = { data: null, error: { message: 'Failed to fetch' } }
  RESULTS.workouts = fallo
  RESULTS.workout_exercises = fallo
}

describe('useActiveWorkout sin conexión', () => {
  beforeEach(async () => {
    await sessionCache.clear()
    await outbox.clear()
    conRed()
  })

  it('con red, guarda la foto para la próxima vez', async () => {
    const { result } = renderHook(() => useActiveWorkout('w1'))
    await waitFor(() => expect(result.current.workout).toBeTruthy())

    expect(result.current.stale).toBe(false)
    await waitFor(async () => expect(await sessionCache.load('w1')).toBeTruthy())
  })

  // El caso del sótano.
  it('sin red pero con foto: se ve el entreno, no un error', async () => {
    await sessionCache.save('w1', { workout: ENTRENO, workoutExercises: EJERCICIOS })
    sinRed()

    const { result } = renderHook(() => useActiveWorkout('w1'))
    await waitFor(() => expect(result.current.workout).toBeTruthy())

    expect(result.current.error).toBeNull()
    expect(result.current.workout.name).toBe('Push')
    expect(result.current.workoutExercises[0].sets).toHaveLength(1)
    expect(result.current.stale).toBe(true)
  })

  // La foto se guarda desde el estado local, así que incluye lo encolado. Si se
  // guardara la respuesta del servidor, una recarga sin red borraría de la
  // vista justo las series que aún no han podido sincronizarse.
  it('sin red, sobreviven las series que aún no llegaron al servidor', async () => {
    const conEncolada = [{
      ...EJERCICIOS[0],
      sets: [...EJERCICIOS[0].sets, { id: 's2', set_number: 2, reps: 8, weight: 62.5 }],
    }]
    await sessionCache.save('w1', { workout: ENTRENO, workoutExercises: conEncolada })
    sinRed()

    const { result } = renderHook(() => useActiveWorkout('w1'))
    await waitFor(() => expect(result.current.workoutExercises.length).toBe(1))

    expect(result.current.workoutExercises[0].sets.map(s => s.id)).toEqual(['s1', 's2'])
  })

  // Sin foto no hay nada mejor que ofrecer: primera carga de este entreno en
  // este dispositivo. Ahí el error sí es la respuesta honesta.
  it('sin red y sin foto, el error se muestra', async () => {
    sinRed()

    const { result } = renderHook(() => useActiveWorkout('w1'))
    await waitFor(() => expect(result.current.error).toBeTruthy())

    expect(result.current.workout).toBeNull()
  })

  it('al finalizar se borra la foto', async () => {
    const { result } = renderHook(() => useActiveWorkout('w1'))
    await waitFor(() => expect(result.current.workout).toBeTruthy())
    await waitFor(async () => expect(await sessionCache.load('w1')).toBeTruthy())

    await result.current.finishWorkout()

    expect(await sessionCache.load('w1')).toBeNull()
  })
})
