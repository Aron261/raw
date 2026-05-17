import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { useWorkouts } from '../hooks/useWorkout'
import { useRoutines } from '../hooks/useRoutines'
import { useAuth } from '../hooks/useAuth'
import { pressProps, hoverColor, ERROR_STYLE } from '../lib/ui'

// Computed once per day
const dateStr = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
})

// ── Routine picker bottom sheet ────────────────────────────────────────
function RoutinePickerModal({ routines, onSelectBlank, onSelectRoutine, onClose }) {
  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-sheet"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-subtle)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '480px',
          maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Fixed header — handle + title + blank option */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 20px' }} />

          <h3 style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
            ¿Cómo empezamos?
          </h3>

          {/* Blank option */}
          <button
            onClick={onSelectBlank}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 16px', marginBottom: '10px',
              background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
              borderRadius: '12px',
              transition: `border-color 150ms var(--ease-out)`,
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

          {routines.length > 0 && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', marginTop: '4px' }}>
              Desde una rutina
            </p>
          )}
        </div>

        {/* Scrollable routine list */}
        {routines.length > 0 && (
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
            {routines.map(r => (
              <button
                key={r.id}
                onClick={() => onSelectRoutine(r)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 16px', marginBottom: '6px',
                  background: 'transparent', border: '1px solid var(--c-border-subtle)',
                  borderRadius: '12px',
                  transition: `background 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
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
          </div>
        )}

        {/* Safe area padding when no routines */}
        {routines.length === 0 && (
          <div style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }} />
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────
export default function Home() {
  const { user, signOut } = useAuth()
  const { workouts, loading, error, createWorkout, createWorkoutFromRoutine, deleteWorkout, duplicateWorkout } = useWorkouts()
  const { routines, loading: routinesLoading } = useRoutines()
  const navigate = useNavigate()

  const [starting, setStarting] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const hasRoutines = !routinesLoading && routines.length > 0

  const handleStartPress = () => {
    if (hasRoutines) {
      setShowPicker(true)
    } else {
      handleStartBlank()
    }
  }

  const handleStartBlank = async () => {
    setShowPicker(false)
    setStarting(true)
    try {
      const workout = await createWorkout()
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Failed to start workout:', err)
      setStarting(false)
    }
  }

  const handleStartFromRoutine = async (routine) => {
    setShowPicker(false)
    setStarting(true)
    try {
      const workout = await createWorkoutFromRoutine(routine)
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Failed to start from routine:', err)
      setStarting(false)
    }
  }

  const recentWorkouts = useMemo(() => workouts.slice(0, 5), [workouts])

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '40px', paddingBottom: '28px' }}>
          <div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              {dateStr}
            </p>
            <h1 style={{ color: 'var(--c-text)', fontSize: '32px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
              RAW
            </h1>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            style={{
              color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid var(--c-border-subtle)', padding: '6px 10px',
              borderRadius: '8px', marginTop: '4px',
              transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
          >
            Sign out
          </button>
        </div>

        {/* Start Workout CTA */}
        <button
          onClick={handleStartPress}
          disabled={starting}
          className="fade-in"
          style={{
            width: '100%', background: 'var(--c-accent)', color: 'var(--c-text)',
            fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '18px 24px', borderRadius: '14px', marginBottom: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            opacity: starting ? 0.75 : 1,
            transition: `transform 160ms var(--ease-out), opacity 160ms var(--ease-out)`,
            animationDelay: '60ms',
          }}
          {...pressProps(0.98)}
        >
          {starting
            ? <><span className="spinner" style={{ borderTopColor: 'var(--c-text)', borderColor: 'rgba(255,255,255,0.25)' }} /><span>Iniciando...</span></>
            : '+ Iniciar Entreno'
          }
        </button>

        {/* Recent workouts */}
        <div>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            Recientes
          </p>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: '80px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          )}

          {error && <div style={ERROR_STYLE}>Error al cargar entrenos.</div>}

          {!loading && !error && recentWorkouts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sin entrenos aún
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px' }}>
                Inicia tu primera sesión arriba.
              </p>
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentWorkouts.map((workout, i) => (
                <div key={workout.id} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <WorkoutCard workout={workout} onDelete={deleteWorkout} onDuplicate={duplicateWorkout} />
                </div>
              ))}
            </div>
          )}

          {!loading && workouts.length > 5 && (
            <button
              onClick={() => navigate('/history')}
              style={{
                width: '100%', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px',
                textAlign: 'center', transition: `color 150ms var(--ease-out)`, marginTop: '4px',
              }}
              {...hoverColor('var(--c-text)', 'var(--c-text-dim)')}
            >
              Ver todo el historial →
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <RoutinePickerModal
          routines={routines}
          onSelectBlank={handleStartBlank}
          onSelectRoutine={handleStartFromRoutine}
          onClose={() => setShowPicker(false)}
        />
      )}
    </Layout>
  )
}
