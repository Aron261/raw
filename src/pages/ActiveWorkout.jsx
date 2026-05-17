import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import ExerciseRow from '../components/ExerciseRow'
import { useActiveWorkout } from '../hooks/useWorkout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoverColor, ERROR_STYLE } from '../lib/ui'
import { useWorkouts } from '../hooks/useWorkout'

/* ── Timer ──────────────────────────────────────────────────────────── */
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

/* ── Add Exercise Modal ─────────────────────────────────────────────── */
function AddExerciseModal({ userId, onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
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
      const { data } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', `%${query.trim()}%`)
        .order('name')
        .limit(10)
      setResults(data || [])
      setSearching(false)
    }, 220)
    return () => clearTimeout(t)
  }, [query, userId])

  const select = (name) => { onAdd(name); onClose() }
  const create = () => { if (query.trim()) { onAdd(query.trim()); onClose() } }
  const exactMatch = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-sheet"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-subtle)',
          borderBottom: 'none',
          borderRadius: '6px 6px 0 0',
          width: '100%',
          maxWidth: '480px',
          padding: '20px 20px 0',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Handle */}
        <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Add Exercise
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ color: 'var(--c-text-dim)', fontSize: '16px', lineHeight: 1, padding: '4px', transition: `color 120ms var(--ease-out)` }}
            {...hoverColor('var(--c-text)', 'var(--c-text-dim)')}
          >
            ✕
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !exactMatch) create() }}
          className="input-field"
          placeholder="Search or create exercise..."
          style={{ marginBottom: '12px' }}
        />

        <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '8px' }}>
          {searching && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0' }}>
              Searching...
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
                borderRadius: '3px',
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
                borderRadius: '3px',
                border: '1px dashed var(--c-border)',
                marginTop: '8px',
                transition: `background 120ms var(--ease-out), border-color 120ms var(--ease-out)`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            >
              + Create "{query.trim()}"
            </button>
          )}

          {!searching && !query.trim() && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', padding: '8px 0' }}>
              Type to search or create a new exercise.
            </p>
          )}
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
    addExercise, updateUnit, addSet, updateSet, deleteSet, removeExercise,
  } = useActiveWorkout(id)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const nameRef = useRef(null)

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
          <p style={{ color: 'var(--c-accent)', fontSize: '13px' }}>{error || 'Workout not found.'}</p>
          <button onClick={handleBack} className="btn-secondary">← Back</button>
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
            ← Back
          </button>

          {!isFinished && workout.started_at && <WorkoutTimer startedAt={workout.started_at} />}
          {isFinished && (
            <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Finished
            </span>
          )}
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
              onClick={() => !isFinished && setEditingName(true)}
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
              {!isFinished && (
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
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--c-border-subtle)', borderRadius: '4px', marginBottom: '16px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              No exercises yet
            </p>
            {!isFinished && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
                Tap + Add Exercise below to start.
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
                onAddSet={addSet}
                onDeleteSet={deleteSet}
                onUpdateSet={updateSet}
                onUpdateUnit={updateUnit}
                onRemoveExercise={removeExercise}
                readOnly={isFinished}
              />
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        {!isFinished && (
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
              + Add Exercise
            </button>
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {finishing
                ? <><span className="spinner" style={{ borderTopColor: 'var(--c-text)', borderColor: 'rgba(255,255,255,0.2)' }} /><span>Finishing...</span></>
                : 'Finish Workout'
              }
            </button>
          </div>
        )}

        {isFinished && (
          <div style={{ paddingBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={handleBack} className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: '11px' }}>
              ← Back to Home
            </button>
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

      {showAdd && (
        <AddExerciseModal
          userId={user?.id}
          onAdd={handleAddExercise}
          onClose={() => setShowAdd(false)}
        />
      )}
    </Layout>
  )
}
