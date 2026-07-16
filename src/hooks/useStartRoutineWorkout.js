import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { getOrCreateExerciseId } from '../lib/exercises'

// Lightweight hook para iniciar un entreno desde una rutina (ciclo o single_day).
// No hace fetchWorkouts — solo crea el workout y retorna el objeto creado.
// El llamador es responsable de redirigir al entreno activo.
export function useStartRoutineWorkout() {
  const { user } = useAuth()

  // Inicia un entreno a partir de un día de rutina.
  // Params:
  //   routineId     — uuid de la rutina padre
  //   routineDayId  — uuid del routine_day
  //   routineName   — nombre de la rutina (usado como prefijo del workout name)
  //   day           — objeto routine_day con routine_day_exercises[]
  const startWorkoutFromRoutineDay = async ({ routineId, routineDayId, routineName, day }) => {
    if (!user) throw new Error('Usuario no autenticado')

    // 1. Crear el workout con vinculación a rutina y source = 'routine'
    const workoutName = day.day_name || routineName || 'Entreno'
    const { data: workout, error: workoutErr } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: workoutName,
        started_at: new Date().toISOString(),
        routine_id: routineId,
        routine_day_id: routineDayId,
        source: 'routine',
      })
      .select()
      .single()

    if (workoutErr) throw workoutErr

    // 2. Insertar ejercicios del día ordenados por exercise_order
    const exercises = [...(day.routine_day_exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order)

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i]
      if (!ex.exercise_name?.trim()) continue

      // Resolución canónica: el nombre escrito en la rutina cae sobre el
      // ejercicio que ya tiene la historia de ese movimiento.
      const exerciseId = await getOrCreateExerciseId(ex.exercise_name)
      if (!exerciseId) continue

      const { error: weErr } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: workout.id,
          exercise_id: exerciseId,
          sort_order: ex.exercise_order ?? i,
          unit: 'lb', // default; el usuario puede cambiarlo durante el entreno
        })

      if (weErr) throw weErr
    }

    // Retorna el workout creado sin llamar fetchWorkouts
    return workout
  }

  return { startWorkoutFromRoutineDay }
}
