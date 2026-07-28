import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'raw-theme'     // 'auto' | 'light' | 'dark'
const MQ = '(prefers-color-scheme: dark)'

function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  return window.matchMedia(MQ).matches ? 'dark' : 'light'
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved)
}

// Keep the iOS status-bar tint in sync with the current bg.
function syncMeta() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const m = document.getElementById('theme-color-meta')
  if (m) m.setAttribute('content', dark ? '#121316' : '#E7E7E4')
}

// El modo (auto/claro/oscuro) y nada más. Antes esto llevaba también una
// segunda dimensión —la paleta slate/riso—, pero el rediseño dejó una sola
// paleta: mantener dos multiplicaba por dos la superficie que hay que
// verificar a cambio de una elección que nadie tomaba dos veces.
// El script de arranque de index.html fija el atributo inicial; este hook lo
// mantiene en sintonía con la elección y con los cambios en vivo del sistema.
export function useTheme() {
  const [preference, setPreference] = useState(getStoredTheme)
  const [resolved, setResolved] = useState(() => resolve(getStoredTheme()))

  useEffect(() => {
    const r = resolve(preference)
    setResolved(r)
    applyTheme(r)
    syncMeta()
    try { localStorage.setItem(THEME_KEY, preference) } catch { /* ignore */ }

    if (preference !== 'auto') return
    const mq = window.matchMedia(MQ)
    const onChange = () => { const next = mq.matches ? 'dark' : 'light'; setResolved(next); applyTheme(next); syncMeta() }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  // Cycle mode auto → light → dark → auto
  const cycle = useCallback(() => {
    setPreference(p => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto'))
  }, [])

  return { preference, resolved, setPreference, cycle }
}
