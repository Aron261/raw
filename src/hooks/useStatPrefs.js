import { useState, useEffect, useCallback } from 'react'
import { STAT_MODULES } from '../lib/statModules'

// Which stat modules the user sees, in what order, persisted device-local.
// Three sets: `enabled` (what shows), `order` (display order), `known` (modules
// already offered — a brand-new module is added per its `default` and appended
// to order). A profiles column is a clean follow-up for cross-device sync.
const KEY = 'raw:stat-prefs'
const LEGACY_KEY = 'raw:stat-modules' // earliest format: a plain array of enabled ids

function loadState() {
  const allIds = STAT_MODULES.map(m => m.id)
  const keep = (ids) => (ids || []).filter(id => allIds.includes(id))

  let enabled, known, order
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && Array.isArray(raw.enabled)) {
      enabled = new Set(keep(raw.enabled))
      known = new Set(keep(raw.known))
      order = keep(raw.order)
    }
  } catch {
    // ignore malformed storage
  }

  if (!enabled) {
    let legacy = null
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') } catch { /* noop */ }
    if (Array.isArray(legacy)) {
      enabled = new Set(keep(legacy))
      known = new Set(keep(legacy))
      order = keep(legacy)
    } else {
      enabled = new Set(STAT_MODULES.filter(m => m.default).map(m => m.id))
      known = new Set()
      order = []
    }
  }

  // Reconcile: surface + append any module the user hasn't been offered yet,
  // preserving the registry's order for newcomers.
  for (const m of STAT_MODULES) {
    if (!known.has(m.id)) {
      if (m.default) enabled.add(m.id)
      known.add(m.id)
    }
    if (!order.includes(m.id)) order.push(m.id)
  }
  order = order.filter(id => allIds.includes(id))

  return { enabled, known, order }
}

function persist(enabled, known, order) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: [...enabled], known: [...known], order }))
  } catch {
    // ignore write failures (private mode, quota)
  }
}

export function useStatPrefs() {
  const [state, setState] = useState(loadState)

  // Persist the reconciled state once on mount so migrations/new modules stick.
  useEffect(() => {
    persist(state.enabled, state.known, state.order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback((id) => {
    setState(prev => {
      const enabled = new Set(prev.enabled)
      enabled.has(id) ? enabled.delete(id) : enabled.add(id)
      const known = new Set(prev.known).add(id)
      persist(enabled, known, prev.order)
      return { ...prev, enabled, known }
    })
  }, [])

  const move = useCallback((id, dir) => {
    setState(prev => {
      const order = [...prev.order]
      const i = order.indexOf(id)
      if (i < 0) return prev
      const j = dir === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= order.length) return prev
      ;[order[i], order[j]] = [order[j], order[i]]
      persist(prev.enabled, prev.known, order)
      return { ...prev, order }
    })
  }, [])

  return { enabled: state.enabled, order: state.order, toggle, move }
}
