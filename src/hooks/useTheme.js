import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'raw-theme'     // 'auto' | 'light' | 'dark'
const PALETTE_KEY = 'raw-palette' // 'slate' | 'riso'
const MQ = '(prefers-color-scheme: dark)'

function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function getStoredPalette() {
  try {
    const v = localStorage.getItem(PALETTE_KEY)
    return v === 'riso' ? 'riso' : 'slate' // default: slate (sober)
  } catch {
    return 'slate'
  }
}

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  return window.matchMedia(MQ).matches ? 'dark' : 'light'
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved)
}

function applyPalette(palette) {
  document.documentElement.setAttribute('data-palette', palette)
}

// Keep the iOS status-bar tint in sync with the current bg.
function syncMeta() {
  const el = document.documentElement
  const dark = el.getAttribute('data-theme') === 'dark'
  const riso = el.getAttribute('data-palette') === 'riso'
  const bg = riso ? (dark ? '#0E0F0C' : '#EAE7DE') : (dark ? '#15171B' : '#F3F4F6')
  const m = document.getElementById('theme-color-meta')
  if (m) m.setAttribute('content', bg)
}

// Theme = mode (auto/light/dark) + palette (slate/riso). The inline boot script
// in index.html sets the initial attributes; this hook keeps them in sync with
// the user's choice and live OS changes when mode is on 'auto'.
export function useTheme() {
  const [preference, setPreference] = useState(getStoredTheme)
  const [resolved, setResolved] = useState(() => resolve(getStoredTheme()))
  const [palette, setPaletteState] = useState(getStoredPalette)

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

  useEffect(() => {
    applyPalette(palette)
    syncMeta()
    try { localStorage.setItem(PALETTE_KEY, palette) } catch { /* ignore */ }
  }, [palette])

  // Cycle mode auto → light → dark → auto
  const cycle = useCallback(() => {
    setPreference(p => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto'))
  }, [])

  const setPalette = useCallback((p) => setPaletteState(p === 'riso' ? 'riso' : 'slate'), [])

  return { preference, resolved, setPreference, cycle, palette, setPalette }
}
