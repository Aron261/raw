import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { calc1RM, calcVolume } from './useWorkout'

// Month key (YYYY-MM) + short label for a given date.
function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short' })
}

// Last N month keys (oldest first), e.g. ['2025-07', ..., '2026-06'].
function getLastNMonths(n = 12) {
  const keys = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

// useStats(targetUserId?) — all-time aggregates for the lifter's stats page.
// Sin argumento usa el usuario actual; con targetUserId, lectura de un cliente.
export function useStats(targetUserId = null) {
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ownerId) return

    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: workouts, error } = await supabase
          .from('workouts')
          .select(`
            id, started_at, ended_at,
            workout_exercises (
              unit,
              exercises ( name ),
              sets ( weight, reps )
            )
          `)
          .eq('user_id', ownerId)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })

        if (error) throw error
        const list = workouts || []

        // ── All-time totals ───────────────────────────────────────────
        let totalVolume = 0
        let totalSets = 0
        let totalReps = 0
        list.forEach(w => {
          ;(w.workout_exercises || []).forEach(we => {
            const sets = (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
            totalVolume += calcVolume(sets)
            sets.forEach(s => {
              totalSets += 1
              totalReps += s.reps || 0
            })
          })
        })

        const totals = {
          workouts: list.length,
          volume: Math.round(totalVolume),
          sets: totalSets,
          reps: totalReps,
        }

        // ── Volume by month (last 12) ─────────────────────────────────
        const monthKeys = getLastNMonths(12)
        const cutoff = new Date(monthKeys[0] + '-01')
        const monthMap = Object.fromEntries(
          monthKeys.map(k => [k, { key: k, label: monthLabel(k), volume: 0 }])
        )
        list
          .filter(w => new Date(w.started_at) >= cutoff)
          .forEach(w => {
            const key = monthKey(w.started_at)
            if (!monthMap[key]) return
            const sets = (w.workout_exercises || []).flatMap(we =>
              (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
            )
            monthMap[key].volume += calcVolume(sets)
          })
        const volumeByMonth = monthKeys.map(k => ({
          ...monthMap[k],
          volume: Math.round(monthMap[k].volume),
        }))

        // ── All lifts ranked by best estimated 1RM ────────────────────
        const liftMap = {}
        list.forEach(w => {
          ;(w.workout_exercises || []).forEach(we => {
            const name = we.exercises?.name
            if (!name) return
            ;(we.sets || []).forEach(s => {
              const rm = calc1RM(s.weight, s.reps)
              if (!liftMap[name] || rm > liftMap[name].best1RM) {
                liftMap[name] = { name, best1RM: rm, unit: we.unit || 'kg' }
              }
            })
          })
        })
        const allLifts = Object.values(liftMap).sort((a, b) => b.best1RM - a.best1RM)

        // ── Volume by muscle group (all-time) ─────────────────────────
        const names = [...new Set(
          list.flatMap(w => (w.workout_exercises || []).map(we => we.exercises?.name).filter(Boolean))
        )]
        const groupByName = {}
        if (names.length > 0) {
          const { data: lib } = await supabase
            .from('exercises_library')
            .select('name, muscle_group')
            .in('name', names)
          ;(lib || []).forEach(e => { groupByName[e.name] = e.muscle_group })
        }
        const groupVolume = {}
        list.forEach(w => {
          ;(w.workout_exercises || []).forEach(we => {
            const group = groupByName[we.exercises?.name] || 'Otro'
            const vol = calcVolume((we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' })))
            if (vol === 0) return
            groupVolume[group] = (groupVolume[group] || 0) + vol
          })
        })
        const muscleBalance = Object.entries(groupVolume)
          .map(([group, volume]) => ({ group, volume: Math.round(volume) }))
          .sort((a, b) => b.volume - a.volume)

        setData({ totals, volumeByMonth, allLifts, muscleBalance })
      } catch (err) {
        console.error('Stats fetch error:', err)
        setError(err.message || 'Error inesperado')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [ownerId])

  return { data, loading, error }
}
