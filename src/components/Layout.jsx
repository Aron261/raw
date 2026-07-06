import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import WorkoutPickerModal from './WorkoutPickerModal'
import { StartFab } from './ui'
import { useWorkouts } from '../hooks/useWorkout'
import { useRoutines } from '../hooks/useRoutines'
import { sectionFor } from '../lib/sections'

// WorkoutStarter: lógica del picker global — vive en Layout para que el
// botón + del nav funcione desde cualquier pantalla.
function WorkoutStarter({ children }) {
  const navigate = useNavigate()
  const { createWorkout, createWorkoutFromCycleDay } = useWorkouts()
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
        routineId: activeRoutine.id,
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
          activeCycleId={activeRoutine?.id || null}
          cycleData={activeRoutineDays.length > 0 ? { days: activeRoutineDays } : null}
          onSelectBlank={() => run(createWorkout)}
          onSelectCycleDay={day => run(() => createWorkoutFromCycleDay(day))}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// El acceso a Perfil vive como fila en el menú del hub (Hub.jsx) y en el
// sidebar de escritorio; ya no hay avatar flotante.
export default function Layout({ children, hideNav = false }) {
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
