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

export default function WorkoutPickerModal({
  routines = [],
  activeCycle = null,
  cycleData = null,
  onSelectBlank,
  onSelectRoutine,
  onSelectCycleDay,
  onClose,
}) {
  const cycleDays = cycleData?.days || []

  return (
    <Sheet title="¿Cómo empezamos?" onClose={onClose} maxHeight="85dvh">
      {/* Blank */}
      <OptionRow
        title="En blanco"
        subtitle="Empieza sin ejercicios predefinidos"
        onClick={onSelectBlank}
        filled
      />

      {/* Cycle days */}
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

      {/* Routines */}
      {routines.length > 0 && (
        <>
          <Eyebrow style={{ margin: '16px 0 8px' }}>Desde rutina</Eyebrow>
          {routines.map(r => (
            <OptionRow
              key={r.id}
              title={r.name}
              subtitle={`${r.routine_exercises?.length || 0} ejercicios`}
              onClick={() => onSelectRoutine(r)}
              arrowColor="var(--c-action-text)"
            />
          ))}
        </>
      )}
    </Sheet>
  )
}
