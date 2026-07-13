import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import AddExerciseModal from '../components/AddExerciseModal'
import { useRoutines } from '../hooks/useRoutines'
import { useAuth } from '../hooks/useAuth'

const eyebrow = { fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }

// One exercise row: name + editable target sets/reps + remove.
function ExerciseRowEditor({ exercise, onUpdate, onRemove }) {
  const [sets, setSets] = useState(exercise.sets ?? '')
  const [reps, setReps] = useState(exercise.reps ?? '')

  const commit = () => {
    const nextSets = sets === '' ? null : parseInt(sets, 10)
    const nextReps = reps.trim() === '' ? null : reps.trim()
    if (nextSets !== (exercise.sets ?? null) || nextReps !== (exercise.reps ?? null)) {
      onUpdate({ sets: Number.isNaN(nextSets) ? null : nextSets, reps: nextReps })
    }
  }

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--c-border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {exercise.exercise_name}
      </span>
      <input
        type="number" inputMode="numeric" min="0"
        value={sets} onChange={e => setSets(e.target.value)} onBlur={commit}
        placeholder="Ser."
        className="input-field"
        style={{ width: '52px', fontSize: '12px', textAlign: 'center', padding: '7px 4px' }}
        aria-label="Series"
      />
      <span style={{ color: 'var(--c-text-ghost)', fontSize: '12px' }}>×</span>
      <input
        type="text"
        value={reps} onChange={e => setReps(e.target.value)} onBlur={commit}
        placeholder="Reps"
        className="input-field"
        style={{ width: '68px', fontSize: '12px', textAlign: 'center', padding: '7px 4px' }}
        aria-label="Reps"
      />
      <button
        onClick={onRemove}
        style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '13px', padding: '4px', transition: 'color 150ms' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
        aria-label="Quitar ejercicio"
      >
        ✕
      </button>
    </div>
    {exercise.notes && (
      <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', lineHeight: 1.5, marginTop: '4px' }}>
        {exercise.notes}
      </p>
    )}
    </div>
  )
}

// One day card: editable name + focus, its exercises, add-exercise button.
function DayEditor({ day, onUpdateDay, onRemoveDay, onAddExercise, onUpdateExercise, onRemoveExercise, canRemove }) {
  const [name, setName] = useState(day.day_name || '')
  const [focus, setFocus] = useState(day.focus || '')
  const exercises = day.routine_day_exercises || []

  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <input
          type="text" value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== day.day_name) onUpdateDay({ day_name: name.trim() }) }}
          placeholder="Nombre del día"
          className="input-field"
          style={{ flex: 1, fontSize: '14px', fontWeight: 800 }}
        />
        <input
          type="text" value={focus}
          onChange={e => setFocus(e.target.value)}
          onBlur={() => { if (focus !== (day.focus || '')) onUpdateDay({ focus: focus.trim() || null }) }}
          placeholder="Focus"
          className="input-field"
          style={{ width: '96px', fontSize: '12px' }}
        />
        {canRemove && (
          <button
            onClick={onRemoveDay}
            style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '13px', padding: '4px', transition: 'color 150ms' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
            aria-label="Eliminar día"
          >
            🗑
          </button>
        )}
      </div>

      {exercises.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '8px 0 12px' }}>
          Sin ejercicios todavía.
        </p>
      ) : (
        <div>
          {exercises.map(ex => (
            <ExerciseRowEditor
              key={ex.id}
              exercise={ex}
              onUpdate={(u) => onUpdateExercise(ex.id, u)}
              onRemove={() => onRemoveExercise(ex.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={onAddExercise}
        style={{
          marginTop: '10px', width: '100%', padding: '10px',
          background: 'transparent', border: '1px dashed var(--c-border)', borderRadius: '10px',
          color: 'var(--c-accent)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
          transition: 'background 150ms, border-color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
      >
        + Agregar ejercicio
      </button>
    </div>
  )
}

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    routines, loading, error,
    updateRoutine, addDay, updateDay, removeDay,
    addDayExercise, updateDayExercise, removeDayExercise,
  } = useRoutines()

  const routine = routines.find(r => r.id === id)
  const [addingToDay, setAddingToDay] = useState(null)
  const [name, setName] = useState(null) // lazy-init once routine loads

  const displayName = name ?? routine?.name ?? ''

  if (loading && !routine) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <span className="spinner" style={{ width: '20px', height: '20px' }} />
        </div>
      </Layout>
    )
  }

  if (!routine) {
    return (
      <Layout>
        <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px' }}>
            <button onClick={() => navigate('/rutinas')} style={{ color: 'var(--c-text-dim)', fontSize: '18px' }} aria-label="Volver">←</button>
            <h1 style={{ color: 'var(--c-text)', fontSize: '18px', fontWeight: 800 }}>Rutina no encontrada</h1>
          </div>
        </div>
      </Layout>
    )
  }

  const days = routine.routine_days || []

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '4px' }}>
          <button onClick={() => navigate('/rutinas')} style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }} aria-label="Volver">←</button>
          <p style={eyebrow}>{routine.type === 'cycle' ? 'Editar ciclo' : 'Editar rutina'}</p>
        </div>

        <input
          type="text"
          value={displayName}
          onChange={e => setName(e.target.value)}
          onBlur={() => { const v = (name ?? '').trim(); if (v && v !== routine.name) updateRoutine(routine.id, { name: v }) }}
          className="input-field"
          style={{ width: '100%', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', padding: '8px 10px', marginBottom: '20px', background: 'transparent', border: '1px solid transparent' }}
          onFocus={e => { e.currentTarget.style.border = '1px solid var(--c-border-subtle)'; e.currentTarget.style.background = 'var(--c-surface)' }}
        />

        {routine.description && (
          <details style={{ marginBottom: '20px', marginTop: '-8px' }}>
            <summary style={{ ...eyebrow, cursor: 'pointer', listStyle: 'none' }}>
              Por qué este plan ›
            </summary>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: '8px', padding: '12px 14px', background: 'var(--c-surface)', borderRadius: '12px' }}>
              {routine.description}
            </p>
          </details>
        )}

        {error && (
          <div style={{ background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)', color: 'var(--c-action-text)', fontSize: '12px', padding: '10px 12px', borderRadius: '10px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {/* Days */}
        {days.map(day => (
          <DayEditor
            key={day.id}
            day={day}
            canRemove={days.length > 1}
            onUpdateDay={(u) => updateDay(day.id, u)}
            onRemoveDay={() => removeDay(day.id)}
            onAddExercise={() => setAddingToDay(day.id)}
            onUpdateExercise={updateDayExercise}
            onRemoveExercise={removeDayExercise}
          />
        ))}

        {/* Add day */}
        <button
          onClick={() => addDay(routine.id, { day_name: `Día ${days.length + 1}` })}
          style={{
            width: '100%', padding: '12px', marginBottom: '32px',
            background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '12px',
            color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          + Agregar día
        </button>
      </div>

      {addingToDay && (
        <AddExerciseModal
          userId={user?.id}
          title="Agregar al día"
          subtitle="Elige o crea ejercicios; se guardan en el día."
          onAdd={(exName, group) => addDayExercise(addingToDay, { name: exName, muscleGroup: group })}
          onClose={() => setAddingToDay(null)}
        />
      )}
    </Layout>
  )
}
