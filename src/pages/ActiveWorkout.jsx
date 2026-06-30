import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import ExerciseRow from '../components/ExerciseRow'
import { useActiveWorkout, useExercisePR, calc1RM, calcVolume } from '../hooks/useWorkout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoverColor, ERROR_STYLE } from '../lib/ui'
import { useWorkouts } from '../hooks/useWorkout'
import { Sheet, Button } from '../components/ui'

/* ── Workout elapsed timer ───────────────────────────────────────────── */
function WorkoutTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const pad = n => String(n).padStart(2, '0')

  return (
    <span
      style={{
        fontFamily: 'ui-monospace, monospace',
        color: 'var(--c-text-dim)',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {h > 0 && `${pad(h)}:`}{pad(m)}:{pad(s)}
    </span>
  )
}

/* ── Add / Swap Exercise Modal ──────────────────────────────────────── */
function AddExerciseModal({ userId, onAdd, onClose, title = 'Agregar ejercicio', subtitle = null, closeOnSelect = false }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState([])
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
  const create = () => {
    if (!query.trim()) return
    const name = query.trim()
    onAdd(name)
    if (closeOnSelect) { onClose(); return }
    setAdded(prev => [...prev, name])
    setQuery('')
  }
  const exactMatch = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase())

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
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0' }}>
              Buscando...
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
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                borderRadius: '6px',
                transition: `background 120ms var(--ease-out)`,
                display: 'block',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                color: 'var(--c-accent)',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRadius: '6px',
                border: '1px dashed var(--c-border)',
                marginTop: '8px',
                transition: `background 120ms var(--ease-out), border-color 120ms var(--ease-out)`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            >
              + Crear "{query.trim()}"
            </button>
          )}

          {/* Frequents — one-tap, shown before any typing */}
          {!query.trim() && frequents.length > 0 && (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 0 8px' }}>
                Frecuentes
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
                      fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em',
                      borderRadius: '6px', transition: 'background 120ms var(--ease-out)',
                    }}
                    onMouseEnter={e => { if (!isAdded) e.currentTarget.style.background = 'var(--c-surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
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
              Escribe para buscar o crear un ejercicio.
            </p>
          )}
        </div>

        {/* Lista de ejercicios ya agregados en esta sesión */}
        {!closeOnSelect && added.length > 0 && (
          <div style={{
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '8px',
          }}>
            {added.map((name, i) => (
              <div key={i} style={{
                color: 'var(--c-success)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
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

/* ── Finish Confirm Modal ───────────────────────────────────────────── */
function FinishConfirmModal({ workout, workoutExercises, onConfirm, onCancel }) {
  // Calcular duración desde started_at hasta ahora
  const durationLabel = () => {
    if (!workout?.started_at) return '—'
    const diffSecs = Math.floor((Date.now() - new Date(workout.started_at).getTime()) / 1000)
    const h = Math.floor(diffSecs / 3600)
    const m = Math.floor((diffSecs % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const totalSets = workoutExercises.reduce((acc, we) => acc + (we.sets?.length || 0), 0)

  const stats = [
    { label: 'Duración', value: durationLabel() },
    { label: 'Ejercicios', value: workoutExercises.length },
    { label: 'Series totales', value: totalSets },
  ]

  return (
    <Sheet title="Finalizar entreno" onClose={onCancel}>
      <div style={{ background: 'var(--c-surface-2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', lineHeight: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label}
            </span>
            <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', textAlign: 'center', marginBottom: '16px' }}>
        Esta acción no se puede deshacer.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" onClick={onConfirm}>Sí, finalizar</Button>
        <Button variant="secondary" full size="lg" onClick={onCancel}>Cancelar</Button>
      </div>
    </Sheet>
  )
}

/* ── Discard Confirm Modal ──────────────────────────────────────────── */
function DiscardConfirmModal({ onConfirm, onCancel, busy }) {
  return (
    <Sheet title="Descartar entreno" onClose={onCancel}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        Se eliminará esta sesión y todo lo que llevas registrado en ella. Esta acción no se puede deshacer.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" loading={busy} disabled={busy} onClick={onConfirm}>
          {busy ? 'Descartando...' : 'Sí, descartar'}
        </Button>
        <Button variant="secondary" full size="lg" disabled={busy} onClick={onCancel}>
          Seguir entrenando
        </Button>
      </div>
    </Sheet>
  )
}

/* ── Edit Confirm Modal ─────────────────────────────────────────────── */
function EditConfirmModal({ step, onFirstConfirm, onSecondConfirm, onCancel }) {
  return (
    <Sheet title={step === 1 ? 'Editar entreno finalizado' : 'Confirmar edición'} onClose={onCancel}>
      {step === 1 ? (
        <>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
            Vas a editar un entreno que ya fue registrado. Esto modifica tu historial.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="secondary" full size="lg" onClick={onFirstConfirm}>Entiendo, continuar</Button>
            <Button variant="ghost" full size="lg" onClick={onCancel}>Cancelar</Button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
            ¿Estás seguro? Los cambios se guardan inmediatamente.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="primary" full size="lg" onClick={onSecondConfirm}>Sí, editar</Button>
            <Button variant="secondary" full size="lg" onClick={onCancel}>Cancelar</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}

/* ── Exercise history sheet ─────────────────────────────────────────── */
function ExerciseHistorySheet({ exercise, userId, onClose }) {
  const { prSets, allTimePR, loading } = useExercisePR(exercise?.name, userId)
  const sessions = [...(prSets || [])].reverse() // most recent first
  const bestRM = allTimePR?.best1RM || 0

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return '' }
  }

  return (
    <Sheet title={exercise?.name || 'Historial'} subtitle="Sesiones anteriores" onClose={onClose}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <span className="spinner" style={{ width: '18px', height: '18px' }} />
        </div>
      ) : sessions.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
          Aún no hay sesiones registradas de este ejercicio.
        </p>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
          {sessions.map((s, i) => {
            const isBest = bestRM > 0 && s.best1RM >= bestRM
            return (
              <div key={s.workoutId || i} style={{
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                borderRadius: '12px', padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-dim)' }}>
                    {fmtDate(s.date)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isBest && (
                      <span style={{ background: 'var(--c-record)', color: 'var(--c-record-ink)', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', borderRadius: '2px' }}>
                        Récord
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                      <span style={{ color: 'var(--c-data)', fontWeight: 800 }}>~{s.best1RM}</span> 1RM
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(s.sets || []).map((set, j) => (
                    <span key={set.id || j} style={{
                      fontSize: '13px', fontWeight: 800, color: 'var(--c-text)',
                      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
                      borderRadius: '8px', padding: '4px 8px', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {set.reps}×{set.weight}<span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--c-text-dim)', marginLeft: '2px' }}>{s.unit}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/* ── Session summary (on finish) ────────────────────────────────────── */
function SessionSummary({ workout, workoutExercises, userId, onClose }) {
  const [prIds, setPrIds] = useState(null) // Set<exercise_id> beating a prior best; null = loading

  const allSets = workoutExercises.flatMap(we => (we.sets || []).map(s => ({ ...s, unit: we.unit })))
  const totalVolume = Math.round(calcVolume(allSets))
  const totalSets = allSets.length

  const durationLabel = () => {
    const start = new Date(workout.started_at).getTime()
    const end = workout.ended_at ? new Date(workout.ended_at).getTime() : Date.now()
    const mins = Math.max(0, Math.floor((end - start) / 60000))
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const perExercise = workoutExercises.map(we => {
    const sets = we.sets || []
    const best1RM = sets.reduce((b, s) => Math.max(b, calc1RM(s.weight, s.reps)), 0)
    const topSet = sets.reduce((t, s) => (calc1RM(s.weight, s.reps) > (t ? calc1RM(t.weight, t.reps) : 0) ? s : t), null)
    return { exerciseId: we.exercises?.id, name: we.exercises?.name, unit: we.unit, count: sets.length, best1RM, topSet }
  }).filter(e => e.count > 0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ids = perExercise.map(e => e.exerciseId).filter(Boolean)
      if (!ids.length) { setPrIds(new Set()); return }
      try {
        const { data, error } = await supabase
          .from('sets')
          .select('reps, weight, workout_exercises!inner(exercise_id, workout_id, workouts!inner(user_id))')
          .eq('workout_exercises.workouts.user_id', userId)
          .in('workout_exercises.exercise_id', ids)
        if (error) throw error
        // Best 1RM per exercise from sessions OTHER than this one.
        const prevBest = {}
        for (const row of (data || [])) {
          const we = row.workout_exercises
          if (!we || we.workout_id === workout.id) continue
          const rm = calc1RM(row.weight, row.reps)
          if (rm > (prevBest[we.exercise_id] || 0)) prevBest[we.exercise_id] = rm
        }
        const prs = new Set()
        for (const e of perExercise) {
          const prev = prevBest[e.exerciseId] || 0
          if (e.exerciseId && prev > 0 && e.best1RM > prev) prs.add(e.exerciseId)
        }
        if (!cancelled) setPrIds(prs)
      } catch { if (!cancelled) setPrIds(new Set()) }
    }
    run()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const prCount = prIds ? prIds.size : 0

  return (
    <Sheet title={workout.name} subtitle="Entreno completo" onClose={onClose}>
      {/* Hero — volume leads (data voice) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px',
        background: 'var(--c-border-subtle)', border: '1px solid var(--c-border-subtle)',
        borderRadius: '12px', overflow: 'hidden', marginBottom: '14px',
      }}>
        <SummaryStat value={totalVolume.toLocaleString('es-ES')} unit="kg" label="Volumen" valueColor="var(--c-data)" />
        <SummaryStat value={durationLabel()} label="Duración" />
        <SummaryStat value={totalSets} label="Series" />
      </div>

      {/* PR line — only when earned */}
      {prCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px',
          background: 'var(--c-record)', color: 'var(--c-record-ink)',
          borderRadius: '10px', padding: '10px 12px',
        }}>
          <span style={{ fontSize: '14px' }}>🏆</span>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {prCount} {prCount === 1 ? 'récord nuevo' : 'récords nuevos'}
          </span>
        </div>
      )}

      {/* Per-exercise recap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '38vh', overflowY: 'auto', marginBottom: '16px' }}>
        {perExercise.map((e, i) => {
          const isPR = prIds?.has(e.exerciseId)
          return (
            <div key={e.exerciseId || i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 2px', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.name}
              </span>
              {isPR && (
                <span style={{ flexShrink: 0, background: 'var(--c-record)', color: 'var(--c-record-ink)', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', borderRadius: '2px' }}>PR</span>
              )}
              <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: 'var(--c-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {e.count} ser{e.topSet ? <> · {e.topSet.reps}×{e.topSet.weight}{e.unit}</> : ''}
              </span>
            </div>
          )
        })}
      </div>

      <Button variant="primary" full size="lg" onClick={onClose}>Listo</Button>
    </Sheet>
  )
}

function SummaryStat({ value, unit, label, valueColor = 'var(--c-text)' }) {
  return (
    <div style={{ background: 'var(--c-surface)', padding: '14px 8px', textAlign: 'center' }}>
      <p style={{ color: valueColor, fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)', marginLeft: '2px' }}>{unit}</span>}
      </p>
      <p className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', marginTop: '6px' }}>
        {label}
      </p>
    </div>
  )
}

/* ── First-run logging primer ───────────────────────────────────────── */
// One-time, dismissable hint that teaches the three logging mechanics in
// Raw's own vocabulary (the green ✓, auto-save, the faded previous value).
// Non-blocking; persists dismissal to localStorage so it shows once.
const LOGGING_PRIMER_KEY = 'raw_onboard_logging'

function LoggingPrimer({ onDismiss }) {
  const chip = {
    flexShrink: 0, width: '26px', height: '26px', borderRadius: '8px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
  const text = { color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.4 }

  return (
    <div className="fade-in" style={{
      position: 'relative',
      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
      borderRadius: '14px', padding: '16px', marginBottom: '12px',
    }}>
      <button
        onClick={onDismiss}
        aria-label="Entendido, no mostrar de nuevo"
        style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--c-text-ghost)', fontSize: '14px', lineHeight: 1, padding: '6px' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)' }}
      >
        ✕
      </button>

      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
        Cómo registrar
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {/* ✓ — the real done control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-success)', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span style={text}>Marca la serie como hecha e inicia el descanso.</span>
        </div>

        {/* auto-save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 21h14" /></svg>
          </span>
          <span style={text}>Tus reps y peso se guardan solos al salir del campo.</span>
        </div>

        {/* ghost previous value */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-ghost)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>
            8×
          </span>
          <span style={text}>El número tenue en cada campo es tu última vez.</span>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function ActiveWorkout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { deleteWorkout } = useWorkouts()

  const {
    workout, workoutExercises, loading, error,
    updateWorkoutName, finishWorkout,
    addExercise, replaceExercise, updateUnit, updateExerciseNotes, addSet, updateSet, deleteSet, removeExercise, moveExercise,
  } = useActiveWorkout(id)

  const [historyExercise, setHistoryExercise] = useState(null)
  const [showSummary, setShowSummary] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [swappingId, setSwappingId] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [primerDismissed, setPrimerDismissed] = useState(() => {
    try { return localStorage.getItem(LOGGING_PRIMER_KEY) === 'done' } catch { return false }
  })
  const dismissPrimer = () => {
    setPrimerDismissed(true)
    try { localStorage.setItem(LOGGING_PRIMER_KEY, 'done') } catch {}
  }
  const [isEditing, setIsEditing] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [editConfirmStep, setEditConfirmStep] = useState(1)
  const nameRef = useRef(null)

  // Per-set completion + finished exercises — persisted locally per workout so
  // progress survives a reload mid-session without touching the database.
  const [doneSets, setDoneSets] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`raw_done_sets_${id}`) || '[]')) } catch { return new Set() }
  })
  const [doneExs, setDoneExs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`raw_done_ex_${id}`) || '[]')) } catch { return new Set() }
  })
  useEffect(() => { try { localStorage.setItem(`raw_done_sets_${id}`, JSON.stringify([...doneSets])) } catch {} }, [doneSets, id])
  useEffect(() => { try { localStorage.setItem(`raw_done_ex_${id}`, JSON.stringify([...doneExs])) } catch {} }, [doneExs, id])

  const toggleSetDone = useCallback((setId, nextDone) => {
    setDoneSets(prev => {
      const next = new Set(prev)
      if (nextDone) next.add(setId); else next.delete(setId)
      return next
    })
  }, [])

  const toggleExerciseFinish = useCallback((weId, nextFinished) => {
    setDoneExs(prev => {
      const next = new Set(prev)
      if (nextFinished) next.add(weId); else next.delete(weId)
      return next
    })
  }, [])


  const isFinished = !!workout?.ended_at

  useEffect(() => {
    if (workout && workout.name !== nameInput && !editingName) setNameInput(workout.name)
  }, [workout])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  const saveName = async () => {
    if (nameInput.trim() && nameInput.trim() !== workout.name) {
      try { await updateWorkoutName(nameInput.trim()) } catch {}
    }
    setEditingName(false)
  }

  const handleFinish = async () => {
    setShowFinishConfirm(false)
    setFinishError(null)
    setFinishing(true)
    try {
      await finishWorkout()
      // Clear local completion flags for this session — it's logged now.
      try { localStorage.removeItem(`raw_done_sets_${id}`); localStorage.removeItem(`raw_done_ex_${id}`) } catch {}
      setFinishing(false)
      setShowSummary(true)
    } catch (err) {
      setFinishError(err.message)
      setFinishing(false)
    }
  }

  const handleDiscard = async () => {
    setDiscarding(true)
    setFinishError(null)
    try {
      await deleteWorkout(workout.id)
      try { localStorage.removeItem(`raw_done_sets_${id}`); localStorage.removeItem(`raw_done_ex_${id}`) } catch {}
      navigate('/', { replace: true })
    } catch (err) {
      setFinishError(err.message)
      setDiscarding(false)
      setShowDiscardConfirm(false)
    }
  }

  const handleAddExercise = async (name) => {
    try { await addExercise(name) } catch (err) { console.error(err) }
  }

  const handleSwapExercise = async (name) => {
    if (!swappingId) return
    try { await replaceExercise(swappingId, name) } catch (err) { console.error(err) }
    setSwappingId(null)
  }

  // Prefer explicit home navigation over navigate(-1) — safer when arriving via direct URL
  const handleBack = () => navigate('/')

  if (loading) {
    return (
      <Layout hideNav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
          <span className="spinner" style={{ width: '20px', height: '20px' }} />
        </div>
      </Layout>
    )
  }

  if (error || !workout) {
    return (
      <Layout hideNav>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '16px', padding: '24px' }}>
          <p style={{ color: 'var(--c-accent)', fontSize: '13px' }}>{error || 'Entreno no encontrado.'}</p>
          <Button variant="secondary" onClick={handleBack}>← Atrás</Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout hideNav>
      <div className="fade-in" style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', paddingBottom: '16px' }}>
          <button
            onClick={handleBack}
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--c-text-dim)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: `color 150ms var(--ease-out)`,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            {...hoverColor('var(--c-text)', 'var(--c-text-dim)')}
          >
            ← Atrás
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isFinished && workout.started_at && <WorkoutTimer startedAt={workout.started_at} />}
            {isFinished && (
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Finalizado
              </span>
            )}
          </div>
        </div>

        {/* Workout name */}
        <div style={{ marginBottom: '20px' }}>
          {editingName ? (
            <input
              ref={nameRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
              className="input-field"
              style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}
            />
          ) : (
            <button
              onClick={() => (!isFinished || isEditing) && setEditingName(true)}
              style={{
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {workout.name}
              </span>
              {(!isFinished || isEditing) && (
                <span style={{ color: 'var(--c-text-ghost)', fontSize: '12px', marginTop: '2px' }}>✎</span>
              )}
            </button>
          )}
        </div>

        {/* Session progress — exercises finalized */}
        {!isFinished && workoutExercises.length > 0 && (() => {
          const finishedCount = workoutExercises.filter(we => doneExs.has(we.id)).length
          const total = workoutExercises.length
          const pct = Math.round((finishedCount / total) * 100)
          const allDone = finishedCount === total
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '999px', background: 'var(--c-surface-2)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: '999px',
                  background: 'var(--c-success)',
                  transition: 'width 320ms var(--ease-out)',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
                color: allDone ? 'var(--c-success)' : 'var(--c-text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {finishedCount}/{total} hechos
              </span>
            </div>
          )
        })()}

        {/* Empty state */}
        {workoutExercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: '14px', marginBottom: '16px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
              Sin ejercicios aún
            </p>
            {!isFinished && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
                Agrega tu primer ejercicio para empezar a registrar tus series.
              </p>
            )}
          </div>
        )}

        {/* First-run logging primer — teaches the loop where it happens */}
        {!isFinished && !primerDismissed && workoutExercises.length > 0 && (
          <LoggingPrimer onDismiss={dismissPrimer} />
        )}

        {/* Exercise list — finished exercises collapse and rise to the top;
            the ones still to do stay at the bottom. Move arrows operate within
            the pending sublist. */}
        <div style={{ marginBottom: '8px' }}>
          {(() => {
            const finished = workoutExercises.filter(we => doneExs.has(we.id))
            const pending  = workoutExercises.filter(we => !doneExs.has(we.id))
            const display  = [...finished, ...pending]
            return display.map((we, i) => {
              const exFinished = doneExs.has(we.id)
              const pIdx = exFinished ? -1 : pending.findIndex(p => p.id === we.id)
              return (
                <div key={we.id} className="stagger-item" style={{ animationDelay: `${i * 40}ms` }}>
                  <ExerciseRow
                    workoutExercise={we}
                    workoutId={id}
                    onAddSet={addSet}
                    onDeleteSet={deleteSet}
                    onUpdateSet={updateSet}
                    onUpdateUnit={updateUnit}
                    onRemoveExercise={removeExercise}
                    onSwapExercise={(!isFinished || isEditing) ? (weId) => setSwappingId(weId) : undefined}
                    onUpdateNotes={(!isFinished || isEditing) ? updateExerciseNotes : undefined}
                    completedSetIds={doneSets}
                    onToggleSetDone={toggleSetDone}
                    isExerciseFinished={exFinished}
                    onToggleFinish={toggleExerciseFinish}
                    onShowHistory={setHistoryExercise}
                    onMove={(!isFinished || isEditing) ? moveExercise : undefined}
                    canMoveUp={!exFinished && pIdx > 0}
                    canMoveDown={!exFinished && pIdx < pending.length - 1}
                    readOnly={isFinished && !isEditing}
                  />
                </div>
              )
            })
          })()}
        </div>

        {/* Bottom actions */}
        {(!isFinished || isEditing) && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--c-bg-glass)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              paddingTop: '12px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              borderTop: '1px solid var(--c-surface-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            {/* Error surfaces right where the action that caused it lives */}
            {finishError && (
              <div style={{ ...ERROR_STYLE }}>
                {finishError}
              </div>
            )}
            <Button variant="secondary" full size="lg" onClick={() => setShowAdd(true)}>
              + Agregar ejercicio
            </Button>
            {isEditing ? (
              <Button variant="primary" full size="lg" onClick={() => setIsEditing(false)}>
                Guardar y cerrar edición
              </Button>
            ) : (
              <Button
                variant="primary"
                full
                size="lg"
                loading={finishing}
                disabled={finishing}
                onClick={() => setShowFinishConfirm(true)}
              >
                {finishing ? 'Finalizando...' : 'Finalizar entreno'}
              </Button>
            )}
            {!isEditing && (
              <button
                onClick={() => setShowDiscardConfirm(true)}
                style={{
                  alignSelf: 'center', marginTop: '2px',
                  color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '6px 12px', background: 'transparent',
                  transition: 'color 150ms var(--ease-out)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)' }}
              >
                Descartar entreno
              </button>
            )}
          </div>
        )}

        {isFinished && (
          <div style={{ paddingBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="secondary" full size="lg" onClick={handleBack}>
              ← Volver al inicio
            </Button>

            {!isEditing ? (
              <button
                onClick={() => { setEditConfirmStep(1); setShowEditConfirm(true) }}
                style={{
                  width: '100%', padding: '14px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--c-text-dim)', border: '1px solid var(--c-border-subtle)',
                  borderRadius: '10px', transition: 'color 150ms, border-color 150ms',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
              >
                Editar entreno
              </button>
            ) : (
              <>
                <Button variant="primary" full size="lg" onClick={() => setIsEditing(false)}>
                  Guardar cambios
                </Button>
                <Button variant="secondary" full size="lg" onClick={() => setIsEditing(false)}>
                  Cancelar edición
                </Button>
              </>
            )}

            <button
              onClick={async () => {
                if (!window.confirm(`¿Eliminar "${workout.name}"? Esta acción no se puede deshacer.`)) return
                try { await deleteWorkout(workout.id); navigate('/', { replace: true }) }
                catch (e) { console.error(e) }
              }}
              style={{
                width: '100%', padding: '14px', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--c-text-dim)', border: '1px solid var(--c-border-subtle)',
                borderRadius: '10px', transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
                background: 'transparent', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-accent)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
            >
              Eliminar este entreno
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddExerciseModal
          userId={user?.id}
          onAdd={handleAddExercise}
          onClose={() => setShowAdd(false)}
          closeOnSelect={false}
        />
      )}

      {swappingId && (
        <AddExerciseModal
          userId={user?.id}
          title="Cambiar ejercicio"
          subtitle="Solo cambia en este entreno, tu rutina no se modifica."
          onAdd={handleSwapExercise}
          onClose={() => setSwappingId(null)}
          closeOnSelect={true}
        />
      )}

      {showSummary && (
        <SessionSummary
          workout={workout}
          workoutExercises={workoutExercises}
          userId={user?.id}
          onClose={() => navigate('/', { replace: true })}
        />
      )}

      {historyExercise && (
        <ExerciseHistorySheet
          exercise={historyExercise}
          userId={user?.id}
          onClose={() => setHistoryExercise(null)}
        />
      )}

      {showFinishConfirm && (
        <FinishConfirmModal
          workout={workout}
          workoutExercises={workoutExercises}
          onConfirm={handleFinish}
          onCancel={() => setShowFinishConfirm(false)}
        />
      )}

      {showDiscardConfirm && (
        <DiscardConfirmModal
          busy={discarding}
          onConfirm={handleDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}

      {showEditConfirm && (
        <EditConfirmModal
          step={editConfirmStep}
          onFirstConfirm={() => setEditConfirmStep(2)}
          onSecondConfirm={() => { setIsEditing(true); setShowEditConfirm(false); setEditConfirmStep(1) }}
          onCancel={() => { setShowEditConfirm(false); setEditConfirmStep(1) }}
        />
      )}
    </Layout>
  )
}
