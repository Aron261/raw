import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'raw-theme' // 'auto' | 'light' | 'dark'
const MQ = '(prefers-color-scheme: dark)'

function getStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  return window.matchMedia(MQ).matches ? 'dark' : 'light'
}

function apply(resolved) {
  document.documentElement.setAttribute('data-theme', resolved)
}

// Theme preference: 'auto' (follow device), 'light', or 'dark'.
// The inline boot script in index.html sets the initial attribute; this hook
// keeps it in sync with the user's choice and live OS changes when on 'auto'.
export function useTheme() {
  const [preference, setPreference] = useState(getStored)
  const [resolved, setResolved] = useState(() => resolve(getStored()))

  useEffect(() => {
    const r = resolve(preference)
    setResolved(r)
    apply(r)
    try { localStorage.setItem(STORAGE_KEY, preference) } catch { /* ignore */ }

    if (preference !== 'auto') return
    const mq = window.matchMedia(MQ)
    const onChange = () => { const next = mq.matches ? 'dark' : 'light'; setResolved(next); apply(next) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  // Cycle auto → light → dark → auto
  const cycle = useCallback(() => {
    setPreference(p => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto'))
  }, [])

  return { preference, resolved, setPreference, cycle }
}
