import { pressProps } from '../lib/ui'

function SectionLabel({ children }) {
  return (
    <p style={{
      color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      marginBottom: '8px', marginTop: '16px',
    }}>
      {children}
    </p>
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
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--c-scrim)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-subtle)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '480px',
          maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Fixed handle + title */}
        <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 20px' }} />
          <h3 style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ¿Cómo empezamos?
          </h3>
        </div>

        {/* Scrollable options */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px', paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>

          {/* Blank */}
          <button
            onClick={onSelectBlank}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 16px', marginBottom: '6px',
              background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
              borderRadius: '12px',
              transition: 'border-color 150ms var(--ease-out)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-text-dim)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
            {...pressProps(0.98)}
          >
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                En blanco
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                Empieza sin ejercicios predefinidos
              </p>
            </div>
            <span style={{ color: 'var(--c-text-dim)', fontSize: '14px' }}>→</span>
          </button>

          {/* Cycle days */}
          {activeCycle && cycleDays.length > 0 && (
            <>
              <SectionLabel>Ciclo — {activeCycle.name}</SectionLabel>
              {cycleDays.map(day => (
                <button
                  key={day.id}
                  onClick={() => onSelectCycleDay(day)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 16px', marginBottom: '6px',
                    background: 'transparent', border: '1px solid var(--c-border-subtle)',
                    borderRadius: '12px',
                    transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                  {...pressProps(0.98)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                      {day.day_name}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                      {(day.exercises || []).length} ejercicios
                      {day.muscle_groups?.length > 0 ? ` · ${day.muscle_groups.join(', ')}` : ''}
                    </p>
                  </div>
                  <span style={{ color: 'var(--c-accent)', fontSize: '14px' }}>→</span>
                </button>
              ))}
            </>
          )}

          {/* Routines */}
          {routines.length > 0 && (
            <>
              <SectionLabel>Desde rutina</SectionLabel>
              {routines.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelectRoutine(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 16px', marginBottom: '6px',
                    background: 'transparent', border: '1px solid var(--c-border-subtle)',
                    borderRadius: '12px',
                    transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                  {...pressProps(0.98)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                      {r.name}
                    </p>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                      {r.routine_exercises?.length || 0} ejercicios
                    </p>
                  </div>
                  <span style={{ color: 'var(--c-accent)', fontSize: '14px' }}>→</span>
                </button>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
