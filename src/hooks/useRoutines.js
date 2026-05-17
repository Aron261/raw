import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRoutines() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRoutines = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('routines')
        .select(`
          id, name, description, sort_order, created_at,
          routine_exercises (
            id, sort_order, default_sets, default_reps, default_weight, unit,
            exercises ( id, name )
          )
        `)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (err) throw err

      const sorted = (data || []).map(r => ({
        ...r,
        routine_exercises: [...(r.routine_exercises || [])].sort((a, b) => a.sort_order - b.sort_order),
      }))

      setRoutines(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchRoutines() }, [fetchRoutines])

  const createRoutine = async (name = 'Nueva Rutina') => {
    const { data, error: err } = await supabase
      .from('routines')
      .insert({ user_id: user.id, name, sort_order: routines.length })
      .select()
      .single()
    if (err) throw err
    await fetchRoutines()
    return data
  }

  const deleteRoutine = async (id) => {
    const { error: err } = await supabase.from('routines').delete().eq('id', id)
    if (err) throw err
    await fetchRoutines()
  }

  const updateRoutineName = async (id, name) => {
    const { error: err } = await supabase.from('routines').update({ name }).eq('id', id)
    if (err) throw err
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }

  const addExerciseToRoutine = async (routineId, exerciseName) => {
    const { data: exercise, error: exErr } = await supabase
      .from('exercises')
      .upsert({ user_id: user.id, name: exerciseName.trim() }, { onConflict: 'user_id,name' })
      .select()
      .single()
    if (exErr) throw exErr

    const routine = routines.find(r => r.id === routineId)
    const nextOrder = routine?.routine_exercises?.length || 0

    const { error: reErr } = await supabase
      .from('routine_exercises')
      .insert({
        routine_id: routineId,
        exercise_id: exercise.id,
        sort_order: nextOrder,
        default_sets: 3,
        default_reps: 10,
        unit: 'lb',
      })
    if (reErr) throw reErr
    await fetchRoutines()
  }

  const removeExerciseFromRoutine = async (routineExerciseId) => {
    const { error: err } = await supabase.from('routine_exercises').delete().eq('id', routineExerciseId)
    if (err) throw err
    await fetchRoutines()
  }

  const updateRoutineExercise = async (routineExerciseId, updates) => {
    const { error: err } = await supabase.from('routine_exercises').update(updates).eq('id', routineExerciseId)
    if (err) throw err
    await fetchRoutines()
  }

  const moveExercise = async (routineId, routineExerciseId, direction) => {
    const routine = routines.find(r => r.id === routineId)
    if (!routine) return
    const exercises = [...routine.routine_exercises]
    const idx = exercises.findIndex(e => e.id === routineExerciseId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= exercises.length) return

    const [a, b] = [exercises[idx], exercises[swapIdx]]
    await supabase.from('routine_exercises').update({ sort_order: b.sort_order }).eq('id', a.id)
    await supabase.from('routine_exercises').update({ sort_order: a.sort_order }).eq('id', b.id)
    await fetchRoutines()
  }

  return {
    routines,
    loading,
    error,
    fetchRoutines,
    createRoutine,
    deleteRoutine,
    updateRoutineName,
    addExerciseToRoutine,
    removeExerciseFromRoutine,
    updateRoutineExercise,
    moveExercise,
  }
}
