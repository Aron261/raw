import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource } from '../lib/swr'

// Calculate estimated 1RM using Epley formula
export const calc1RM = (weight, reps) => {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// Calculate total volume for a list of sets, normalizado a kg.
// Si el set tiene unit='lb', convierte antes de sumar.
export const calcVolume = (sets) => {
  return sets.reduce((total, set) => {
    const weightKg = (set.unit === 'lb') ? (set.weight || 0) * 0.453592 : (set.weight || 0)
    return total + weightKg * (set.reps || 0)
  }, 0)
}

// Format duration between two timestamps
export const formatDuration = (startedAt, endedAt) => {
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : new Date()
  const diffMs = end - start
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// Hook to manage workouts list (Home + History pages).
// Backed by the shared SWR cache so switching tabs renders instantly and
// refreshes quietly instead of refetching with a skeleton each time.
export function useWorkouts() {
  const { user } = useAuth()
  const key = user ? `workouts:${user.id}` : null

  const fetcher = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('workouts')
      .select(`
        id, name, started_at, ended_at, notes, routine_id, routine_day_id,
        workout_exercises (
          id,
          exercise_id,
          unit,
          exercises ( name ),
          sets ( reps, weight )
        )
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    if (fetchError) throw fetchError
    return data || []
  }, [user])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const workouts = data || []
  const [mutError, setMutError] = useState(null)
  const setError = setMutError
  const fetchWorkouts = refetch
  const error = (loadError ? (loadError.message || 'Error inesperado') : null) || mutError

  const createWorkout = async () => {
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('workouts')
        .insert({ user_id: user.id, name: 'Workout', started_at: new Date().toISOString() })
        .select()
        .single()

      if (insertError) throw insertError
      await fetchWorkouts()
      return data
    } catch (err) {
      console.error('Error creating workout:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const updateWorkout = async (id, updates) => {
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('workouts')
        .update(updates)
        .eq('id', id)

      if (updateError) throw updateError
      await fetchWorkouts()
    } catch (err) {
      console.error('Error updating workout:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Resolve a list of exercise names to their ids for this user, creating any
  // that don't exist yet — in one batched upsert instead of N round-trips.
  const resolveExerciseIds = async (names) => {
    const unique = [...new Set(names.filter(Boolean).map(n => n))]
    if (unique.length === 0) return {}
    const { data, error: err } = await supabase
      .from('exercises')
      .upsert(unique.map(name => ({ user_id: user.id, name })), { onConflict: 'user_id,name' })
      .select('id, name')
    if (err) throw err
    return Object.fromEntries((data || []).map(e => [e.name, e.id]))
  }

  // Create a workout pre-populated with a routine's exercises
  const createWorkoutFromRoutine = async (routine) => {
    // 1. Create the workout using the routine name
    const { data: workoutData, error: workoutErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: routine.name, started_at: new Date().toISOString() })
      .select()
      .single()
    if (workoutErr) throw workoutErr

    // 2. Resolve every exercise id up front, then insert the join rows in one call
    const exercises = [...(routine.routine_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
    const idByName = await resolveExerciseIds(exercises.map(re => re.exercises?.name))

    const rows = exercises
      .filter(re => re.exercises?.name && idByName[re.exercises.name])
      .map(re => ({
        workout_id: workoutData.id,
        exercise_id: idByName[re.exercises.name],
        sort_order: re.sort_order,
        unit: re.unit || 'lb',
      }))
    if (rows.length > 0) {
      const { error: weErr } = await supabase.from('workout_exercises').insert(rows)
      if (weErr) throw weErr
    }

    await fetchWorkouts()
    return workoutData
  }

  const deleteWorkout = async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('workouts').delete().eq('id', id)
      if (err) throw err
      await fetchWorkouts()
    } catch (err) {
      console.error('Error deleting workout:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Create a new blank workout copying the same exercises (no sets) from a past workout
  const duplicateWorkout = async (sourceWorkout) => {
    const { data: newWorkout, error: wErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: sourceWorkout.name, started_at: new Date().toISOString() })
      .select()
      .single()
    if (wErr) throw wErr

    // Copy exercises in order, blank sets
    const exercises = [...(sourceWorkout.workout_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
    const idByName = await resolveExerciseIds(exercises.map(we => we.exercises?.name))

    const rows = exercises
      .map((we, i) => ({ we, i }))
      .filter(({ we }) => we.exercises?.name && idByName[we.exercises.name])
      .map(({ we, i }) => ({
        workout_id: newWorkout.id,
        exercise_id: idByName[we.exercises.name],
        sort_order: i,
        unit: we.unit || 'lb',
      }))
    if (rows.length > 0) {
      const { error: weErr } = await supabase.from('workout_exercises').insert(rows)
      if (weErr) throw weErr
    }

    await fetchWorkouts()
    return newWorkout
  }

  // Create a new workout pre-loaded with exercises from a cycle day
  const createWorkoutFromCycleDay = async (cycleDay) => {
    const { data: workoutData, error: workoutErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: cycleDay.day_name, started_at: new Date().toISOString() })
      .select()
      .single()
    if (workoutErr) throw workoutErr

    const exercises = cycleDay.exercises || []
    const idByName = await resolveExerciseIds(exercises.map(ex => ex.exercise_name))

    const rows = exercises
      .map((ex, i) => ({ ex, i }))
      .filter(({ ex }) => ex.exercise_name && idByName[ex.exercise_name])
      .map(({ ex, i }) => ({
        workout_id: workoutData.id,
        exercise_id: idByName[ex.exercise_name],
        sort_order: i,
        unit: 'lb',
      }))
    if (rows.length > 0) {
      const { error: weErr } = await supabase.from('workout_exercises').insert(rows)
      if (weErr) throw weErr
    }

    await fetchWorkouts()
    return workoutData
  }

  return { workouts, loading, error, fetchWorkouts, createWorkout, createWorkoutFromRoutine, updateWorkout, deleteWorkout, duplicateWorkout, createWorkoutFromCycleDay }
}

// Hook to manage a single active workout
export function useActiveWorkout(workoutId) {
  const { user } = useAuth()
  const [workout, setWorkout] = useState(null)
  const [workoutExercises, setWorkoutExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWorkout = useCallback(async () => {
    if (!workoutId || !user) return
    setLoading(true)
    setError(null)
    try {
      // Fetch workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single()

      if (workoutError) throw workoutError
      setWorkout(workoutData)

      // Fetch exercises with sets
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          id, sort_order, unit, notes,
          exercises ( id, name ),
          sets ( id, set_number, reps, weight, created_at )
        `)
        .eq('workout_id', workoutId)
        .order('sort_order', { ascending: true })

      if (exercisesError) throw exercisesError

      // Sort sets by set_number within each exercise
      const sorted = (exercisesData || []).map(we => ({
        ...we,
        sets: [...(we.sets || [])].sort((a, b) => a.set_number - b.set_number)
      }))

      setWorkoutExercises(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [workoutId, user])

  useEffect(() => {
    fetchWorkout()
  }, [fetchWorkout])

  const updateWorkoutName = async (name) => {
    const { error: err } = await supabase
      .from('workouts')
      .update({ name })
      .eq('id', workoutId)
    if (err) throw err
    setWorkout(prev => ({ ...prev, name }))
  }

  const finishWorkout = async () => {
    const { error: err } = await supabase
      .from('workouts')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', workoutId)
    if (err) throw err
    setWorkout(prev => ({ ...prev, ended_at: new Date().toISOString() }))
  }

  // Add exercise to workout (creates exercise if not exists, then adds workout_exercise)
  // muscleGroup (optional): set on the user's exercises row so custom exercises
  // get classified. Only written when provided, never nulling an existing value.
  const addExercise = async (exerciseName, muscleGroup = null) => {
    const name = exerciseName.trim()

    // Upsert exercise (unique per user+name)
    const payload = { user_id: user.id, name }
    if (muscleGroup) payload.muscle_group = muscleGroup
    const { data: exerciseData, error: exError } = await supabase
      .from('exercises')
      .upsert(payload, { onConflict: 'user_id,name' })
      .select()
      .single()

    if (exError) throw exError

    // Determine next sort order
    const nextOrder = workoutExercises.length

    const { error: weError } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseData.id,
        sort_order: nextOrder,
        unit: 'lb'
      })

    if (weError) throw weError
    await fetchWorkout()
  }

  const updateUnit = async (workoutExerciseId, unit) => {
    const { error: err } = await supabase
      .from('workout_exercises')
      .update({ unit })
      .eq('id', workoutExerciseId)
    if (err) throw err
    setWorkoutExercises(prev =>
      prev.map(we => we.id === workoutExerciseId ? { ...we, unit } : we)
    )
  }

  const addSet = async (workoutExerciseId, reps, weight, setNumber = null) => {
    const we = workoutExercises.find(w => w.id === workoutExerciseId)
    const nextSetNumber = setNumber ?? (we?.sets?.length || 0) + 1

    const { data, error: err } = await supabase
      .from('sets')
      .insert({
        workout_exercise_id: workoutExerciseId,
        set_number: nextSetNumber,
        reps: parseInt(reps, 10) || 0,
        weight: parseFloat(weight) || 0
      })
      .select()
      .single()

    if (err) throw err
    await fetchWorkout()
    return data
  }

  const updateSet = async (setId, updates) => {
    const { error: err } = await supabase
      .from('sets')
      .update(updates)
      .eq('id', setId)
    if (err) throw err
    await fetchWorkout()
  }

  const deleteSet = async (setId) => {
    const { error: err } = await supabase
      .from('sets')
      .delete()
      .eq('id', setId)
    if (err) throw err
    await fetchWorkout()
  }

  // Move an exercise up/down in the workout, reindexing sort_order so the
  // change survives even if existing values were non-contiguous.
  const moveExercise = async (workoutExerciseId, dir) => {
    const ordered = [...workoutExercises].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex(w => w.id === workoutExerciseId)
    if (idx === -1) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= ordered.length) return

    const reordered = [...ordered]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    setWorkoutExercises(reordered.map((w, i) => ({ ...w, sort_order: i })))

    try {
      await Promise.all(reordered.map((w, i) =>
        supabase.from('workout_exercises').update({ sort_order: i }).eq('id', w.id)
      ))
    } catch (err) {
      setError(err.message)
      await fetchWorkout()
    }
  }

  const updateExerciseNotes = async (workoutExerciseId, notes) => {
    const { error: err } = await supabase
      .from('workout_exercises')
      .update({ notes })
      .eq('id', workoutExerciseId)
    if (err) throw err
    // Optimistic update — no full refetch needed
    setWorkoutExercises(prev =>
      prev.map(we => we.id === workoutExerciseId ? { ...we, notes } : we)
    )
  }

  const removeExercise = async (workoutExerciseId) => {
    const { error: err } = await supabase
      .from('workout_exercises')
      .delete()
      .eq('id', workoutExerciseId)
    if (err) throw err
    await fetchWorkout()
  }

  // Swap the exercise in a workout_exercise row without touching the routine
  const replaceExercise = async (workoutExerciseId, newExerciseName, muscleGroup = null) => {
    const name = newExerciseName.trim()

    // Upsert the new exercise for this user
    const payload = { user_id: user.id, name }
    if (muscleGroup) payload.muscle_group = muscleGroup
    const { data: ex, error: exErr } = await supabase
      .from('exercises')
      .upsert(payload, { onConflict: 'user_id,name' })
      .select()
      .single()
    if (exErr) throw exErr

    // Point this workout_exercise to the new exercise — routine is untouched
    const { error: weErr } = await supabase
      .from('workout_exercises')
      .update({ exercise_id: ex.id })
      .eq('id', workoutExerciseId)
    if (weErr) throw weErr

    await fetchWorkout()
  }

  return {
    workout,
    workoutExercises,
    loading,
    error,
    fetchWorkout,
    updateWorkoutName,
    finishWorkout,
    addExercise,
    replaceExercise,
    updateUnit,
    updateExerciseNotes,
    addSet,
    updateSet,
    deleteSet,
    removeExercise,
    moveExercise
  }
}

// Hook to get all-time PR for an exercise (best weight per set)
export function useExercisePR(exerciseName, userId) {
  const [prSets, setPrSets] = useState([]) // history of best sets per workout
  const [allTimePR, setAllTimePR] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!exerciseName || !userId) return

    const fetchPRs = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('workouts')
          .select(`
            id, started_at,
            workout_exercises!inner (
              id, unit,
              exercises!inner ( name ),
              sets ( id, set_number, reps, weight )
            )
          `)
          .eq('user_id', userId)
          .eq('workout_exercises.exercises.name', exerciseName)
          .order('started_at', { ascending: true })

        if (error) throw error

        // Build progression data: best 1RM per workout session
        const sessionData = (data || []).map(workout => {
          const allSets = workout.workout_exercises.flatMap(we => we.sets || [])
          const unit = workout.workout_exercises[0]?.unit || 'lb'
          const best1RM = allSets.reduce((best, set) => {
            const rm = calc1RM(set.weight, set.reps)
            return rm > best ? rm : best
          }, 0)
          const bestSet = allSets.reduce((best, set) => {
            const rm = calc1RM(set.weight, set.reps)
            const bestRm = best ? calc1RM(best.weight, best.reps) : 0
            return rm > bestRm ? set : best
          }, null)

          return {
            date: workout.started_at,
            best1RM,
            bestSet,
            unit,
            sets: allSets,
            workoutId: workout.id
          }
        })

        setPrSets(sessionData)

        // Find all-time PR
        const pr = sessionData.reduce((best, session) => {
          return session.best1RM > (best?.best1RM || 0) ? session : best
        }, null)
        setAllTimePR(pr)
      } catch (err) {
        console.error('Error fetching PR:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPRs()
  }, [exerciseName, userId])

  return { prSets, allTimePR, loading }
}

// Hook to get all-time best weight for an exercise (for PR badge in active workout)
export function useExerciseAllTimeBest(exerciseId, userId) {
  const [allTimeBestWeight, setAllTimeBestWeight] = useState(0)

  useEffect(() => {
    if (!exerciseId || !userId) return

    const fetchBest = async () => {
      try {
        const { data, error } = await supabase
          .from('sets')
          .select(`
            weight, reps,
            workout_exercises!inner (
              exercise_id,
              workouts!inner ( user_id )
            )
          `)
          .eq('workout_exercises.exercise_id', exerciseId)
          .eq('workout_exercises.workouts.user_id', userId)
          .order('weight', { ascending: false })

        if (error) throw error

        // Best 1RM across all sets
        const best = (data || []).reduce((max, set) => {
          const rm = calc1RM(set.weight, set.reps)
          return rm > max ? rm : max
        }, 0)

        setAllTimeBestWeight(best)
      } catch (err) {
        console.error('Error fetching all-time best:', err)
      }
    }

    fetchBest()
  }, [exerciseId, userId])

  return { allTimeBestWeight }
}

// Hook to get sets from the last time this exercise was done (excluding current workout)
export function usePreviousSets(exerciseId, currentWorkoutId, userId) {
  const [previousSets, setPreviousSets] = useState([])
  const [previousUnit, setPreviousUnit] = useState(null)

  useEffect(() => {
    if (!exerciseId || !currentWorkoutId || !userId) return

    const fetch = async () => {
      try {
        // Find most recent workout with this exercise that isn't the current one
        const { data, error } = await supabase
          .from('workouts')
          .select(`
            id,
            workout_exercises!inner (
              id, unit,
              sets ( id, set_number, reps, weight )
            )
          `)
          .eq('user_id', userId)
          .eq('workout_exercises.exercise_id', exerciseId)
          .neq('id', currentWorkoutId)
          .order('started_at', { ascending: false })
          .limit(1)

        if (error) throw error

        const we = data?.[0]?.workout_exercises?.[0]
        if (we?.sets?.length) {
          const sorted = [...we.sets].sort((a, b) => a.set_number - b.set_number)
          setPreviousSets(sorted)
          setPreviousUnit(we.unit)
        }
      } catch (err) {
        console.error('Error fetching previous sets:', err)
      }
    }

    fetch()
  }, [exerciseId, currentWorkoutId, userId])

  return { previousSets, previousUnit }
}
