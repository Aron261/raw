import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import ExerciseRow from '../components/ExerciseRow'
import { useActiveWorkout } from '../hooks/useWorkout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoverColor, ERROR_STYLE } from '../lib/ui'
import { useWorkouts } from '../hooks/useWorkout'
import { Sheet, Button } from '../components/ui'

/* ── Rest Timer ─────────────────────────────────────────────────────── */
const REST_PRESETS = [60, 90, 120, 180] // seconds

function RestTimer({ onDone, onDismiss }) {
  const [duration, setDuration] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running, setRunning] = useState(true)

  // Reset remaining when duration changes
  useEffect(() => { setRemaining(duration); setRunning(true) }, [duration])

  useEffect(() => {
    if (!running) return
    if (remaining <= 0) {
      // Vibrate on finish (mobile)
      try { navigator.vibrate?.([200, 100, 200]) } catch {}
      setRunning(false)
      onDone?.()
      return
    }
    const id = setInterval(() => setRemaining(r => r - 1), 1000)
    return () => clearInterval(id)
  }, [running, remaining, onDone])

  const pct = Math.max(0, remaining / duration)
  const pad = n => String(n).padStart(2, '0')
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const done = remaining <= 0

  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '999px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px 10px 20px',
        minWidth: '220px',
      }}
    >
      {/* Circular progress ring */}
      <svg width="32" height="32" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="16" cy="16" r="13" fill="none" stroke="var(--c-border-subtle)" strokeWidth="2.5" />
        <circle
          cx="16" cy="16" r="13" fill="none"
          stroke={done ? 'var(--c-success)' : 'var(--c-accent)'}
          strokeWidth="2.5"
          strokeDasharray={`${2 * Math.PI * 13}`}
          strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 300ms' }}
        />
      </svg>

      {/* Time display */}
      <span style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '18px', fontWeight: 800,
        color: done ? 'var(--c-success)' : 'var(--c-text)',
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        minWidth: '48px',
      }}>
        {done ? '✓' : `${pad(mins)}:${pad(secs)}`}
      </span>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {REST_PRESETS.map(s => (
          <button
            key={s}
            onClick={() => setDuration(s)}
            style={{
              fontSize: '9px', fontWeight: 800,
              padding: '3px 6px', borderRadius: '999px',
              background: duration === s ? 'var(--c-surface-2)' : 'transparent',
              border: `1px solid ${duration === s ? 'var(--c-border)' : 'transparent'}`,
              color: duration === s ? 'var(--c-text)' : 'var(--c-text-ghost)',
              transition: 'all 150ms',
            }}
          >
            {s < 60 ? `${s}s` : `${s / 60}m`}
          </button>
        ))}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{ color: 'var(--c-text-ghost)', fontSize: '14px', padding: '4px', lineHeight: 1, transition: 'color 120ms' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-ghost)' }}
      >
        ✕
      </button>
    </div>
  )
}

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

          {!searching && !query.trim() && (
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
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '11px', marginBottom: '8px' }}
          >
            {added.length === 0
              ? 'Listo'
              : `Listo (${added.length} agregado${added.length !== 1 ? 's' : ''})`
            }
          </button>
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

/* ── Main page ──────────────────────────────────────────────────────── */
export default function ActiveWorkout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { deleteWorkout } = useWorkouts()

  const {
    workout, workoutExercises, loading, error,
    updateWorkoutName, finishWorkout,
    addExercise, replaceExercise, updateUnit, updateExerciseNotes, addSet, updateSet, deleteSet, removeExercise,
  } = useActiveWorkout(id)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [swappingId, setSwappingId] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [editConfirmStep, setEditConfirmStep] = useState(1)
  const nameRef = useRef(null)

  // Rest timer
  const [restEnabled, setRestEnabled] = useState(() => {
    try { return localStorage.getItem('raw_rest_timer') !== 'off' } catch { return true }
  })
  const [restActive, setRestActive] = useState(false)

  const toggleRest = () => {
    const next = !restEnabled
    setRestEnabled(next)
    try { localStorage.setItem('raw_rest_timer', next ? 'on' : 'off') } catch {}
    if (!next) setRestActive(false)
  }

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
      navigate('/', { replace: true })
    } catch (err) {
      setFinishError(err.message)
      setFinishing(false)
    }
  }

  const handleAddExercise = async (name) => {
    try { await addExercise(name) } catch (err) { console.error(err) }
  }

  // Wrap addSet to trigger rest timer automatically
  const handleAddSet = useCallback(async (weId, reps, weight) => {
    await addSet(weId, reps, weight)
    if (restEnabled) setRestActive(true)
  }, [addSet, restEnabled])

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
          <button onClick={handleBack} className="btn-secondary">← Atrás</button>
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
            {/* Rest timer toggle */}
            {!isFinished && (
              <button
                onClick={toggleRest}
                title={restEnabled ? 'Desactivar descanso' : 'Activar descanso'}
                style={{
                  fontSize: '16px', lineHeight: 1, padding: '4px',
                  opacity: restEnabled ? 1 : 0.35,
                  transition: 'opacity 200ms',
                }}
              >
                ⏱
              </button>
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

        {finishError && (
          <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>
            {finishError}
          </div>
        )}

        {/* Empty state */}
        {workoutExercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--c-border-subtle)', borderRadius: '6px', marginBottom: '16px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sin ejercicios aún
            </p>
            {!isFinished && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
                Tap + Agregar ejercicio below to start.
              </p>
            )}
          </div>
        )}

        {/* Exercise list */}
        <div style={{ marginBottom: '8px' }}>
          {workoutExercises.map((we, i) => (
            <div key={we.id} className="stagger-item" style={{ animationDelay: `${i * 40}ms` }}>
              <ExerciseRow
                workoutExercise={we}
                workoutId={id}
                onAddSet={handleAddSet}
                onDeleteSet={deleteSet}
                onUpdateSet={updateSet}
                onUpdateUnit={updateUnit}
                onRemoveExercise={removeExercise}
                onSwapExercise={(!isFinished || isEditing) ? (weId) => setSwappingId(weId) : undefined}
                onUpdateNotes={(!isFinished || isEditing) ? updateExerciseNotes : undefined}
                readOnly={isFinished && !isEditing}
              />
            </div>
          ))}
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
            <button
              onClick={() => setShowAdd(true)}
              className="btn-secondary"
              style={{ width: '100%', padding: '14px', fontSize: '11px' }}
            >
              + Agregar ejercicio
            </button>
            {isEditing ? (
              <button
                onClick={() => setIsEditing(false)}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '11px' }}
              >
                Guardar y cerrar edición
              </button>
            ) : (
              <button
                onClick={() => setShowFinishConfirm(true)}
                disabled={finishing}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {finishing
                  ? <><span className="spinner" style={{ borderTopColor: 'var(--c-text)', borderColor: 'rgba(255,255,255,0.2)' }} /><span>Finalizando...</span></>
                  : 'Finalizar entreno'
                }
              </button>
            )}
          </div>
        )}

        {isFinished && (
          <div style={{ paddingBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={handleBack} className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: '11px' }}>
              ← Volver al inicio
            </button>

            {!isEditing ? (
              <button
                onClick={() => { setEditConfirmStep(1); setShowEditConfirm(true) }}
                style={{
                  width: '100%', padding: '14px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--c-text-dim)', border: '1px solid var(--c-border-subtle)',
                  borderRadius: '2px', transition: 'color 150ms, border-color 150ms',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'oklch(70% 0.15 260)'; e.currentTarget.style.borderColor = 'oklch(70% 0.15 260)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
              >
                Editar entreno
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '11px' }}
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '14px', fontSize: '11px' }}
                >
                  Cancelar edición
                </button>
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
                borderRadius: '2px', transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-accent)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
            >
              Eliminar este entreno
            </button>
          </div>
        )}
      </div>

      {/* Rest timer overlay */}
      {restActive && (
        <RestTimer
          onDone={() => {}}
          onDismiss={() => setRestActive(false)}
        />
      )}

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

      {showFinishConfirm && (
        <FinishConfirmModal
          workout={workout}
          workoutExercises={workoutExercises}
          onConfirm={handleFinish}
          onCancel={() => setShowFinishConfirm(false)}
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
