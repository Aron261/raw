import { useState, useCallback } from 'react'
import { STAT_MODULES } from '../lib/statModules'

// Which stat modules the user wants to see, persisted device-local.
// Seeded from each module's `default`. A profiles column is a clean
// follow-up if cross-device sync is ever wanted.
const KEY = 'raw:stat-modules'

function readEnabled() {
  const valid = new Set(STAT_MODULES.map(m => m.id))
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const ids = JSON.parse(raw).filter(id => valid.has(id))
      return new Set(ids)
    }
  } catch {
    // ignore malformed storage
  }
  return new Set(STAT_MODULES.filter(m => m.default).map(m => m.id))
}

export function useStatPrefs() {
  const [enabled, setEnabled] = useState(readEnabled)

  const toggle = useCallback((id) => {
    setEnabled(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        // ignore write failures (private mode, quota)
      }
      return next
    })
  }, [])

  return { enabled, toggle }
}
