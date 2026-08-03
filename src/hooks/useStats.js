import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { calc1RM, calcVolume } from './useWorkout'
import { useLang } from './useLang'
import { attributeSplit, totalOf, indexLibrary, resolveMuscles } from '../lib/volumeAttribution'
import { useCachedResource } from '../lib/swr'

// Month key (YYYY-MM) + short label for a given date.
function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key, locale = 'es-CO') {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short' })
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
  const { locale } = useLang()
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const key = ownerId ? `stats:${ownerId}` : null

  const fetcher = useCallback(async () => {
    {
      {
        const { data: workouts, error } = await supabase
          .from('workouts')
          .select(`
            id, started_at, ended_at,
            workout_exercises (
              unit,
              exercises ( name, muscle_group, library_id ),
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
          monthKeys.map(k => [k, { key: k, label: monthLabel(k, locale), volume: 0 }])
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
        // El tonelaje de un ejercicio se le acredita entero a su músculo
        // principal y a la mitad a cada secundario: los kilos del press de
        // banca los mueve también el tríceps, aunque el ejercicio se llame de
        // pecho.
        const rows = list.flatMap(w => (w.workout_exercises || []).map(we => we.exercises).filter(Boolean))
        const names = [...new Set(rows.map(e => e.name).filter(Boolean))]
        const libIds = [...new Set(rows.map(e => e.library_id).filter(Boolean))]

        // Por nombre y por library_id: el enlace es la unión fiable, pero un
        // ejercicio enlazado puede seguir guardado con el nombre que tecleó
        // quien lo creó, así que hacen falta las dos vías.
        const LIB_COLS = 'id, name, muscle_group, secondary_muscles'
        const [byName, byId] = await Promise.all([
          names.length
            ? supabase.from('exercises_library').select(LIB_COLS).in('name', names)
            : { data: [] },
          libIds.length
            ? supabase.from('exercises_library').select(LIB_COLS).in('id', libIds)
            : { data: [] },
        ])
        const { lookup } = indexLibrary([...(byName.data || []), ...(byId.data || [])])

        const byGroup = {}
        list.forEach(w => {
          ;(w.workout_exercises || []).forEach(we => {
            const vol = calcVolume((we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' })))
            if (vol === 0) return
            attributeSplit(vol, resolveMuscles(we.exercises, lookup(we.exercises)), byGroup)
          })
        })
        const muscleBalance = Object.entries(byGroup)
          .map(([group, e]) => ({
            group,
            volume: Math.round(totalOf(e)),
            direct: Math.round(e.direct),
            indirect: Math.round(e.indirect),
          }))
          .sort((a, b) => b.volume - a.volume)

        return { totals, volumeByMonth, allLifts, muscleBalance }
      }
    }
  }, [ownerId])

  const { data, loading, error: loadError, refetch } = useCachedResource(key, fetcher)
  const error = loadError ? (loadError.message || 'Error inesperado') : null

  return { data: data ?? null, loading, error, refetch }
}
