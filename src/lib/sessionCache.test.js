// Lo que se prueba aquí es una promesa concreta: que un entreno a medias
// sobreviva a que el navegador mate la pestaña sin conexión. Por eso las
// pruebas hablan de recargas y de series encoladas, no de get y put.

import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionCache } from './sessionCache'
import { memoryStore } from './idb'

const nuevaCache = () => createSessionCache(memoryStore('workoutId'))

const ENTRENO = { id: 'w1', name: 'Push', started_at: '2026-08-05T10:00:00Z' }
const conSeries = (...series) => ([{
  id: 'we1', sort_order: 0, unit: 'kg',
  exercises: { id: 'e1', name: 'Press de banca' },
  sets: series,
}])

describe('sessionCache', () => {
  let cache
  beforeEach(() => { cache = nuevaCache() })

  it('devuelve null cuando ese entreno nunca se guardó', async () => {
    expect(await cache.load('w1')).toBeNull()
  })

  it('lo guardado se vuelve a leer igual: es la recarga sin conexión', async () => {
    const ejercicios = conSeries({ id: 's1', set_number: 1, reps: 8, weight: 60 })
    await cache.save('w1', { workout: ENTRENO, workoutExercises: ejercicios })

    const snap = await cache.load('w1')
    expect(snap.workout).toEqual(ENTRENO)
    expect(snap.workoutExercises[0].sets).toHaveLength(1)
  })

  // El motivo de guardar el estado local y no la respuesta del servidor: las
  // series que aún están en la cola son las que más falta hace no perder.
  it('conserva las series que todavía no han llegado al servidor', async () => {
    const sincronizada = { id: 's1', set_number: 1, reps: 8, weight: 60 }
    const encolada = { id: 's2', set_number: 2, reps: 8, weight: 62.5 }
    await cache.save('w1', { workout: ENTRENO, workoutExercises: conSeries(sincronizada, encolada) })

    const snap = await cache.load('w1')
    expect(snap.workoutExercises[0].sets.map(s => s.id)).toEqual(['s1', 's2'])
  })

  it('cada guardado reemplaza al anterior, no acumula versiones', async () => {
    await cache.save('w1', { workout: ENTRENO, workoutExercises: conSeries({ id: 's1' }) })
    await cache.save('w1', { workout: ENTRENO, workoutExercises: conSeries({ id: 's1' }, { id: 's2' }) })

    const snap = await cache.load('w1')
    expect(snap.workoutExercises[0].sets).toHaveLength(2)
  })

  it('dos entrenos no se pisan', async () => {
    await cache.save('w1', { workout: ENTRENO, workoutExercises: conSeries({ id: 's1' }) })
    await cache.save('w2', { workout: { ...ENTRENO, id: 'w2', name: 'Pull' }, workoutExercises: [] })

    expect((await cache.load('w1')).workout.name).toBe('Push')
    expect((await cache.load('w2')).workout.name).toBe('Pull')
  })

  it('sin entreno no se guarda nada: una foto vacía taparía la del servidor', async () => {
    await cache.save('w1', { workout: null, workoutExercises: [] })
    expect(await cache.load('w1')).toBeNull()
  })

  it('sin id no revienta ni guarda', async () => {
    await cache.save(null, { workout: ENTRENO, workoutExercises: [] })
    expect(await cache.load(null)).toBeNull()
  })

  it('al finalizar se borra: si no, cada sesión dejaría una copia para siempre', async () => {
    await cache.save('w1', { workout: ENTRENO, workoutExercises: [] })
    await cache.remove('w1')
    expect(await cache.load('w1')).toBeNull()
  })

  // Mismo motivo que el outbox: esto es el entreno de una persona en un
  // dispositivo y no puede aparecerle a la siguiente cuenta que entre.
  it('cerrar sesión se lleva las fotos de todos los entrenos', async () => {
    await cache.save('w1', { workout: ENTRENO, workoutExercises: [] })
    await cache.save('w2', { workout: { ...ENTRENO, id: 'w2' }, workoutExercises: [] })
    await cache.clear()
    expect(await cache.load('w1')).toBeNull()
    expect(await cache.load('w2')).toBeNull()
  })
})
