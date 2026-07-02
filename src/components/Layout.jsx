import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import WorkoutPickerModal from './WorkoutPickerModal'
import { StartFab } from './ui'
import { useWorkouts } from '../hooks/useWorkout'
import { useRoutines } from '../hooks/useRoutines'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { sectionFor } from '../lib/sections'

// ProfileAvatar — the profile entry point, top-right on mobile tab screens.
// Lives outside the bottom nav so trainers keep both Historial and Coach there.
function ProfileAvatar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profile } = useProfile()
  const { user } = useAuth()
  const active = pathname === '/profile'
  const initial = (profile?.name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div
      style={{
        position: 'fixed', top: 'calc(env(safe-area-inset-top) + 12px)',
        left: 0, right: 0, zIndex: 40, pointerEvents: 'none',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="Perfil"
          aria-current={active ? 'page' : undefined}
          style={{
            pointerEvents: 'auto',
            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: active ? 'var(--c-accent)' : 'var(--c-surface)',
            border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
            color: active ? 'var(--c-on-action)' : 'var(--c-text-dim)',
            fontSize: '16px', fontWeight: 900, letterSpacing: '-0.02em',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms, transform 160ms var(--ease-out)',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {initial}
        </button>
      </div>
    </div>
  )
}

// WorkoutStarter: lógica del picker global — vive en Layout para que el
// botón + del nav funcione desde cualquier pantalla.
function WorkoutStarter({ children }) {
  const navigate = useNavigate()
  const { createWorkout, createWorkoutFromRoutine, createWorkoutFromCycleDay } = useWorkouts()
  const { routines, activeRoutine } = useRoutines()

  const [showPicker, setShowPicker] = useState(false)
  const [starting, setStarting] = useState(false)

  const openPicker = () => setShowPicker(true)

  const run = async (fn) => {
    setShowPicker(false)
    setStarting(true)
    try {
      const workout = await fn()
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Failed to start workout:', err)
    } finally {
      setStarting(false)
    }
  }

  // Adaptar la rutina activa al formato que espera WorkoutPickerModal (cycleDay)
  const activeRoutineDays = activeRoutine
    ? (activeRoutine.routine_days || []).map(day => ({
        id: day.id,
        day_name: day.day_name,
        exercises: (day.routine_day_exercises || []).map(ex => ({ exercise_name: ex.exercise_name })),
        muscle_groups: day.focus ? [day.focus] : [],
      }))
    : []

  return (
    <>
      {children(openPicker, starting)}
      {showPicker && (
        <WorkoutPickerModal
          routines={routines}
          activeCycle={activeRoutine ? { name: activeRoutine.name } : null}
          cycleData={activeRoutineDays.length > 0 ? { days: activeRoutineDays } : null}
          onSelectBlank={() => run(createWorkout)}
          onSelectRoutine={r => run(() => createWorkoutFromRoutine(r))}
          onSelectCycleDay={day => run(() => createWorkoutFromCycleDay(day))}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// showProfile: el avatar de perfil solo se muestra donde se pide (Menú, Inicio).
// No vive en la barra inferior, así que las pantallas de tabs sin avatar
// llegan a Perfil volviendo al menú.
export default function Layout({ children, hideNav = false, showProfile = false }) {
  const { pathname } = useLocation()
  const section = sectionFor(pathname)
  // Solo la sección Entreno tiene barra de tabs; el hub usa el FAB de inicio.
  const hasTabs = section === 'training'

  return (
    <WorkoutStarter>
      {(openPicker, _starting) => (
        <>
          {/* ── Mobile (< md) ──────────────────────────────────────────── */}
          <div className="md:hidden min-h-dvh bg-background flex flex-col">
            {!hideNav && showProfile && <ProfileAvatar />}
            <main className={`flex-1 flex flex-col ${!hideNav && hasTabs ? 'pb-20' : 'pb-8'}`}>
              {children}
            </main>
            {!hideNav && <BottomNav onStart={openPicker} />}
            {!hideNav && section === 'hub' && <StartFab onClick={openPicker} offset={20} />}
          </div>

          {/* ── Desktop (≥ md) ─────────────────────────────────────────── */}
          <div className="hidden md:flex min-h-dvh bg-background">
            {!hideNav && <Sidebar />}
            <main className="flex-1 overflow-y-auto" style={{ minHeight: '100dvh' }}>
              {children}
            </main>
            {!hideNav && <StartFab onClick={openPicker} />}
          </div>
        </>
      )}
    </WorkoutStarter>
  )
}
