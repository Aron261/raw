import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calc1RM, calcVolume } from './useWorkout'

// Pure feed builder — separated from the fetch so it can be tested without a
// database. Given finished workouts (any order) and a clientId→name map,
// returns feed items newest-first with volume and a PR flag. PRs are per
// client, keyed by canonical exercise (library_id), computed oldest→newest so
// "best so far" is honest.
export function buildCoachFeed(workouts, nameById = {}) {
  const prIds = new Set()
  const best = {}
  const chrono = [...workouts].sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
  for (const w of chrono) {
    let isPR = false
    for (const we of w.workout_exercises || []) {
      const exKey = we.exercises?.library_id || we.exercises?.id
      if (!exKey) continue
      const bk = `${w.user_id}:${exKey}`
      for (const s of we.sets || []) {
        const rm = calc1RM(s.weight, s.reps)
        if (rm > 0 && rm > (best[bk] || 0)) { best[bk] = rm; isPR = true }
      }
    }
    if (isPR) prIds.add(w.id)
  }
  return [...workouts]
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .map(w => {
      const allSets = (w.workout_exercises || []).flatMap(we => (we.sets || []).map(s => ({ ...s, unit: we.unit })))
      return {
        workoutId: w.id,
        clientId: w.user_id,
        clientName: nameById[w.user_id] || 'Cliente',
        name: w.name,
        startedAt: w.started_at,
        exerciseCount: (w.workout_exercises || []).length,
        volume: Math.round(calcVolume(allSets)),
        isPR: prIds.has(w.id),
      }
    })
}

// useCoachFeed(clients) — a chronological feed of what a trainer's clients have
// been doing: their finished workouts, newest first, each with volume and a PR
// flag. Trainers can read client workouts/sets via RLS (is_active_trainer_of),
// so no server changes are needed.
//
// PRs are computed per client across their whole history and keyed by the
// canonical exercise (library_id), so a beaten best counts whether the client
// logged it as "Bench Press" or "Press de banca".
export function useCoachFeed(clients) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Stable dependency: the sorted set of client ids.
  const clientKey = (clients || []).map(c => c.clientId).sort().join(',')

  const nameById = Object.fromEntries((clients || []).map(c => [c.clientId, c.profile?.name || 'Cliente']))

  const load = useCallback(async () => {
    const ids = clientKey ? clientKey.split(',') : []
    if (ids.length === 0) { setFeed([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('workouts')
        .select('id, name, user_id, started_at, ended_at, workout_exercises(unit, exercises(id, library_id), sets(reps, weight))')
        .in('user_id', ids)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(200)
      if (err) throw err
      setFeed(buildCoachFeed(data || [], nameById))
    } catch (e) {
      console.error('Error fetching coach feed:', e)
      setError(e.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientKey])

  useEffect(() => { load() }, [load])

  return { feed, loading, error, refresh: load }
}
