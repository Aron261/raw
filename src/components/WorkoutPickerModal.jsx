import { pressProps } from '../lib/ui'
import { Sheet, Eyebrow } from './ui'

// A single tappable option row (blank / cycle day / routine).
function OptionRow({ title, subtitle, onClick, arrowColor = 'var(--c-text-dim)', filled = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 16px', marginBottom: '6px',
        background: filled ? 'var(--c-surface-2)' : 'transparent',
        border: `1px solid ${filled ? 'var(--c-border)' : 'var(--c-border-subtle)'}`,
        borderRadius: '12px',
        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
      onMouseLeave={e => { e.currentTarget.style.background = filled ? 'var(--c-surface-2)' : 'transparent'; e.currentTarget.style.borderColor = filled ? 'var(--c-border)' : 'var(--c-border-subtle)' }}
      {...pressProps(0.98)}
    >
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          {subtitle}
        </p>
      </div>
      <span style={{ color: arrowColor, fontSize: '14px', flexShrink: 0, marginLeft: '12px' }}>→</span>
    </button>
  )
}

// Shape a routine day into what onSelectCycleDay expects (the workout gets
// linked to routine_id + routine_day_id, so the active session shows the day's
// prescribed sets/reps as a guide). day_name falls back to the routine name.
function buildDay(routine, day) {
  return {
    id: day.id,
    routineId: routine.id,
    day_name: day.day_name || routine.name,
    exercises: (day.routine_day_exercises || [])
      .filter(e => e.exercise_name?.trim())
      .map(e => ({ exercise_name: e.exercise_name })),
  }
}

const exerciseCount = (day) =>
  (day.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length

export default function WorkoutPickerModal({
  routines = [],
  activeCycle = null,
  activeCycleId = null,
  cycleData = null,
  onSelectBlank,
  onSelectCycleDay,
  onClose,
}) {
  const cycleDays = cycleData?.days || []

  // Every routine except the active cycle (already shown in its own section),
  // keeping only days that actually have exercises to log.
  const otherRoutines = routines
    .filter(r => r.id !== activeCycleId)
    .map(r => ({
      routine: r,
      days: (r.routine_days || []).filter(d => exerciseCount(d) > 0),
    }))
    .filter(r => r.days.length > 0)

  return (
    <Sheet title="¿Cómo empezamos?" onClose={onClose} maxHeight="85dvh">
      {/* Blank */}
      <OptionRow
        title="En blanco"
        subtitle="Empieza sin ejercicios predefinidos"
        onClick={onSelectBlank}
        filled
      />

      {/* Active cycle days */}
      {activeCycle && cycleDays.length > 0 && (
        <>
          <Eyebrow style={{ margin: '16px 0 8px' }}>Ciclo — {activeCycle.name}</Eyebrow>
          {cycleDays.map(day => (
            <OptionRow
              key={day.id}
              title={day.day_name}
              subtitle={`${(day.exercises || []).length} ejercicios${day.muscle_groups?.length > 0 ? ` · ${day.muscle_groups.join(', ')}` : ''}`}
              onClick={() => onSelectCycleDay(day)}
              arrowColor="var(--c-action-text)"
            />
          ))}
        </>
      )}

      {/* Other routines — single-day routines start in one tap; multi-day
          routines expand to one row per day. Both link back to the routine. */}
      {otherRoutines.length > 0 && (
        <>
          <Eyebrow style={{ margin: '16px 0 8px' }}>Desde rutina</Eyebrow>
          {otherRoutines.map(({ routine, days }) =>
            days.length === 1 ? (
              <OptionRow
                key={routine.id}
                title={routine.name}
                subtitle={`${exerciseCount(days[0])} ejercicios${days[0].focus ? ` · ${days[0].focus}` : ''}`}
                onClick={() => onSelectCycleDay(buildDay(routine, days[0]))}
                arrowColor="var(--c-action-text)"
              />
            ) : (
              <div key={routine.id} style={{ marginBottom: '4px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 2px 6px' }}>
                  {routine.name}
                </p>
                {days.map(day => (
                  <OptionRow
                    key={day.id}
                    title={day.day_name || 'Día'}
                    subtitle={`${exerciseCount(day)} ejercicios${day.focus ? ` · ${day.focus}` : ''}`}
                    onClick={() => onSelectCycleDay(buildDay(routine, day))}
                    arrowColor="var(--c-action-text)"
                  />
                ))}
              </div>
            )
          )}
        </>
      )}
    </Sheet>
  )
}
