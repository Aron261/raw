import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useRoutines } from '../hooks/useRoutines'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { pressProps, hoverColor, ERROR_STYLE } from '../lib/ui'

// ── Exercise search input ──────────────────────────────────────────────
function ExerciseSearch({ onAdd, userId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = query.trim()

      // Buscar en paralelo: ejercicios propios del usuario + librería global
      const [{ data: own }, { data: lib }] = await Promise.all([
        supabase.from('exercises').select('id, name').eq('user_id', userId).ilike('name', `%${q}%`).order('name').limit(8),
        supabase.from('exercises_library').select('id, name').ilike('name', `%${q}%`).order('name').limit(8),
      ])

      // Fusionar: primero los propios, luego la librería sin repetir nombres
      const seen = new Set((own || []).map(e => e.name.toLowerCase()))
      const merged = [
        ...(own || []),
        ...(lib || []).filter(e => !seen.has(e.name.toLowerCase())),
      ].slice(0, 10)

      setResults(merged)
      setSearching(false)
    }, 200)
    return () => clearTimeout(t)
  }, [query, userId])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const exactMatch = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase())

  const select = (name) => {
    onAdd(name)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const create = () => {
    if (query.trim()) { select(query.trim()) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter') create() }}
          placeholder="Buscar o crear ejercicio..."
          className="input-field"
          style={{ flex: 1, fontSize: '12px' }}
        />
        <button
          onClick={create}
          disabled={!query.trim()}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '10px', flexShrink: 0 }}
        >
          + Add
        </button>
      </div>

      {open && (query.trim() || results.length > 0) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)',
          borderRadius: '4px',
          overflow: 'hidden',
          zIndex: 20,
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {results.map(ex => (
            <button
              key={ex.id}
              onClick={() => select(ex.name)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 14px',
                color: 'var(--c-text)',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                transition: `background 100ms var(--ease-out)`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-border)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {ex.name}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              onClick={create}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 14px',
                color: 'var(--c-accent)',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderTop: results.length ? '1px solid var(--c-border)' : 'none',
                transition: `background 100ms var(--ease-out)`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-border)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              + Crear "{query.trim()}"
            </button>
          )}
          {searching && (
            <p style={{ padding: '10px 14px', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Buscando...
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Routine exercise row ───────────────────────────────────────────────
function RoutineExerciseRow({ re, routineId, isFirst, isLast, onUpdate, onRemove, onMove }) {
  const [sets, setSets] = useState(String(re.default_sets))
  const [reps, setReps] = useState(String(re.default_reps))
  const [weight, setWeight] = useState(String(re.default_weight || ''))

  const save = () => {
    onUpdate(re.id, {
      default_sets: parseInt(sets, 10) || re.default_sets,
      default_reps: parseInt(reps, 10) || re.default_reps,
      default_weight: parseFloat(weight) || null,
    })
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 0',
      borderBottom: '1px solid var(--c-border-subtle)',
    }}>
      {/* Reorder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
        <button
          onClick={() => onMove(routineId, re.id, 'up')}
          disabled={isFirst}
          style={{ color: isFirst ? 'var(--c-border)' : 'var(--c-text-ghost)', fontSize: '10px', lineHeight: 1, padding: '2px', transition: `color 120ms` }}
          onMouseEnter={e => !isFirst && (e.currentTarget.style.color = 'var(--c-text-secondary)')}
          onMouseLeave={e => !isFirst && (e.currentTarget.style.color = 'var(--c-text-ghost)')}
        >▲</button>
        <button
          onClick={() => onMove(routineId, re.id, 'down')}
          disabled={isLast}
          style={{ color: isLast ? 'var(--c-border)' : 'var(--c-text-ghost)', fontSize: '10px', lineHeight: 1, padding: '2px', transition: `color 120ms` }}
          onMouseEnter={e => !isLast && (e.currentTarget.style.color = 'var(--c-text-secondary)')}
          onMouseLeave={e => !isLast && (e.currentTarget.style.color = 'var(--c-text-ghost)')}
        >▼</button>
      </div>

      {/* Name */}
      <span style={{ flex: 1, color: 'var(--c-text)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {re.exercises?.name}
      </span>

      {/* Sets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <input type="number" value={sets} onChange={e => setSets(e.target.value)} onBlur={save}
          className="input-field" min="1"
          style={{ width: '40px', textAlign: 'center', fontSize: '12px', fontWeight: 700, padding: '5px 4px' }}
        />
        <span style={{ color: 'var(--c-text-ghost)', fontSize: '10px' }}>×</span>
        <input type="number" value={reps} onChange={e => setReps(e.target.value)} onBlur={save}
          className="input-field" min="1"
          style={{ width: '40px', textAlign: 'center', fontSize: '12px', fontWeight: 700, padding: '5px 4px' }}
        />
      </div>

      {/* Weight + unit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <input type="number" value={weight} onChange={e => setWeight(e.target.value)} onBlur={save}
          className="input-field" min="0" step="2.5" placeholder="—"
          style={{ width: '52px', textAlign: 'center', fontSize: '12px', fontWeight: 700, padding: '5px 4px' }}
        />
        <button
          onClick={() => onUpdate(re.id, { unit: re.unit === 'lb' ? 'kg' : 'lb' })}
          style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--c-border)', padding: '3px 6px', borderRadius: '2px', flexShrink: 0, transition: `color 120ms` }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-dim)'}
        >
          {re.unit}
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(re.id)}
        aria-label="Eliminar ejercicio"
        style={{ color: 'var(--c-text-ghost)', fontSize: '13px', lineHeight: 1, padding: '4px', flexShrink: 0, transition: `color 150ms var(--ease-out)` }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
      >✕</button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────
export default function Routines() {
  const { user } = useAuth()
  const {
    routines, loading, error,
    createRoutine, deleteRoutine, updateRoutineName,
    addExerciseToRoutine, removeExerciseFromRoutine,
    updateRoutineExercise, moveExercise,
  } = useRoutines()

  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameRef = useRef(null)

  // Auto-select first routine when list loads
  useEffect(() => {
    if (!selectedId && routines.length > 0) setSelectedId(routines[0].id)
  }, [routines])

  const selected = routines.find(r => r.id === selectedId) || null

  useEffect(() => {
    if (selected) setNameInput(selected.name)
  }, [selected?.id])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  const handleCreate = async () => {
    setCreating(true)
    setActionError(null)
    try {
      const r = await createRoutine()
      setSelectedId(r.id)
      setEditingName(true)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm(`¿Eliminar "${selected.name}"?`)) return
    setDeleting(true)
    try {
      await deleteRoutine(selected.id)
      setSelectedId(null)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const saveName = async () => {
    if (nameInput.trim() && nameInput.trim() !== selected?.name) {
      try { await updateRoutineName(selected.id, nameInput.trim()) } catch {}
    }
    setEditingName(false)
  }

  const handleAddExercise = async (name) => {
    if (!selected) return
    setActionError(null)
    try { await addExerciseToRoutine(selected.id, name) }
    catch (e) { setActionError(e.message) }
  }

  return (
    <Layout>
      <div
        className="fade-in"
        style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}
      >
        {/* ── Left panel: routine list ── */}
        <div style={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid var(--c-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '32px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
              Mis Rutinas
            </h1>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '10px' }}
              {...pressProps(0.96)}
            >
              {creating ? <span className="spinner" style={{ width: '10px', height: '10px' }} /> : '+ Nueva'}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 20px' }}>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 8px' }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: '48px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '4px', opacity: 1 - i * 0.25 }} />
                ))}
              </div>
            )}

            {!loading && routines.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Sin rutinas
                </p>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
                  Crea tu primera rutina arriba.
                </p>
              </div>
            )}

            {routines.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 14px',
                  borderRadius: '4px',
                  background: r.id === selectedId ? 'var(--c-surface-2)' : 'transparent',
                  border: `1px solid ${r.id === selectedId ? 'var(--c-border)' : 'transparent'}`,
                  transition: `background 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
                  marginBottom: '3px',
                }}
                onMouseEnter={e => { if (r.id !== selectedId) e.currentTarget.style.background = 'var(--c-surface)' }}
                onMouseLeave={e => { if (r.id !== selectedId) e.currentTarget.style.background = 'transparent' }}
              >
                <p style={{ color: r.id === selectedId ? 'var(--c-text)' : 'var(--c-text-secondary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                  {r.name}
                </p>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginTop: '2px' }}>
                  {r.routine_exercises?.length || 0} {r.routine_exercises?.length === 1 ? 'ejercicio' : 'ejercicios'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel: routine editor ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 60px', minWidth: 0 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {routines.length === 0 ? 'Crea tu primera rutina' : 'Selecciona una rutina'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Routine name */}
              <div style={{ marginBottom: '28px' }}>
                {editingName ? (
                  <input
                    ref={nameRef}
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                    className="input-field"
                    style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', maxWidth: '400px' }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}
                  >
                    <span style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {selected.name}
                    </span>
                    <span style={{ color: 'var(--c-text-ghost)', fontSize: '13px' }}>✎</span>
                  </button>
                )}
              </div>

              {actionError && (
                <div style={{ ...ERROR_STYLE, marginBottom: '16px' }}>{actionError}</div>
              )}

              {/* Exercise list */}
              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px' }}>
                  Ejercicios
                </p>

                {selected.routine_exercises?.length === 0 && (
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '12px 0' }}>
                    Sin ejercicios. Agrega el primero abajo.
                  </p>
                )}

                {selected.routine_exercises?.map((re, i) => (
                  <RoutineExerciseRow
                    key={re.id}
                    re={re}
                    routineId={selected.id}
                    isFirst={i === 0}
                    isLast={i === selected.routine_exercises.length - 1}
                    onUpdate={updateRoutineExercise}
                    onRemove={removeExerciseFromRoutine}
                    onMove={moveExercise}
                  />
                ))}
              </div>

              {/* Add exercise */}
              <div style={{ marginBottom: '40px', maxWidth: '480px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Agregar ejercicio
                </p>
                <ExerciseSearch onAdd={handleAddExercise} userId={user?.id} />
              </div>

              {/* Delete routine */}
              <div style={{ borderTop: '1px solid var(--c-border-subtle)', paddingTop: '24px' }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--c-text-dim)',
                    border: '1px solid var(--c-border-subtle)',
                    padding: '8px 16px',
                    borderRadius: '3px',
                    transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-accent)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar rutina'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
