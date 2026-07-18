import { describe, it, expect, vi } from 'vitest'

// buildCoachFeed is pure, but its module transitively imports the supabase
// client (via calc1RM). Stub it so the test doesn't spin up a real client.
vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { buildCoachFeed } from './useCoachFeed'

// Two clients, canonical PR keying, per-client best tracking, volume, order.
const day = (n) => new Date(2026, 0, n).toISOString()

const workouts = [
  // Ana, day 1: bench 60×5 (first ever → PR)
  { id: 'w1', user_id: 'ana', name: 'Push', started_at: day(1), workout_exercises: [
    { unit: 'kg', exercises: { id: 'e1', library_id: 'lib-bench' }, sets: [{ reps: 5, weight: 60 }] },
  ] },
  // Ana, day 3: bench 65×5 (beats 60 → PR)
  { id: 'w2', user_id: 'ana', name: 'Push', started_at: day(3), workout_exercises: [
    { unit: 'kg', exercises: { id: 'e2', library_id: 'lib-bench' }, sets: [{ reps: 5, weight: 65 }] },
  ] },
  // Ana, day 5: bench 62×5 (below 65 → no PR)
  { id: 'w3', user_id: 'ana', name: 'Push', started_at: day(5), workout_exercises: [
    { unit: 'kg', exercises: { id: 'e3', library_id: 'lib-bench' }, sets: [{ reps: 5, weight: 62 }] },
  ] },
  // Beto, day 4: squat 100×5 (first → PR, separate from Ana's bests)
  { id: 'w4', user_id: 'beto', name: 'Legs', started_at: day(4), workout_exercises: [
    { unit: 'kg', exercises: { id: 'e4', library_id: 'lib-squat' }, sets: [{ reps: 5, weight: 100 }] },
  ] },
]

const byId = (feed) => Object.fromEntries(feed.map(f => [f.workoutId, f]))

describe('buildCoachFeed', () => {
  it('flags a PR only when a client beats their own prior best', () => {
    const f = byId(buildCoachFeed(workouts, { ana: 'Ana', beto: 'Beto' }))
    expect(f.w1.isPR).toBe(true)   // first bench
    expect(f.w2.isPR).toBe(true)   // 65 > 60
    expect(f.w3.isPR).toBe(false)  // 62 < 65
    expect(f.w4.isPR).toBe(true)   // Beto's first squat, unaffected by Ana
  })

  it('orders newest-first and resolves client names', () => {
    const feed = buildCoachFeed(workouts, { ana: 'Ana', beto: 'Beto' })
    expect(feed.map(f => f.workoutId)).toEqual(['w3', 'w4', 'w2', 'w1'])
    expect(feed[0].clientName).toBe('Ana')
    expect(feed[1].clientName).toBe('Beto')
  })

  it('computes volume (reps × weight) per workout', () => {
    const f = byId(buildCoachFeed(workouts))
    expect(f.w1.volume).toBe(300) // 5 × 60
    expect(f.w4.volume).toBe(500) // 5 × 100
  })

  it('falls back to a generic name and handles empty input', () => {
    expect(buildCoachFeed([])).toEqual([])
    const f = buildCoachFeed([workouts[0]]) // no name map
    expect(f[0].clientName).toBe('Cliente')
  })
})
