import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { CATCH_ALL } from '../lib/muscleGroups'

// Distribution of the active cycle's exercises by muscle group. Counts each
// planned exercise occurrence across all days (an exercise on two days counts
// twice — it reflects weekly emphasis). Classification precedence: the user's
// own exercises.muscle_group → exercises_library → catch-all.
export default function CycleMuscleDistribution({ routine }) {
  const { user } = useAuth()
  const [groupByName, setGroupByName] = useState(null)

  const names = useMemo(() => {
    const set = new Set()
    ;(routine?.routine_days || []).forEach(d =>
      (d.routine_day_exercises || []).forEach(e => {
        const n = e.exercise_name?.trim()
        if (n) set.add(n)
      })
    )
    return [...set]
  }, [routine])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user?.id || names.length === 0) { setGroupByName({}); return }
      const map = {}
      const { data: lib } = await supabase
        .from('exercises_library').select('name, muscle_group').in('name', names)
      ;(lib || []).forEach(e => { map[e.name] = e.muscle_group })
      // User's own classification overrides the library.
      const { data: own } = await supabase
        .from('exercises').select('name, muscle_group').eq('user_id', user.id).in('name', names)
      ;(own || []).forEach(e => { if (e.muscle_group) map[e.name] = e.muscle_group })
      if (!cancelled) setGroupByName(map)
    }
    run()
    return () => { cancelled = true }
  }, [user?.id, names])

  const dist = useMemo(() => {
    if (!groupByName) return null
    const counts = {}
    ;(routine?.routine_days || []).forEach(d =>
      (d.routine_day_exercises || []).forEach(e => {
        const n = e.exercise_name?.trim()
        if (!n) return
        const g = groupByName[n] || CATCH_ALL
        counts[g] = (counts[g] || 0) + 1
      })
    )
    return Object.entries(counts)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count)
  }, [groupByName, routine])

  if (!dist || dist.length === 0) return null

  const known = dist.filter(d => d.group !== CATCH_ALL)
  const other = dist.find(d => d.group === CATCH_ALL)
  const ordered = other ? [...known, other] : known
  const max = Math.max(...dist.map(d => d.count), 1)

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '14px',
      padding: '16px',
      marginTop: '8px',
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
        Distribución por músculo
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.45, marginBottom: '14px' }}>
        Ejercicios del ciclo por grupo muscular.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ordered.map(d => {
          const isOther = d.group === CATCH_ALL
          return (
            <div key={d.group}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                <span style={{ color: isOther ? 'var(--c-text-muted)' : 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {d.group}
                </span>
                <span style={{ flexShrink: 0, color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>
                  {d.count} {d.count === 1 ? 'ej.' : 'ejs.'}
                </span>
              </div>
              <div style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '7px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: '100%', transformOrigin: 'left center',
                  transform: `scaleX(${Math.max(0.03, d.count / max)})`,
                  background: isOther ? 'var(--c-border)' : 'var(--c-action)',
                  borderRadius: '999px',
                  transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
