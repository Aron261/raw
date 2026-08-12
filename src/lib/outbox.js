// Offline outbox for set writes.
//
// The workout logging path today is write-then-refetch, which can't work
// without a connection. This is the durable queue that makes it offline-first:
// a mutation is applied optimistically in the UI and appended here; a sync loop
// drains it to the server when online and drops each op once it lands.
//
// Design notes that matter for correctness:
//  · Ops carry a monotonic `seq` and are ALWAYS drained in seq order. A set is
//    created and later updated under the same client-generated id, so the
//    create must reach the server before the update — order is not optional.
//  · Drain stops at the first failure and keeps the rest, so a transient error
//    can't let a later op overtake an earlier one.
//  · An upsert for a set already queued-but-unsent is coalesced onto the
//    existing op (same id), so hammering the steppers doesn't grow the queue.
//  · Cleared on logout — this holds one user's unsynced writes on a device and
//    must never leak across accounts (the same reason authed REST isn't SW-cached).
//
// Storage is behind a tiny backend interface: IndexedDB in the browser, an
// in-memory map elsewhere (tests, SSR), so the queue semantics are testable
// without a real database. Ese backend vive en lib/idb.js, compartido con la
// foto de la sesión (lib/sessionCache.js).

import { openStore } from './idb'

const STORE = { dbName: 'raw-outbox', storeName: 'ops', keyPath: 'id' }

// ── Outbox ──────────────────────────────────────────────────────────────
export function createOutbox(backend = openStore(STORE)) {
  let seq = 0
  const subscribers = new Set()
  const bump = async () => { for (const cb of subscribers) { try { cb() } catch { /* ignore */ } } }

  const newId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const ordered = async () => (await backend.getAll()).sort((a, b) => a.seq - b.seq)

  // Reserve a seq above anything already stored, so a reload keeps ordering.
  const ensureSeq = async () => {
    if (seq === 0) {
      const all = await backend.getAll()
      seq = all.reduce((m, o) => Math.max(m, o.seq), 0)
    }
    return ++seq
  }

  return {
    // Append an op. `dedupeKey` (e.g. a set id for upserts) coalesces onto an
    // existing un-sent op so repeated edits of the same row stay one write.
    async enqueue({ kind, workoutId, dedupeKey = null, data }) {
      if (dedupeKey) {
        const existing = (await backend.getAll()).find(o => o.kind === kind && o.dedupeKey === dedupeKey)
        if (existing) {
          await backend.put({ ...existing, data, updatedAt: Date.now() })
          await bump()
          return existing.id
        }
      }
      const op = { id: newId(), seq: await ensureSeq(), kind, workoutId, dedupeKey, data, createdAt: Date.now() }
      await backend.put(op)
      await bump()
      return op.id
    },

    async pending(workoutId = null) {
      const all = await ordered()
      return workoutId ? all.filter(o => o.workoutId === workoutId) : all
    },

    async count(workoutId = null) {
      return (await this.pending(workoutId)).length
    },

    async remove(id) { await backend.delete(id); await bump() },

    // Drop any pending op matching (kind, dedupeKey). Used when a set created
    // offline is deleted before it ever synced: cancel the create instead of
    // sending create-then-delete. Returns how many were dropped.
    async removeByDedupe(kind, dedupeKey) {
      const hits = (await backend.getAll()).filter(o => o.kind === kind && o.dedupeKey === dedupeKey)
      for (const o of hits) await backend.delete(o.id)
      if (hits.length) await bump()
      return hits.length
    },

    // Drop every pending op matching the predicate. Used when the row an op
    // targets stops existing (exercise removed, workout discarded): sin esto,
    // el upsert huérfano muere por FK en cada reintento y tapona la cola.
    async removeWhere(pred) {
      const hits = (await backend.getAll()).filter(pred)
      for (const o of hits) await backend.delete(o.id)
      if (hits.length) await bump()
      return hits.length
    },

    async clear() { await backend.clear(); seq = 0; await bump() },

    subscribe(cb) { subscribers.add(cb); return () => subscribers.delete(cb) },

    // Drain in seq order using per-kind handlers. A TRANSIENT failure (offline,
    // 5xx) stops the drain and keeps everything, so ordering/dependencies hold.
    // A PERMANENT failure — `isPermanent(error)` true: FK, RLS, datos que el
    // servidor nunca va a aceptar — descarta esa op y sigue con las demás:
    // reintentarla eternamente taponaría la cola y ningún entreno podría
    // finalizar jamás. Returns {synced, remaining, dropped, error?}.
    async drain(handlers, { isPermanent } = {}) {
      const ops = await ordered()
      let synced = 0
      let dropped = 0
      for (const op of ops) {
        const handler = handlers[op.kind]
        try {
          if (handler) await handler(op)
          await backend.delete(op.id)
          synced++
        } catch (error) {
          if (isPermanent && isPermanent(error)) {
            await backend.delete(op.id)
            dropped++
            continue
          }
          await bump()
          return { synced, remaining: ops.length - synced - dropped, dropped, error }
        }
      }
      if (synced || dropped) await bump()
      return { synced, remaining: 0, dropped }
    },
  }
}

// App-wide singleton (one device, one user at a time; cleared on logout).
export const outbox = createOutbox()
