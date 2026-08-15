import { useState, useEffect, useCallback, useRef } from 'react'
import { STAT_MODULES } from '../lib/statModules'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Which stat modules the user sees, in what order. Three sets: `enabled` (what
// shows), `order` (display order), `known` (modules already offered — a
// brand-new module is added per its `default` and appended to order).
//
// Se guarda en DOS sitios a propósito. `localStorage` es la copia rápida: la
// página se pinta con tu orden en el primer frame, sin esperar a la red ni
// parpadear con el de fábrica. `profiles.stat_prefs` es la copia que dura:
// antes esto vivía solo en el navegador, así que cambiar de teléfono —o
// limpiar datos— borraba un trabajo manual de ordenar seis módulos sin aviso.
//
// Cuando las dos existen y no coinciden manda el servidor, porque es la que
// puede venir de otro dispositivo; el local se reescribe con ella.
const KEY = 'raw:stat-prefs'
const LEGACY_KEY = 'raw:stat-modules' // earliest format: a plain array of enabled ids

const allIds = () => STAT_MODULES.map(m => m.id)

// Rellena lo que falte y descarta lo que ya no existe. Es el único sitio que
// decide qué es un estado válido, lo venga de donde venga (local, servidor o
// formato antiguo).
function reconcile({ enabled, known, order }) {
  const ids = allIds()
  const keep = (list) => (list || []).filter(id => ids.includes(id))

  const e = new Set(keep(enabled))
  const k = new Set(keep(known))
  let o = keep(order)

  for (const m of STAT_MODULES) {
    if (!k.has(m.id)) {
      if (m.default) e.add(m.id)
      k.add(m.id)
    }
    if (!o.includes(m.id)) o.push(m.id)
  }
  return { enabled: e, known: k, order: o }
}

const defaults = () => reconcile({
  enabled: STAT_MODULES.filter(m => m.default).map(m => m.id),
  known: [],
  order: [],
})

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && Array.isArray(raw.enabled)) return reconcile(raw)
  } catch {
    // ignore malformed storage
  }
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null')
    if (Array.isArray(legacy)) return reconcile({ enabled: legacy, known: legacy, order: legacy })
  } catch {
    // ignore
  }
  return defaults()
}

const serialize = (s) => ({ enabled: [...s.enabled], known: [...s.known], order: s.order })

function persistLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(state)))
  } catch {
    // ignore write failures (private mode, quota)
  }
}

const sameShape = (a, b) =>
  JSON.stringify(serialize(a)) === JSON.stringify(serialize(b))

export function useStatPrefs() {
  const { user } = useAuth()
  const [state, setState] = useState(loadLocal)
  // Hasta que el servidor conteste no se le escribe nada: sin esto, el primer
  // render subiría el estado local y pisaría lo que hubiera guardado desde
  // otro teléfono antes siquiera de leerlo.
  const synced = useRef(false)

  // Persist the reconciled state once on mount so migrations/new modules stick.
  useEffect(() => {
    persistLocal(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Traer lo guardado en el perfil. Si el servidor no tiene nada todavía
  // (columna nueva, cuenta antigua), lo local sube tal cual en el primer
  // cambio — no se sube aquí para no escribir en el perfil de quien solo abrió
  // la página.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('stat_prefs')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled || error) return
        const remote = data?.stat_prefs
        if (remote && Array.isArray(remote.enabled)) {
          const next = reconcile(remote)
          setState(prev => {
            if (sameShape(prev, next)) return prev
            persistLocal(next)
            return next
          })
        }
      } catch {
        // Sin red se sigue con lo local: la personalización no es un dato
        // crítico y no merece un error en pantalla.
      } finally {
        if (!cancelled) synced.current = true
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const push = useCallback((next) => {
    persistLocal(next)
    if (!user?.id || !synced.current) return
    supabase.from('profiles')
      .upsert({ id: user.id, stat_prefs: serialize(next), updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('Error saving stat prefs:', error)
      })
  }, [user?.id])

  const toggle = useCallback((id) => {
    setState(prev => {
      const enabled = new Set(prev.enabled)
      enabled.has(id) ? enabled.delete(id) : enabled.add(id)
      const next = { ...prev, enabled, known: new Set(prev.known).add(id) }
      push(next)
      return next
    })
  }, [push])

  const setOrder = useCallback((newOrder) => {
    setState(prev => {
      const ids = allIds()
      const order = newOrder.filter(id => ids.includes(id))
      for (const m of STAT_MODULES) if (!order.includes(m.id)) order.push(m.id)
      const next = { ...prev, order }
      push(next)
      return next
    })
  }, [push])

  return { enabled: state.enabled, order: state.order, toggle, setOrder }
}
