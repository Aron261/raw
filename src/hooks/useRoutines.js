import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRoutines() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState([])
  const [activeRoutine, setActiveRoutineState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Trae todas las rutinas del usuario con sus días y ejercicios
  const fetchRoutines = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('routines')
        .select(`
          id, name, type, goal, level, days_per_week, is_active, created_at, updated_at,
          routine_days (
            id, day_name, day_order, focus,
            routine_day_exercises (
              id, exercise_name, exercise_order, sets, reps, rest_seconds, notes
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (err) throw err

      // Ordenar días y ejercicios dentro de cada rutina
      const sorted = (data || []).map(r => ({
        ...r,
        routine_days: [...(r.routine_days || [])].sort((a, b) => a.day_order - b.day_order).map(d => ({
          ...d,
          routine_day_exercises: [...(d.routine_day_exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order),
        })),
      }))

      setRoutines(sorted)
      setActiveRoutineState(sorted.find(r => r.is_active) || null)
    } catch (err) {
      console.error('Error fetching routines:', err)
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchRoutines() }, [fetchRoutines])

  // Crear rutina completa con días y ejercicios en cascada
  // data: { name, type, goal?, level?, days_per_week?, days?: [{ day_name, day_order, focus?, exercises?: [...] }] }
  const createRoutine = async (data) => {
    if (!user) throw new Error('Usuario no autenticado')
    setError(null)
    try {
      const { name, type = 'custom', goal, level, days_per_week, days = [] } = data

      // 1. Insertar la rutina principal
      const { data: routineRow, error: routineErr } = await supabase
        .from('routines')
        .insert({ user_id: user.id, name, type, goal, level, days_per_week })
        .select()
        .single()

      if (routineErr) throw routineErr

      // 2. Insertar días en cascada
      for (const day of days) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('routine_days')
          .insert({
            routine_id: routineRow.id,
            day_name: day.day_name,
            day_order: day.day_order,
            focus: day.focus || null,
          })
          .select()
          .single()

        if (dayErr) throw dayErr

        // 3. Insertar ejercicios dentro del día
        const exercises = day.exercises || []
        if (exercises.length > 0) {
          const exerciseRows = exercises.map((ex, i) => ({
            routine_day_id: dayRow.id,
            exercise_name: ex.exercise_name,
            exercise_order: ex.exercise_order ?? i,
            sets: ex.sets || null,
            reps: ex.reps || null,
            rest_seconds: ex.rest_seconds || null,
            notes: ex.notes || null,
          }))

          const { error: exErr } = await supabase
            .from('routine_day_exercises')
            .insert(exerciseRows)

          if (exErr) throw exErr
        }
      }

      await fetchRoutines()
      return routineRow
    } catch (err) {
      console.error('Error creating routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Actualizar campos de la rutina (name, goal, level, etc.)
  const updateRoutine = async (id, updates) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('routines')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error updating routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Eliminar rutina (cascade borra días y ejercicios por FK)
  const deleteRoutine = async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('routines')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error deleting routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Marcar una rutina como activa (desactiva las demás)
  const setActiveRoutine = async (id) => {
    setError(null)
    try {
      // Desactivar todas las rutinas del usuario
      const { error: deactivateErr } = await supabase
        .from('routines')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (deactivateErr) throw deactivateErr

      // Activar la seleccionada
      const { error: activateErr } = await supabase
        .from('routines')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (activateErr) throw activateErr
      await fetchRoutines()
    } catch (err) {
      console.error('Error setting active routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  return {
    routines,
    activeRoutine,
    loading,
    error,
    fetchRoutines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setActiveRoutine,
  }
}
