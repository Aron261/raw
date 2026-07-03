import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { calc1RM, calcVolume } from './useWorkout'
import { useCachedResource } from '../lib/swr'

// Returns the ISO Monday for any given date
function getWeekKey(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

// Generate the last N week keys (Monday dates), oldest first
function getLastNWeeks(n = 8) {
  const weeks = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    weeks.push(getWeekKey(d))
  }
  return [...new Set(weeks)]
}

function weekLabel(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// useDashboard(targetUserId?) — sin argumento, dashboard del usuario actual.
// Con targetUserId, un entrenador lee (solo lectura) el progreso de ese cliente.
export function useDashboard(targetUserId = null) {
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const key = ownerId ? `dashboard:${ownerId}` : null

  const fetcher = useCallback(async () => {
      {
        const { data: workouts, error } = await supabase
          .from('workouts')
          .select(`
            id, name, started_at, ended_at,
            workout_exercises (
              unit,
              exercises ( id, name ),
              sets ( weight, reps )
            )
          `)
          .eq('user_id', ownerId)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })

        if (error) throw error
        if (!workouts) return null

        // ── Weekly data ────────────────────────────────────────────────
        const weekKeys = getLastNWeeks(8)
        const cutoff = new Date(weekKeys[0])
        const weekMap = Object.fromEntries(
          weekKeys.map(k => [k, { week: k, label: weekLabel(k), count: 0, volume: 0 }])
        )

        workouts
          .filter(w => new Date(w.started_at) >= cutoff)
          .forEach(w => {
            const key = getWeekKey(w.started_at)
            if (!weekMap[key]) return
            weekMap[key].count += 1
            const allSets = w.workout_exercises.flatMap(we =>
              (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
            )
            weekMap[key].volume += calcVolume(allSets)
          })

        const weeklyData = weekKeys.map(k => ({
          ...weekMap[k],
          volume: Math.round(weekMap[k].volume),
        }))

        // ── Best lifts (all time, top 6 by 1RM) ───────────────────────
        const exerciseMap = {}
        workouts.forEach(w => {
          w.workout_exercises.forEach(we => {
            const name = we.exercises?.name
            if (!name) return
            we.sets?.forEach(set => {
              const rm = calc1RM(set.weight, set.reps)
              if (!exerciseMap[name] || rm > exerciseMap[name].best1RM) {
                exerciseMap[name] = { name, best1RM: rm, unit: we.unit }
              }
            })
          })
        })
        const bestLifts = Object.values(exerciseMap)
          .sort((a, b) => b.best1RM - a.best1RM)
          .slice(0, 6)

        // ── Muscle group volume (last 7 days) ─────────────────────────
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Collect unique exercise names from recent workouts
        const recentWorkouts = workouts.filter(w => new Date(w.started_at) >= sevenDaysAgo)
        const exerciseNames = [...new Set(
          recentWorkouts.flatMap(w => w.workout_exercises.map(we => we.exercises?.name).filter(Boolean))
        )]

        // Fetch muscle groups from the library for those names
        let muscleGroupMap = {}
        if (exerciseNames.length > 0) {
          const { data: libData } = await supabase
            .from('exercises_library')
            .select('name, muscle_group')
            .in('name', exerciseNames)
          ;(libData || []).forEach(e => { muscleGroupMap[e.name] = e.muscle_group })
        }

        // Sum volume per muscle group
        const mgVolume = {}
        recentWorkouts.forEach(w => {
          w.workout_exercises.forEach(we => {
            const exName = we.exercises?.name
            const group = muscleGroupMap[exName] || 'Otro'
            const vol = calcVolume((we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' })))
            if (vol === 0) return
            mgVolume[group] = (mgVolume[group] || 0) + vol
          })
        })

        const muscleGroupData = Object.entries(mgVolume)
          .map(([group, volume]) => ({ group, volume: Math.round(volume) }))
          .sort((a, b) => b.volume - a.volume)

        // ── Summary stats ──────────────────────────────────────────────
        const thisMonth = workouts.filter(w => {
          const d = new Date(w.started_at)
          const now = new Date()
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length

        const lastWorkout = workouts[0] || null

        return {
          weeklyData,
          bestLifts,
          muscleGroupData,
          totalWorkouts: workouts.length,
          thisMonth,
          lastWorkout,
        }
      }
  }, [ownerId])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const error = loadError ? (loadError.message || 'Error inesperado') : null

  return { data: data ?? null, loading, error, refetch }
}
