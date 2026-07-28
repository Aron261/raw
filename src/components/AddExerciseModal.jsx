import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useWorkouts } from '../hooks/useWorkout'
import { Sheet, Button } from './ui'
import { MUSCLE_GROUPS } from '../lib/muscleGroups'
import { useExerciseLang } from '../hooks/useExerciseLang'
import { pressable } from '../lib/ui'
import { useLang } from '../hooks/useLang'

/* ── Add / Swap Exercise Modal ──────────────────────────────────────────
 * Reused by the active workout (add/swap) and the routine editor. onAdd is
 * called with (name, muscleGroup) — muscleGroup is set only when creating a
 * brand-new exercise, via the classification step.
 */
export default function AddExerciseModal({ userId, onAdd, onClose, title = 'Agregar ejercicio', subtitle = null, closeOnSelect = false }) {
  const { term } = useExerciseLang()
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState([])
  const [pendingNew, setPendingNew] = useState(null) // nombre de ejercicio nuevo esperando grupo muscular
  const inputRef = useRef(null)

  // Frequent exercises from history (cached) — shown before any typing so the
  // common case is one tap, not a search. Ranked by use count, then recency.
  const { workouts } = useWorkouts()
  const frequents = useMemo(() => {
    const count = new Map()
    const last = new Map()
    for (const w of workouts || []) {
      const t = new Date(w.started_at).getTime()
      for (const we of w.workout_exercises || []) {
        const name = we.exercises?.name
        if (!name) continue
        count.set(name, (count.get(name) || 0) + 1)
        if (!last.has(name) || t > last.get(name)) last.set(name, t)
      }
    }
    return [...count.keys()]
      .sort((a, b) => (count.get(b) - count.get(a)) || (last.get(b) - last.get(a)))
      .slice(0, 8)
  }, [workouts])

  // Focus after the sheet animation completes (320ms) instead of a fixed timeout
  useLayoutEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 340)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = query.trim()

      // Buscar en paralelo: ejercicios propios del usuario + librería global
      const [{ data: own }, { data: lib }] = await Promise.all([
        supabase.from('exercises').select('id, name').eq('user_id', userId).ilike('name', `%${q}%`).order('name').limit(10),
        supabase.from('exercises_library').select('id, name').ilike('name', `%${q}%`).order('name').limit(10),
      ])

      // Fusionar: primero los propios, luego la librería sin repetir nombres
      const seen = new Set((own || []).map(e => e.name.toLowerCase()))
      const merged = [
        ...(own || []),
        ...(lib || []).filter(e => !seen.has(e.name.toLowerCase())),
      ].slice(0, 12)

      setResults(merged)
      setSearching(false)
    }, 220)
    return () => clearTimeout(t)
  }, [query, userId])

  const select = (name) => {
    onAdd(name)
    if (closeOnSelect) { onClose(); return }
    setAdded(prev => [...prev, name])
    setQuery('')
  }
  // Crear ejercicio nuevo → primero pide grupo muscular, luego lo agrega clasificado.
  const create = () => {
    if (!query.trim()) return
    setPendingNew(query.trim())
  }
  const confirmNew = (group) => {
    const name = pendingNew
    if (!name) return
    onAdd(name, group)
    setPendingNew(null)
    if (closeOnSelect) { onClose(); return }
    setAdded(prev => [...prev, name])
    setQuery('')
  }
  const exactMatch = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase())

  if (pendingNew) {
    return (
      <Sheet title="Grupo muscular" onClose={() => setPendingNew(null)}>
        <p style={{ color: 'var(--c-text-dim)', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, marginBottom: '16px' }}>
          ¿Qué grupo muscular trabaja{' '}
          <span style={{ color: 'var(--c-text)', fontWeight: 800 }}>{pendingNew}</span>?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
          {MUSCLE_GROUPS.map(g => (
            <button
              key={g}
              onClick={() => confirmNew(g)}
              style={{
                padding: '11px 16px', borderRadius: '999px',
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
                transition: 'background 120ms var(--ease-out), border-color 120ms var(--ease-out)',
              }}
              {...pressable(0.97, {
                onMouseEnter: e => { e.currentTarget.style.background = 'var(--c-action-dim)'; e.currentTarget.style.borderColor = 'var(--c-action-border)' },
                onMouseLeave: e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' },
              })}
            >
              {term(g)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" full onClick={() => setPendingNew(null)}>{t('Atrás')}</Button>
          <Button variant="ghost" full onClick={() => confirmNew(null)}>{t('Omitir')}</Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !exactMatch) create() }}
          className="input-field"
          placeholder="Buscar o crear ejercicio..."
          style={{ marginBottom: '12px' }}
        />

        <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '8px' }}>
          {searching && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', padding: '8px 0' }}>
              {t('Buscando...')}
            </p>
          )}

          {results.map(ex => (
            <button
              key={ex.id}
              onClick={() => select(ex.name)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '11px 10px',
                color: 'var(--c-text)',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                borderRadius: 'var(--r-xs)',
                transition: `background 120ms var(--ease-out)`,
                display: 'block',
              }}
              {...pressable(0.97, {
                onMouseEnter: e => e.currentTarget.style.background = 'var(--c-surface-2)',
                onMouseLeave: e => e.currentTarget.style.background = 'transparent',
              })}
            >
              {ex.name}
            </button>
          ))}

          {query.trim() && !exactMatch && (
            <button
              onClick={create}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '11px 10px',
                color: 'var(--c-action-text)',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                borderRadius: 'var(--r-xs)',
                border: '1px dashed var(--c-border)',
                marginTop: '8px',
                transition: `background 120ms var(--ease-out), border-color 120ms var(--ease-out)`,
              }}
              {...pressable(0.97, {
                onMouseEnter: e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-accent)' },
                onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border)' },
              })}
            >
              + Crear "{query.trim()}"
            </button>
          )}

          {/* Frequents — one-tap, shown before any typing */}
          {!query.trim() && frequents.length > 0 && (
            <>
              <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', padding: '4px 0 8px' }}>
                {t('Frecuentes')}
              </p>
              {frequents.map(name => {
                const isAdded = added.includes(name)
                return (
                  <button
                    key={name}
                    onClick={() => { if (!isAdded) select(name) }}
                    disabled={isAdded}
                    style={{
                      width: '100%', textAlign: 'left', padding: '11px 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      color: isAdded ? 'var(--c-text-muted)' : 'var(--c-text)',
                      fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
                      borderRadius: 'var(--r-xs)', transition: 'background 120ms var(--ease-out)',
                    }}
                    {...pressable(0.97, {
                      onMouseEnter: e => { if (!isAdded) e.currentTarget.style.background = 'var(--c-surface-2)' },
                      onMouseLeave: e => { e.currentTarget.style.background = 'transparent' },
                    })}
                  >
                    {name}
                    <span style={{ flexShrink: 0, color: isAdded ? 'var(--c-success)' : 'var(--c-text-ghost)', fontSize: '14px', fontWeight: 800 }}>
                      {isAdded ? '✓' : '+'}
                    </span>
                  </button>
                )
              })}
            </>
          )}

          {!searching && !query.trim() && frequents.length === 0 && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '8px 0' }}>
              {t('Escribe para buscar o crear un ejercicio.')}
            </p>
          )}
        </div>

        {/* Lista de ejercicios ya agregados en esta sesión */}
        {!closeOnSelect && added.length > 0 && (
          <div style={{
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: 'var(--r-xs)',
            padding: '10px 12px',
            marginBottom: '8px',
          }}>
            {added.map((name, i) => (
              <div key={i} style={{
                color: 'var(--c-success)',
                fontSize: '11px',
                fontWeight: 700,
                lineHeight: 1.6,
              }}>
                ✓ {name}
              </div>
            ))}
          </div>
        )}

        {/* Botón Listo */}
        {!closeOnSelect && (
          <Button variant="primary" full size="lg" onClick={onClose} style={{ marginBottom: '8px' }}>
            {added.length === 0
              ? 'Listo'
              : `Listo (${added.length} agregado${added.length !== 1 ? 's' : ''})`
            }
          </Button>
        )}
    </Sheet>
  )
}
