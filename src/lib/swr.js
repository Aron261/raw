// Tiny stale-while-revalidate cache shared across the app.
//
// Why: every screen used to mount its own data hook and refetch from the
// network with a loading skeleton, so switching tabs felt like a website
// reloading. With a shared cache, a key's data is rendered instantly from
// memory and refreshed quietly in the background — the app feel.
//
// Usage:
//   const { data, loading, error, refetch } = useCachedResource(key, fetcher)
//   mutateCache(key, next | (prev) => next)   // optimistic update
//
// `key` is any stable string (e.g. `workouts:<userId>`); pass null to no-op
// (e.g. before auth resolves).

import { useEffect, useRef, useState, useCallback } from 'react'

const store = new Map()     // key -> { data, error, loading, ts }
const subs = new Map()      // key -> Set<() => void>
const inflight = new Map()  // key -> Promise

// Skip a background refetch if the cache was filled this recently.
const DEDUPE_MS = 8000

function emit(key) {
  const set = subs.get(key)
  if (set) set.forEach(fn => fn())
}

// Write to the cache directly (optimistic mutations).
export function mutateCache(key, updater) {
  if (!key) return
  const cur = store.get(key) || { data: undefined, error: null, loading: false, ts: 0 }
  const data = typeof updater === 'function' ? updater(cur.data) : updater
  store.set(key, { data, error: null, loading: false, ts: Date.now() })
  emit(key)
}

// Fetch (or refetch) a key. Dedupes concurrent calls and, unless forced,
// skips if the cache is still fresh.
export function revalidate(key, fetcher, force = false) {
  if (!key) return Promise.resolve()
  if (inflight.has(key)) return inflight.get(key)

  const cur = store.get(key)
  if (!force && cur && cur.data !== undefined && (Date.now() - cur.ts) < DEDUPE_MS) {
    return Promise.resolve()
  }

  // Only show a loading state when there's nothing cached to render.
  if (!cur || cur.data === undefined) {
    store.set(key, { data: cur?.data, error: cur?.error || null, loading: true, ts: cur?.ts || 0 })
    emit(key)
  }

  const p = (async () => {
    try {
      const data = await fetcher()
      store.set(key, { data, error: null, loading: false, ts: Date.now() })
    } catch (err) {
      const c = store.get(key) || {}
      store.set(key, { data: c.data, error: err, loading: false, ts: c.ts || 0 })
    } finally {
      inflight.delete(key)
      emit(key)
    }
  })()
  inflight.set(key, p)
  return p
}

export function useCachedResource(key, fetcher) {
  const [, rerender] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!key) return
    let set = subs.get(key)
    if (!set) { set = new Set(); subs.set(key, set) }
    const cb = () => rerender(n => n + 1)
    set.add(cb)
    revalidate(key, () => fetcherRef.current())   // stale-while-revalidate on mount
    return () => { set.delete(cb) }
  }, [key])

  const entry = key ? store.get(key) : undefined
  const refetch = useCallback(
    () => revalidate(key, () => fetcherRef.current(), true),
    [key]
  )

  return {
    data: entry?.data,
    error: entry?.error || null,
    loading: key ? (entry ? entry.loading : true) : false,
    refetch,
  }
}
