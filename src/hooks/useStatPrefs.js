import { useState, useEffect, useCallback } from 'react'
import { STAT_MODULES } from '../lib/statModules'

// Which stat modules the user wants to see, persisted device-local.
// We track two sets: `enabled` (what shows) and `known` (modules the user has
// already been offered). A brand-new module the user has never seen is added
// per its `default`; one they explicitly turned off stays off. A profiles
// column is a clean follow-up if cross-device sync is ever wanted.
const KEY = 'raw:stat-prefs'
const LEGACY_KEY = 'raw:stat-modules' // earlier format: a plain array of enabled ids

function loadState() {
  const allIds = STAT_MODULES.map(m => m.id)
  const keep = (ids) => (ids || []).filter(id => allIds.includes(id))

  let enabled, known
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && Array.isArray(raw.enabled)) {
      enabled = new Set(keep(raw.enabled))
      known = new Set(keep(raw.known))
    }
  } catch {
    // ignore malformed storage
  }

  if (!enabled) {
    // Migrate the legacy array, or start fresh from defaults.
    let legacy = null
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') } catch { /* noop */ }
    if (Array.isArray(legacy)) {
      enabled = new Set(keep(legacy))
      known = new Set(keep(legacy)) // only legacy modules count as already-seen
    } else {
      enabled = new Set(STAT_MODULES.filter(m => m.default).map(m => m.id))
      known = new Set()
    }
  }

  // Reconcile: surface any module the user hasn't been offered yet.
  for (const m of STAT_MODULES) {
    if (!known.has(m.id)) {
      if (m.default) enabled.add(m.id)
      known.add(m.id)
    }
  }
  return { enabled, known }
}

function persist(enabled, known) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: [...enabled], known: [...known] }))
  } catch {
    // ignore write failures (private mode, quota)
  }
}

export function useStatPrefs() {
  const [state, setState] = useState(loadState)

  // Persist the reconciled state once on mount so migrations/new modules stick.
  useEffect(() => {
    persist(state.enabled, state.known)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback((id) => {
    setState(prev => {
      const enabled = new Set(prev.enabled)
      enabled.has(id) ? enabled.delete(id) : enabled.add(id)
      const known = new Set(prev.known).add(id)
      persist(enabled, known)
      return { enabled, known }
    })
  }, [])

  return { enabled: state.enabled, toggle }
}
