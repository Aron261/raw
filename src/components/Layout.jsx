import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import WorkoutPickerModal from './WorkoutPickerModal'
import { useWorkouts } from '../hooks/useWorkout'
import { useRoutines } from '../hooks/useRoutines'
import { useCycle } from '../hooks/useCycle'

// WorkoutStarter: lógica del picker global — vive en Layout para que el
// botón + del nav funcione desde cualquier pantalla.
function WorkoutStarter({ children }) {
  const navigate = useNavigate()
  const { createWorkout, createWorkoutFromRoutine, createWorkoutFromCycleDay } = useWorkouts()
  const { routines } = useRoutines()
  const { activeCycle, cycleData } = useCycle()

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

  return (
    <>
      {children(openPicker, starting)}
      {showPicker && (
        <WorkoutPickerModal
          routines={routines}
          activeCycle={activeCycle}
          cycleData={cycleData}
          onSelectBlank={() => run(createWorkout)}
          onSelectRoutine={r => run(() => createWorkoutFromRoutine(r))}
          onSelectCycleDay={day => run(() => createWorkoutFromCycleDay(day))}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

export default function Layout({ children, hideNav = false }) {
  return (
    <WorkoutStarter>
      {(openPicker, _starting) => (
        <>
          {/* ── Mobile (< md) ──────────────────────────────────────────── */}
          <div className="md:hidden min-h-dvh bg-background flex flex-col">
            <main className={`flex-1 flex flex-col ${hideNav ? '' : 'pb-20'}`}>
              {children}
            </main>
            {!hideNav && <BottomNav onStartWorkout={openPicker} />}
          </div>

          {/* ── Desktop (≥ md) ─────────────────────────────────────────── */}
          <div className="hidden md:flex min-h-dvh bg-background">
            {!hideNav && <Sidebar />}
            <main className="flex-1 overflow-y-auto" style={{ minHeight: '100dvh' }}>
              {children}
            </main>
          </div>
        </>
      )}
    </WorkoutStarter>
  )
}
