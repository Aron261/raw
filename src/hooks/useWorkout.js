import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { planMove, normalizeOrder } from '../lib/supersets'
import { useAuth } from './useAuth'
import { useCachedResource } from '../lib/swr'
import { getOrCreateExerciseId, resolveExerciseIds as resolveExerciseIdsCanonical } from '../lib/exercises'
import { outbox } from '../lib/outbox'
import { sessionCache } from '../lib/sessionCache'
import { useProfile } from './useProfile'
import { defaultLiftUnit } from '../lib/units'
import { calc1RM } from '../lib/progress'

// How many set writes are still queued (unsynced) for a workout — drives the
// "N series sin sincronizar" indicator. Re-reads whenever the outbox changes.
export function useOutboxCount(workoutId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const refresh = async () => { const c = await outbox.count(workoutId); if (alive) setCount(c) }
    refresh()
    return outbox.subscribe(refresh)
  }, [workoutId])
  return count
}

// sets.id is uuid — the client-generated id must be a real v4 uuid so an
// offline-created set inserts cleanly once it syncs.
const newSetId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Epley vive en lib/progress (módulo puro, junto a la comparación que lo usa).
// Se reexporta aquí porque media app la importa de este hook.
//
// Ojo con la forma: `export { calc1RM } from '...'` reexporta el símbolo para
// quien importe ESTE módulo, pero NO lo mete en el ámbito del módulo — y aquí
// dentro se usa cuatro veces. El resultado era un ReferenceError dentro de
// useExercisePR y useExerciseAllTimeBest que se tragaba el catch: el detalle
// de un ejercicio decía "Sin datos aún" para ejercicios con años de historial.
// El import de arriba lo mete en ámbito; esto solo lo vuelve a exponer.
export { calc1RM }

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
  const { profile } = useProfile()
  const unit = defaultLiftUnit(profile)
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
          exercises ( id, name, library_id, library:exercises_library ( name, name_en, gif_url, media_reviewed ) ),
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
  // that don't exist yet. Goes through the canonical resolver so a routine
  // written as "Bench Press" reuses the same exercise — and the same PR
  // history — as one written "Press de banca con barra".
  const resolveExerciseIds = (names) => resolveExerciseIdsCanonical(names)

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
        unit: we.unit || unit,
      }))
    if (rows.length > 0) {
      const { error: weErr } = await supabase.from('workout_exercises').insert(rows)
      if (weErr) throw weErr
    }

    await fetchWorkouts()
    return newWorkout
  }

  // Create a new workout pre-loaded with exercises from a cycle day.
  // Links back to the routine + day so the active workout can surface the
  // day's prescribed sets/reps as a guide (and cycle progression advances).
  const createWorkoutFromCycleDay = async (cycleDay) => {
    const { data: workoutData, error: workoutErr } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: cycleDay.day_name,
        started_at: new Date().toISOString(),
        routine_id: cycleDay.routineId || null,
        routine_day_id: cycleDay.id || null,
        source: cycleDay.routineId ? 'routine' : 'manual',
      })
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
        unit,
      }))
    if (rows.length > 0) {
      const { error: weErr } = await supabase.from('workout_exercises').insert(rows)
      if (weErr) throw weErr
    }

    await fetchWorkouts()
    return workoutData
  }

  return { workouts, loading, error, fetchWorkouts, createWorkout, updateWorkout, deleteWorkout, duplicateWorkout, createWorkoutFromCycleDay }
}

// Hook to manage a single active workout
export function useActiveWorkout(workoutId) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [workout, setWorkout] = useState(null)
  const [workoutExercises, setWorkoutExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Se está pintando la foto guardada porque el servidor no contesta. No es un
  // error: las series se siguen registrando y encolando con normalidad.
  const [stale, setStale] = useState(false)

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
          id, sort_order, unit, notes, group_id, group_order,
          exercises ( id, name, library_id, library:exercises_library ( name, name_en, gif_url, media_reviewed ) ),
          sets ( id, set_number, reps, weight, created_at )
        `)
        .eq('workout_id', workoutId)
        .order('sort_order', { ascending: true })

      if (exercisesError) throw exercisesError

      // Prescription guide: if this workout came from a routine day, pull that
      // day's planned sets/reps so each exercise can show its target (e.g.
      // "4 × 8-12") and lay out the prescribed number of rows to fill in. It's
      // a live guide, not stored history — the lifter can still do more or less.
      // Best-effort: a lookup failure must never block the workout from loading.
      let planByName = {}
      if (workoutData.routine_day_id) {
        try {
          const { data: planned } = await supabase
            .from('routine_day_exercises')
            .select('exercise_name, sets, reps, rest_seconds')
            .eq('routine_day_id', workoutData.routine_day_id)
          for (const p of (planned || [])) {
            const key = (p.exercise_name || '').trim().toLowerCase()
            if (key) planByName[key] = { sets: p.sets, reps: p.reps, rest: p.rest_seconds }
          }
        } catch { /* no guide — fall back to previous-session defaults */ }
      }

      // Sort sets by set_number within each exercise; attach the routine target.
      const sorted = (exercisesData || []).map(we => {
        const plan = planByName[(we.exercises?.name || '').trim().toLowerCase()]
        return {
          ...we,
          target_sets: plan?.sets ?? null,
          target_reps: plan?.reps ?? null,
          target_rest: plan?.rest ?? null,
          sets: [...(we.sets || [])].sort((a, b) => a.set_number - b.set_number),
        }
      })

      setWorkoutExercises(sorted)
      setStale(false)
    } catch (err) {
      // Sin conexión a mitad de entreno, la foto guardada es infinitamente
      // mejor que una pantalla de error: deja seguir viendo y registrando, y
      // lo que se escriba se encola igual. Solo si no hay foto —primera carga
      // de este entreno en este dispositivo— queda un error que mostrar.
      const snap = await sessionCache.load(workoutId).catch(() => null)
      if (snap) {
        setWorkout(snap.workout)
        setWorkoutExercises(snap.workoutExercises)
        setStale(true)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [workoutId, user])

  useEffect(() => {
    fetchWorkout()
  }, [fetchWorkout])

  // Pintar la foto antes de que conteste el servidor: en el gimnasio la red
  // tarda o no llega, y el entreno tiene que aparecer al instante igual. Lo que
  // traiga el servidor después la reemplaza.
  useEffect(() => {
    if (!workoutId) return
    let alive = true
    sessionCache.load(workoutId).then(snap => {
      if (!alive || !snap) return
      setWorkout(prev => prev ?? snap.workout)
      setWorkoutExercises(prev => (prev.length ? prev : snap.workoutExercises))
      setLoading(false)
    }).catch(() => { /* sin foto: se espera al servidor */ })
    return () => { alive = false }
  }, [workoutId])

  // Guardar tras CADA cambio del estado local, no solo tras traer del servidor:
  // así la foto incluye las series que aún están en la cola. Guardar la
  // respuesta del servidor borraría de la vista justo esas.
  useEffect(() => {
    if (!workoutId || !workout) return
    sessionCache.save(workoutId, { workout, workoutExercises }).catch(() => { /* mejor esfuerzo */ })
  }, [workoutId, workout, workoutExercises])

  const updateWorkoutName = async (name) => {
    const { error: err } = await supabase
      .from('workouts')
      .update({ name })
      .eq('id', workoutId)
    if (err) throw err
    setWorkout(prev => ({ ...prev, name }))
  }

  const finishWorkout = async () => {
    // Flush queued sets before closing the workout, so what's finished on the
    // server is what the lifter actually logged. Ops are idempotent, so this
    // is safe even if the background loop drains at the same time.
    const res = await outbox.drain(syncHandlers)
    if (res.remaining > 0) throw new Error('Quedan series sin sincronizar. Reconéctate para finalizar.')
    const endedAt = new Date().toISOString()
    const { error: err } = await supabase
      .from('workouts')
      .update({ ended_at: endedAt })
      .eq('id', workoutId)
    if (err) throw err
    setWorkout(prev => ({ ...prev, ended_at: endedAt }))
    // El entreno ya está cerrado en el servidor: su foto solo ocuparía sitio.
    await sessionCache.remove(workoutId).catch(() => { /* mejor esfuerzo */ })
  }

  // Add exercise to workout (creates exercise if not exists, then adds workout_exercise)
  // muscleGroup (optional): set on the user's exercises row so custom exercises
  // get classified. Only written when provided, never nulling an existing value.
  const addExercise = async (exerciseName, muscleGroup = null) => {
    // Canonical resolution: whatever spelling was typed lands on the one
    // exercise that already holds this movement's history.
    const exerciseId = await getOrCreateExerciseId(exerciseName, muscleGroup)
    if (!exerciseId) return

    // Determine next sort order
    const nextOrder = workoutExercises.length

    const { error: weError } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        sort_order: nextOrder,
        unit: defaultLiftUnit(profile)
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

  // ── Offline-first set writes ──────────────────────────────────────────
  // Sets are written optimistically to local state and queued in the outbox;
  // a background loop drains the queue to the server when online. The optimistic
  // set carries a client-generated id that IS its server id (sets.id accepts an
  // explicit uuid), so the row never changes identity across a sync — the
  // done-state map, keyed by set id, stays valid, and a set edited before its
  // create syncs coalesces onto one write.
  const syncing = useRef(false)

  const syncHandlers = {
    'set.upsert': async (op) => {
      const { error } = await supabase.from('sets').upsert(op.data, { onConflict: 'id' })
      if (error) throw error
    },
    'set.delete': async (op) => {
      const { error } = await supabase.from('sets').delete().eq('id', op.data.id)
      if (error) throw error
    },
  }

  const sync = useCallback(async () => {
    if (syncing.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    syncing.current = true
    try {
      const res = await outbox.drain(syncHandlers)
      // A clean drain means the server now matches local state; reconcile once
      // to pick up server-authoritative fields (created_at, ordering).
      if (res.remaining === 0 && (await outbox.count(workoutId)) === 0) {
        await fetchWorkout()
      }
    } catch { /* stay queued; a later trigger retries */ }
    finally { syncing.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, fetchWorkout])

  // Drain on mount and whenever the connection returns.
  useEffect(() => {
    sync()
    const onOnline = () => sync()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [sync])

  const applyLocalSet = (workoutExerciseId, row) => {
    setWorkoutExercises(prev => prev.map(we => {
      if (we.id !== workoutExerciseId) return we
      const has = (we.sets || []).some(s => s.id === row.id)
      const sets = has
        ? we.sets.map(s => (s.id === row.id ? { ...s, ...row } : s))
        : [...(we.sets || []), row].sort((a, b) => a.set_number - b.set_number)
      return { ...we, sets }
    }))
  }

  const addSet = async (workoutExerciseId, reps, weight, setNumber = null) => {
    const we = workoutExercises.find(w => w.id === workoutExerciseId)
    const nextSetNumber = setNumber ?? (we?.sets?.length || 0) + 1
    const row = {
      id: newSetId(),
      workout_exercise_id: workoutExerciseId,
      set_number: nextSetNumber,
      reps: parseInt(reps, 10) || 0,
      weight: parseFloat(weight) || 0,
    }
    applyLocalSet(workoutExerciseId, { ...row, created_at: new Date().toISOString() })
    await outbox.enqueue({ kind: 'set.upsert', workoutId, dedupeKey: row.id, data: row })
    sync()
    return { id: row.id }
  }

  const updateSet = async (setId, updates) => {
    // Rebuild the full row so the queued upsert is self-contained (idempotent by id).
    let full = null
    setWorkoutExercises(prev => prev.map(we => {
      const idx = (we.sets || []).findIndex(s => s.id === setId)
      if (idx === -1) return we
      const merged = { ...we.sets[idx], ...updates }
      full = {
        id: setId,
        workout_exercise_id: we.id,
        set_number: merged.set_number,
        reps: parseInt(merged.reps, 10) || 0,
        weight: parseFloat(merged.weight) || 0,
      }
      const sets = we.sets.map(s => (s.id === setId ? merged : s))
      return { ...we, sets }
    }))
    if (!full) return
    await outbox.enqueue({ kind: 'set.upsert', workoutId, dedupeKey: setId, data: full })
    sync()
  }

  const deleteSet = async (setId) => {
    setWorkoutExercises(prev => prev.map(we => ({
      ...we, sets: (we.sets || []).filter(s => s.id !== setId),
    })))
    // If the create never synced, cancel it instead of create-then-delete.
    const hadPending = await outbox.removeByDedupe('set.upsert', setId)
    if (!hadPending) {
      await outbox.enqueue({ kind: 'set.delete', workoutId, dedupeKey: setId, data: { id: setId } })
    }
    sync()
  }

  // Escribir un orden ya calculado (sort_order + group_order) y renumerar de
  // paso, para que el cambio aguante aunque los valores vinieran con huecos.
  const applyOrder = async (rows) => {
    const byId = new Map(rows.map(r => [r.id, r]))
    setWorkoutExercises(prev => prev
      .map(w => {
        const r = byId.get(w.id)
        return r ? { ...w, sort_order: r.sort_order, group_order: r.group_order } : w
      })
      .sort((a, b) => a.sort_order - b.sort_order))

    try {
      await Promise.all(rows.map(r =>
        supabase.from('workout_exercises')
          .update({ sort_order: r.sort_order, group_order: r.group_order })
          .eq('id', r.id)
      ))
    } catch (err) {
      setError(err.message)
      await fetchWorkout()
    }
  }

  // Mover un ejercicio arriba/abajo. Lo que se mueve es el BLOQUE, no la fila:
  // una superserie viaja entera, y desde dentro de ella el movimiento cambia el
  // orden de la vuelta. Las reglas están en lib/supersets — aquí solo se
  // escriben. Así no hay forma de dejar a A y B separados por un tercero.
  const moveExercise = async (workoutExerciseId, dir) => {
    const rows = planMove(workoutExercises, workoutExerciseId, dir)
    if (!rows) return
    await applyOrder(rows)
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

  // ── Superseries ───────────────────────────────────────────────────────
  // Unir este ejercicio con el siguiente de la sesión. Si alguno de los dos ya
  // está en una superserie, se entra en esa en vez de abrir otra: encadenar
  // A+B y luego B+C tiene que dar A+B+C, no dos grupos que se pisan.
  const linkWithNext = async (workoutExerciseId) => {
    const ordered = [...workoutExercises].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex(w => w.id === workoutExerciseId)
    if (idx === -1 || idx === ordered.length - 1) return
    const a = ordered[idx]
    const b = ordered[idx + 1]

    const groupId = a.group_id || b.group_id || crypto.randomUUID()
    // Todo el grupo resultante se renumera en el orden en que está la sesión:
    // la vuelta de la superserie es el orden que se ve, sin excepciones.
    const members = ordered.filter(w =>
      w.id === a.id || w.id === b.id ||
      (w.group_id && (w.group_id === a.group_id || w.group_id === b.group_id))
    )
    const inGroup = new Set(members.map(w => w.id))
    const grouped = ordered.map(w => (inGroup.has(w.id) ? { ...w, group_id: groupId } : w))

    // Y el orden se recoloca: unir es lo que crea el bloque, así que es también
    // donde tiene que quedar junto. Encadenar A+B y luego B+C da un bloque de
    // tres seguidos aunque C estuviera al final de la sesión.
    const rows = normalizeOrder(grouped)
    const orderById = new Map(rows.map(r => [r.id, r]))

    setWorkoutExercises(prev => prev
      .map(w => {
        const r = orderById.get(w.id)
        return {
          ...w,
          group_id: inGroup.has(w.id) ? groupId : w.group_id,
          sort_order: r ? r.sort_order : w.sort_order,
          group_order: r ? r.group_order : w.group_order,
        }
      })
      .sort((x, y) => x.sort_order - y.sort_order))

    try {
      await Promise.all(rows.map(r =>
        supabase.from('workout_exercises')
          .update({
            ...(inGroup.has(r.id) ? { group_id: groupId } : {}),
            sort_order: r.sort_order,
            group_order: r.group_order,
          })
          .eq('id', r.id)
      ))
    } catch (err) {
      setError(err.message)
      await fetchWorkout()
    }
  }

  // Sacar un ejercicio de su superserie. Si el grupo se queda con uno solo deja
  // de ser superserie: un grupo de un miembro no alterna con nadie.
  const unlinkExercise = async (workoutExerciseId) => {
    const me = workoutExercises.find(w => w.id === workoutExerciseId)
    if (!me?.group_id) return
    const rest = workoutExercises
      .filter(w => w.group_id === me.group_id && w.id !== me.id)
      .sort((a, b) => a.group_order - b.group_order)

    const updates = [{ id: me.id, group_id: null, group_order: 0 }]
    if (rest.length < 2) {
      rest.forEach(w => updates.push({ id: w.id, group_id: null, group_order: 0 }))
    } else {
      rest.forEach((w, i) => updates.push({ id: w.id, group_id: me.group_id, group_order: i }))
    }

    setWorkoutExercises(prev => prev.map(w => {
      const u = updates.find(x => x.id === w.id)
      return u ? { ...w, group_id: u.group_id, group_order: u.group_order } : w
    }))

    try {
      await Promise.all(updates.map(u =>
        supabase.from('workout_exercises')
          .update({ group_id: u.group_id, group_order: u.group_order })
          .eq('id', u.id)
      ))
    } catch (err) {
      setError(err.message)
      await fetchWorkout()
    }
  }

  // Swap the exercise in a workout_exercise row without touching the routine
  const replaceExercise = async (workoutExerciseId, newExerciseName, muscleGroup = null) => {
    const name = newExerciseName.trim()

    const exerciseId = await getOrCreateExerciseId(name, muscleGroup)
    if (!exerciseId) return

    // Point this workout_exercise to the new exercise — routine is untouched
    const { error: weErr } = await supabase
      .from('workout_exercises')
      .update({ exercise_id: exerciseId })
      .eq('id', workoutExerciseId)
    if (weErr) throw weErr

    await fetchWorkout()
  }

  return {
    workout,
    workoutExercises,
    loading,
    error,
    stale,
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
    moveExercise,
    linkWithNext,
    unlinkExercise
  }
}

// Hook to get all-time PR for an exercise (best weight per set)
export function useExercisePR(exerciseName, userId) {
  const [prSets, setPrSets] = useState([]) // history of best sets per workout
  const [allTimePR, setAllTimePR] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPRs = useCallback(async () => {
    if (!exerciseName || !userId) return
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
      setError(null)
    } catch (err) {
      console.error('Error fetching PR:', err)
      // Sin esto, un fallo de red se veía como «Sin datos aún»: la pantalla
      // le decía a alguien con años de historial que nunca había hecho ese
      // ejercicio. Un fallo y un historial vacío no se parecen en nada.
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [exerciseName, userId])

  useEffect(() => { fetchPRs() }, [fetchPRs])

  return { prSets, allTimePR, loading, error, refetch: fetchPRs }
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
