import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import WorkoutPickerModal from './WorkoutPickerModal'
import QuickAddSheet from './QuickAddSheet'
import { StartFab } from './ui'
import { useWorkouts } from '../hooks/useWorkout'
import { useRoutines } from '../hooks/useRoutines'
import { hasTabBar } from '../lib/sections'

// QuickAdd: the universal "+" — vive en Layout para que el botón del nav
// funcione desde cualquier pantalla. "Empezar entreno" delega en el picker
// que ya existía; el resto de opciones navegan o resuelven en el propio sheet.
function WorkoutStarter({ children }) {
  const navigate = useNavigate()
  const { createWorkout, createWorkoutFromCycleDay } = useWorkouts()
  const { routines, activeRoutine } = useRoutines()

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [starting, setStarting] = useState(false)

  const openQuickAdd = () => setShowQuickAdd(true)

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
      {children(openQuickAdd, starting)}
      {showQuickAdd && (
        <QuickAddSheet
          onClose={() => setShowQuickAdd(false)}
          onStartWorkout={() => { setShowQuickAdd(false); setShowPicker(true) }}
        />
      )}
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

// El acceso a Perfil vive como chip en la portada (Inicio) y en el sidebar de
// escritorio; ya no hay avatar flotante.
export default function Layout({ children, hideNav = false }) {
  const { pathname } = useLocation()
  // Las pantallas con pestaña (y las que cuelgan de ellas) reservan sitio para
  // la barra; Nutrición, Coach y Social navegan desde Inicio y sus cabeceras.
  const hasTabs = hasTabBar(pathname)

  return (
    <WorkoutStarter>
      {(openQuickAdd, _starting) => (
        <>
          {/* ── Mobile (< md) ──────────────────────────────────────────── */}
          <div className="md:hidden min-h-dvh bg-background flex flex-col">
            <main className={`flex-1 flex flex-col ${!hideNav && hasTabs ? 'pb-20' : 'pb-8'}`}>
              {children}
            </main>
            {!hideNav && <BottomNav onStart={openQuickAdd} />}
          </div>

          {/* ── Desktop (≥ md) ─────────────────────────────────────────── */}
          <div className="hidden md:flex min-h-dvh bg-background">
            {!hideNav && <Sidebar />}
            <main className="flex-1 overflow-y-auto" style={{ minHeight: '100dvh' }}>
              {children}
            </main>
            {!hideNav && <StartFab onClick={openQuickAdd} />}
          </div>
        </>
      )}
    </WorkoutStarter>
  )
}
