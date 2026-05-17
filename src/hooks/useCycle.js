import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { generateCyclePlan, getCurrentWeek } from '../lib/cycleGenerator'

export function useCycle() {
  const { user } = useAuth()

  const [activeCycle, setActiveCycle]   = useState(null)
  const [cycleData, setCycleData]       = useState(null)   // { days: [...], exercises: [...] }
  const [cycleMemory, setCycleMemory]   = useState([])
  const [currentWeek, setCurrentWeek]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  // ---------------------------------------------------------------------------
  // fetchActiveCycle
  // ---------------------------------------------------------------------------
  const fetchActiveCycle = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      // 1. Load the active training cycle
      const { data: cycleRow, error: cycleErr } = await supabase
        .from('training_cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (cycleErr) throw cycleErr

      if (!cycleRow) {
        setActiveCycle(null)
        setCycleData(null)
        setCurrentWeek(null)
        return
      }

      setActiveCycle(cycleRow)

      // 2. Compute current week from start_date
      const weekInfo = getCurrentWeek(cycleRow.start_date, cycleRow.duration_weeks)
      setCurrentWeek(weekInfo)

      // 3. Load all days for this cycle, ordered
      const { data: days, error: daysErr } = await supabase
        .from('cycle_days')
        .select('*')
        .eq('cycle_id', cycleRow.id)
        .order('day_number', { ascending: true })

      if (daysErr) throw daysErr

      const dayIds = (days || []).map(d => d.id)

      // 4. Load all exercises for those days
      let exercises = []
      if (dayIds.length > 0) {
        const { data: exRows, error: exErr } = await supabase
          .from('cycle_exercises')
          .select('*')
          .in('cycle_day_id', dayIds)

        if (exErr) throw exErr
        exercises = exRows || []
      }

      // 5. Attach exercises to their day
      const daysWithExercises = (days || []).map(day => ({
        ...day,
        exercises: exercises.filter(ex => ex.cycle_day_id === day.id),
      }))

      setCycleData({ days: daysWithExercises, exercises })
    } catch (err) {
      console.error('Error fetching active cycle:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // ---------------------------------------------------------------------------
  // fetchCycleMemory
  // ---------------------------------------------------------------------------
  const fetchCycleMemory = useCallback(async () => {
    if (!user) return
    try {
      const { data, error: memErr } = await supabase
        .from('cycle_memory')
        .select('*')
        .eq('user_id', user.id)
        .order('closed_at', { ascending: false })
        .limit(5)

      if (memErr) throw memErr
      setCycleMemory(data || [])
    } catch (err) {
      console.error('Error fetching cycle memory:', err)
    }
  }, [user])

  // Run both fetches on mount / user change
  useEffect(() => {
    fetchActiveCycle()
    fetchCycleMemory()
  }, [fetchActiveCycle, fetchCycleMemory])

  // ---------------------------------------------------------------------------
  // createCycle
  // wizardData: { name, goal, level, daysPerWeek, dailyTimeMinutes,
  //               durationWeeks, splitChoice, prioritizedGroups, mode }
  // exerciseHistory: { [exerciseName]: { best1RM, unit } }
  // ---------------------------------------------------------------------------
  const createCycle = async (wizardData, exerciseHistory = {}) => {
    if (!user) throw new Error('Usuario no autenticado')

    setLoading(true)
    setError(null)
    try {
      // 1. Generate the plan (only for 'auto' mode; manual mode not yet implemented)
      let plan = []
      if (wizardData.mode === 'auto') {
        plan = generateCyclePlan(
          {
            goal:              wizardData.goal,
            level:             wizardData.level,
            daysPerWeek:       wizardData.daysPerWeek,
            dailyTimeMinutes:  wizardData.dailyTimeMinutes,
            durationWeeks:     wizardData.durationWeeks,
            splitChoice:       wizardData.splitChoice ?? null,
            prioritizedGroups: wizardData.prioritizedGroups ?? [],
          },
          exerciseHistory
        )
      }

      // 2. Insert the training_cycles row
      const startDate = new Date()
      const endDate   = new Date(startDate)
      endDate.setDate(endDate.getDate() + wizardData.durationWeeks * 7)

      // Derive split_type label from daysPerWeek
      const splitType = wizardData.daysPerWeek <= 3 ? 'Full Body'
        : wizardData.daysPerWeek === 4 ? 'Upper/Lower'
        : wizardData.daysPerWeek === 5 ? (wizardData.splitChoice === 'ppl_pure' ? 'PPL Puro' : 'PPL+UL')
        : 'PPL'

      const { data: cycleRow, error: insertCycleErr } = await supabase
        .from('training_cycles')
        .insert({
          user_id:            user.id,
          name:               wizardData.name,
          goal:               wizardData.goal,
          level:              wizardData.level,
          days_per_week:      wizardData.daysPerWeek,
          daily_time_minutes: wizardData.dailyTimeMinutes,
          duration_weeks:     wizardData.durationWeeks,
          split_type:         splitType,
          status:             'active',
          start_date:         startDate.toISOString().split('T')[0],
          end_date:           endDate.toISOString().split('T')[0],
        })
        .select()
        .single()

      if (insertCycleErr) throw insertCycleErr

      const cycleId = cycleRow.id

      // 3. Insert cycle_days + cycle_exercises for each day in the plan
      for (const dayPlan of plan) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('cycle_days')
          .insert({
            cycle_id:      cycleId,
            day_number:    dayPlan.dayNumber,
            day_name:      dayPlan.dayName,
            muscle_groups: dayPlan.muscleGroups,
          })
          .select()
          .single()

        if (dayErr) throw dayErr

        if (dayPlan.exercises && dayPlan.exercises.length > 0) {
          const exerciseRows = dayPlan.exercises.map(ex => ({
            cycle_day_id:      dayRow.id,
            exercise_name:     ex.exerciseName,
            sets:              ex.sets,
            reps_min:          ex.repsMin,
            reps_max:          ex.repsMax,
            intensity_percent: ex.intensityPercent,
            week_override:     null,
          }))

          const { error: exInsertErr } = await supabase
            .from('cycle_exercises')
            .insert(exerciseRows)

          if (exInsertErr) throw exInsertErr
        }
      }

      // 4. Insert cycle_weeks (week 1 = 'active', rest = 'pending')
      const weekRows = Array.from({ length: wizardData.durationWeeks }, (_, i) => ({
        cycle_id:    cycleId,
        week_number: i + 1,
        status:      i === 0 ? 'active' : 'pending',
      }))

      const { error: weeksErr } = await supabase
        .from('cycle_weeks')
        .insert(weekRows)

      if (weeksErr) throw weeksErr

      // 5. Refetch to update local state
      await fetchActiveCycle()
      await fetchCycleMemory()
    } catch (err) {
      console.error('Error creating cycle:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // closeCycle
  // volumeByGroup: { [muscleGroup]: totalSets }
  // ---------------------------------------------------------------------------
  const closeCycle = async (cycleId, volumeByGroup = {}) => {
    if (!user) throw new Error('Usuario no autenticado')
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]

      // 1. Mark cycle as closed
      const { error: closeErr } = await supabase
        .from('training_cycles')
        .update({ status: 'closed', end_date: today })
        .eq('id', cycleId)
        .eq('user_id', user.id)

      if (closeErr) throw closeErr

      // 2. Compute top-3 prioritized groups from volume data
      const sortedGroups = Object.entries(volumeByGroup)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([group]) => group)

      // 3. Insert cycle_memory record
      const { error: memInsertErr } = await supabase
        .from('cycle_memory')
        .insert({
          user_id:            user.id,
          cycle_id:           cycleId,
          volume_by_group:    volumeByGroup,
          prioritized_groups: sortedGroups,
          closed_at:          new Date().toISOString(),
        })

      if (memInsertErr) throw memInsertErr

      // 4. Refetch
      await fetchActiveCycle()
      await fetchCycleMemory()
    } catch (err) {
      console.error('Error closing cycle:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // updateCycleExercise
  // weekOverride: number | null
  //   null  → update the existing record in-place
  //   number → insert a new week-specific override row
  // ---------------------------------------------------------------------------
  const updateCycleExercise = async (cycleExerciseId, updates, weekOverride = null) => {
    setError(null)
    try {
      if (weekOverride === null) {
        // Direct update on the existing record
        const { error: updateErr } = await supabase
          .from('cycle_exercises')
          .update(updates)
          .eq('id', cycleExerciseId)

        if (updateErr) throw updateErr
      } else {
        // Fetch the original row to copy its fields into the new override
        const { data: originalRow, error: fetchErr } = await supabase
          .from('cycle_exercises')
          .select('*')
          .eq('id', cycleExerciseId)
          .single()

        if (fetchErr) throw fetchErr

        // Insert a new row with the week_override flag and merged updates
        const { id: _id, created_at: _created, ...rowWithoutId } = originalRow
        const { error: insertErr } = await supabase
          .from('cycle_exercises')
          .insert({
            ...rowWithoutId,
            ...updates,
            week_override: weekOverride,
          })

        if (insertErr) throw insertErr
      }

      // Re-fetch to keep UI in sync
      await fetchActiveCycle()
    } catch (err) {
      console.error('Error updating cycle exercise:', err)
      setError(err.message)
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // refetch — convenience wrapper to reload everything
  // ---------------------------------------------------------------------------
  const refetch = useCallback(async () => {
    await fetchActiveCycle()
    await fetchCycleMemory()
  }, [fetchActiveCycle, fetchCycleMemory])

  return {
    activeCycle,
    cycleData,
    cycleMemory,
    currentWeek,
    loading,
    error,
    createCycle,
    closeCycle,
    updateCycleExercise,
    refetch,
  }
}
