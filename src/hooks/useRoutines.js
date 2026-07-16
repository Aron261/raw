import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource } from '../lib/swr'
import { getOrCreateExerciseId } from '../lib/exercises'

// Calcula el siguiente día de un ciclo activo dado el historial de entrenos.
// Ignora workouts sin routine_id o routine_day_id (entrenos libres).
// Si no hay historial vinculado al ciclo, retorna el primer día.
// Ordena por started_at desc; si está ausente, usa created_at como fallback.
export function getNextRoutineDay(activeCycle, workoutsHistory) {
  if (!activeCycle || !activeCycle.routine_days?.length) return null

  const days = [...activeCycle.routine_days].sort((a, b) => a.day_order - b.day_order)

  // Filtrar solo entrenos vinculados a este ciclo con routine_day_id presente
  const linked = (workoutsHistory || []).filter(
    w => w.routine_id === activeCycle.id && w.routine_day_id
  )

  if (!linked.length) return days[0]

  // Ordenar por fecha desc (started_at con fallback a created_at)
  const sorted = [...linked].sort((a, b) => {
    const ta = new Date(a.started_at || a.created_at).getTime()
    const tb = new Date(b.started_at || b.created_at).getTime()
    return tb - ta
  })

  const lastDayId = sorted[0].routine_day_id
  const lastIdx = days.findIndex(d => d.id === lastDayId)

  // Si no se encuentra el día (rutina editada), empezar de nuevo
  if (lastIdx === -1) return days[0]

  // Avanzar al siguiente en orden cíclico
  return days[(lastIdx + 1) % days.length]
}

// useRoutines(targetUserId?) — sin argumento opera sobre el usuario actual.
// Si se pasa targetUserId (un cliente), un entrenador lee y gestiona las rutinas
// de ese cliente; las que cree quedan marcadas con assigned_by = entrenador.
export function useRoutines(targetUserId = null) {
  const { user } = useAuth()

  // Dueño de las rutinas (cliente si es un entrenador operando, si no el propio usuario)
  const ownerId = targetUserId || user?.id
  // Si se opera sobre otro usuario, marcar quién asignó la rutina
  const assignedBy = targetUserId ? (user?.id ?? null) : null

  const key = ownerId ? `routines:${ownerId}` : null

  // Trae todas las rutinas del usuario con sus días y ejercicios
  const fetcher = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('routines')
      .select(`
        id, user_id, name, description, type, source, goal, level,
        days_per_week, is_active, sort_order, assigned_by, created_at, updated_at,
        routine_days (
          id, day_name, day_order, focus,
          routine_day_exercises (
            id, exercise_name, exercise_order, sets, reps, rest_seconds, notes
          )
        )
      `)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })

    if (err) throw err

    // Ordenar días y ejercicios dentro de cada rutina
    return (data || []).map(r => ({
      ...r,
      routine_days: [...(r.routine_days || [])].sort((a, b) => a.day_order - b.day_order).map(d => ({
        ...d,
        routine_day_exercises: [...(d.routine_day_exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order),
      })),
    }))
  }, [ownerId])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const routines = data || []
  const activeRoutine = routines.find(r => r.is_active) || null
  const [mutError, setMutError] = useState(null)
  const setError = setMutError
  const fetchRoutines = refetch
  const error = (loadError ? (loadError.message || 'Error inesperado') : null) || mutError

  // Crear rutina completa con días y ejercicios en cascada
  // data: { name, type, goal?, level?, days_per_week?, days?: [{ day_name, day_order, focus?, exercises?: [...] }] }
  const createRoutine = async (data) => {
    if (!ownerId) throw new Error('Usuario no autenticado')
    setError(null)
    try {
      const { name, description = null, type = 'cycle', source = 'manual', goal, level, days_per_week, days = [] } = data

      // 1. Insertar la rutina principal
      const { data: routineRow, error: routineErr } = await supabase
        .from('routines')
        .insert({ user_id: ownerId, assigned_by: assignedBy, name, description, type, source, goal, level, days_per_week })
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
        .eq('user_id', ownerId)

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
        .eq('user_id', ownerId)

      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error deleting routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // Marcar una rutina como activa (desactiva la actual primero).
  // Llamar con id = null para solo desactivar sin activar ninguna.
  // Solo los ciclos (type = 'cycle') pueden marcarse como activos.
  // Siempre filtra por pk (id) + user_id — nunca bulk update por user_id solo
  // para evitar comportamiento ambiguo en Supabase v2 con columnas uuid.
  const setActiveRoutine = async (id) => {
    if (!ownerId) return

    // Validar que solo los ciclos pueden activarse
    if (id) {
      const target = routines.find(r => r.id === id)
      if (!target) throw new Error('Rutina no encontrada.')
      if (target.type !== 'cycle') throw new Error('Solo los ciclos pueden marcarse como activos.')
    }

    setError(null)
    try {
      // 1. Desactivar la rutina actualmente activa (si existe), por su id específico
      if (activeRoutine?.id) {
        const { error: deactivateErr } = await supabase
          .from('routines')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', activeRoutine.id)
          .eq('user_id', ownerId)

        if (deactivateErr) throw deactivateErr
      }

      // 2. Activar la seleccionada (se omite si id es null)
      if (id) {
        const { error: activateErr } = await supabase
          .from('routines')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', ownerId)

        if (activateErr) throw activateErr
      }

      await fetchRoutines()
    } catch (err) {
      console.error('Error setting active routine:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // ── Día: agregar / editar / eliminar ──────────────────────────────────
  const addDay = async (routineId, { day_name = 'Nuevo día', focus = null } = {}) => {
    setError(null)
    try {
      const routine = routines.find(r => r.id === routineId)
      const order = routine?.routine_days?.length ?? 0
      const { error: err } = await supabase
        .from('routine_days')
        .insert({ routine_id: routineId, day_name, day_order: order, focus })
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error adding day:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const updateDay = async (dayId, updates) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('routine_days').update(updates).eq('id', dayId)
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error updating day:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const removeDay = async (dayId) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('routine_days').delete().eq('id', dayId)
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error removing day:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  // ── Ejercicio del día: agregar / editar / eliminar ────────────────────
  // muscleGroup (opcional): clasifica el ejercicio en la tabla del usuario
  // (best-effort — un fallo de clasificación no impide agregarlo al día).
  const addDayExercise = async (routineDayId, { name, sets = null, reps = null, muscleGroup = null }) => {
    setError(null)
    try {
      const cleanName = (name || '').trim()
      if (!cleanName) return

      // Clasificación en la tabla propia de ejercicios (no bloquea si falla).
      // Solo para la rutina propia: el resolutor canónico crea sobre auth.uid(),
      // así que un entrenador editando la rutina de un cliente no puede — ni
      // debe — sembrar ejercicios en la cuenta del cliente desde aquí. Ese
      // ejercicio se creará, ya canónico, cuando el cliente empiece el entreno.
      if (ownerId && ownerId === user?.id) {
        try { await getOrCreateExerciseId(cleanName, muscleGroup) } catch { /* best-effort */ }
      }

      // Orden = cantidad actual de ejercicios en ese día (conteo fresco en DB)
      const { count } = await supabase
        .from('routine_day_exercises')
        .select('*', { count: 'exact', head: true })
        .eq('routine_day_id', routineDayId)
      const order = count ?? 0

      const { error: err } = await supabase
        .from('routine_day_exercises')
        .insert({ routine_day_id: routineDayId, exercise_name: cleanName, exercise_order: order, sets, reps })
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error adding day exercise:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const updateDayExercise = async (id, updates) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('routine_day_exercises').update(updates).eq('id', id)
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error updating day exercise:', err)
      setError(err.message || 'Error inesperado')
      throw err
    }
  }

  const removeDayExercise = async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase.from('routine_day_exercises').delete().eq('id', id)
      if (err) throw err
      await fetchRoutines()
    } catch (err) {
      console.error('Error removing day exercise:', err)
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
    addDay,
    updateDay,
    removeDay,
    addDayExercise,
    updateDayExercise,
    removeDayExercise,
  }
}
