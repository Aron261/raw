import { describe, it, expect, beforeEach } from 'vitest'
import { createOutbox } from './outbox'

// In-memory backend so the queue semantics are tested without IndexedDB.
function memBackend() {
  const map = new Map()
  return {
    async getAll() { return [...map.values()] },
    async put(op) { map.set(op.id, op) },
    async delete(id) { map.delete(id) },
    async clear() { map.clear() },
    _map: map,
  }
}

let ob
beforeEach(() => { ob = createOutbox(memBackend()) })

describe('outbox queue', () => {
  it('drains in seq order regardless of enqueue interleaving', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: { r: 1 } })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's2', data: { r: 2 } })
    await ob.enqueue({ kind: 'set.delete', workoutId: 'w', dedupeKey: 's1', data: {} })
    const order = []
    const res = await ob.drain({
      'set.upsert': async (op) => { order.push(['upsert', op.dedupeKey]) },
      'set.delete': async (op) => { order.push(['delete', op.dedupeKey]) },
    })
    expect(res).toEqual({ synced: 3, remaining: 0, dropped: 0 })
    expect(order).toEqual([['upsert', 's1'], ['upsert', 's2'], ['delete', 's1']])
    expect(await ob.count()).toBe(0)
  })

  it('coalesces repeated upserts of the same key into one op with the latest data', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: { weight: 5 } })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: { weight: 10 } })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: { weight: 15 } })
    const pending = await ob.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0].data).toEqual({ weight: 15 })
  })

  it('stops draining at the first failure and keeps the rest in order', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: {} })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's2', data: {} }) // this one throws
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's3', data: {} })
    const res = await ob.drain({
      'set.upsert': async (op) => { if (op.dedupeKey === 's2') throw new Error('offline') },
    })
    expect(res.synced).toBe(1)
    expect(res.remaining).toBe(2)
    expect(res.error).toBeInstanceOf(Error)
    // s1 gone, s2 + s3 remain, still in order for the next attempt
    const remaining = await ob.pending()
    expect(remaining.map(o => o.dedupeKey)).toEqual(['s2', 's3'])
  })

  it('counts per workout and clears everything on logout', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'wA', dedupeKey: 'a', data: {} })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'wA', dedupeKey: 'b', data: {} })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'wB', dedupeKey: 'c', data: {} })
    expect(await ob.count('wA')).toBe(2)
    expect(await ob.count('wB')).toBe(1)
    expect(await ob.count()).toBe(3)
    await ob.clear()
    expect(await ob.count()).toBe(0)
  })

  it('a permanent error drops the op and the rest still sync', async () => {
    // Un error permanente (FK, RLS: el servidor NUNCA va a aceptar esa op)
    // reintentaría para siempre y taponaría la cola entera — incluidas las
    // series buenas de entrenos futuros. Se descarta y se sigue.
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: {} }) // poison
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's2', data: {} })
    const fk = Object.assign(new Error('violates foreign key constraint'), { code: '23503' })
    const res = await ob.drain(
      { 'set.upsert': async (op) => { if (op.dedupeKey === 's1') throw fk } },
      { isPermanent: (e) => e?.code === '23503' },
    )
    expect(res.dropped).toBe(1)
    expect(res.synced).toBe(1)
    expect(res.remaining).toBe(0)
    expect(await ob.count()).toBe(0)
  })

  it('a transient error still stops the queue even with isPermanent given', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: {} })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's2', data: {} })
    const res = await ob.drain(
      { 'set.upsert': async () => { throw new Error('Failed to fetch') } },
      { isPermanent: (e) => e?.code === '23503' },
    )
    expect(res.dropped).toBe(0)
    expect(res.synced).toBe(0)
    expect(res.remaining).toBe(2)
    expect(await ob.count()).toBe(2)
  })

  it('removeWhere purges the ops of a deleted parent', async () => {
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'wA', dedupeKey: 'a', data: { workout_exercise_id: 'we1' } })
    await ob.enqueue({ kind: 'set.delete', workoutId: 'wA', dedupeKey: 'b', data: { id: 'b' } })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'wB', dedupeKey: 'c', data: { workout_exercise_id: 'we9' } })
    const n = await ob.removeWhere(op => op.workoutId === 'wA')
    expect(n).toBe(2)
    expect(await ob.count('wA')).toBe(0)
    expect(await ob.count('wB')).toBe(1)
  })

  it('notifies subscribers on enqueue, drain, and clear', async () => {
    let hits = 0
    const unsub = ob.subscribe(() => { hits++ })
    await ob.enqueue({ kind: 'set.upsert', workoutId: 'w', dedupeKey: 's1', data: {} })
    await ob.drain({ 'set.upsert': async () => {} })
    await ob.clear()
    expect(hits).toBeGreaterThanOrEqual(3)
    unsub()
  })
})
