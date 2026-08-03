import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { CATCH_ALL } from '../lib/muscleGroups'
import { VOLUME_TARGETS } from '../lib/engine/volume'
import { attributeSplit, totalOf, roundHalf, resolveMuscles } from '../lib/volumeAttribution'
import { useLang } from '../hooks/useLang'
import { useExerciseLang } from '../hooks/useExerciseLang'

// Distribution of the active cycle by muscle group, measured in weekly working
// sets — sum of each exercise's target `sets` across all days (sets on two days
// add up). Each set counts whole for the exercise's main muscle and half for
// every secondary one, so the columns add up to more than the sets actually
// programmed: this measures stimulus received, not how the work was labelled.
// Classification precedence: the user's own exercises.muscle_group →
// exercises_library → catch-all; secondaries only ever come from the library.
export default function CycleMuscleDistribution({ routine }) {
  const { t, locale } = useLang()
  const { term } = useExerciseLang()
  const { user } = useAuth()
  const { profile } = useProfile()
  const [musclesByName, setMusclesByName] = useState(null)

  const level = profile?.level || 'Intermedio'

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
      if (!user?.id || names.length === 0) { setMusclesByName({}); return }
      const { data: lib } = await supabase
        .from('exercises_library')
        .select('name, muscle_group, secondary_muscles').in('name', names)
      const libByName = {}
      ;(lib || []).forEach(e => { libByName[e.name] = e })
      // User's own classification overrides the library's main group; the
      // secondaries still come from the library, which is the only place that
      // knows them.
      const { data: own } = await supabase
        .from('exercises').select('name, muscle_group').eq('user_id', user.id).in('name', names)
      const ownByName = {}
      ;(own || []).forEach(e => { ownByName[e.name] = e })

      const map = {}
      for (const n of names) map[n] = resolveMuscles(ownByName[n], libByName[n])
      if (!cancelled) setMusclesByName(map)
    }
    run()
    return () => { cancelled = true }
  }, [user?.id, names])

  const dist = useMemo(() => {
    if (!musclesByName) return null
    const acc = {}
    ;(routine?.routine_days || []).forEach(d =>
      (d.routine_day_exercises || []).forEach(e => {
        const n = e.exercise_name?.trim()
        if (!n) return
        attributeSplit(e.sets || 0, musclesByName[n] || { group: CATCH_ALL }, acc)
      })
    )
    return Object.entries(acc)
      .map(([group, entry]) => {
        const [mev, mav] = VOLUME_TARGETS[group]?.[level] ?? []
        return {
          group,
          direct: roundHalf(entry.direct),
          indirect: roundHalf(entry.indirect),
          total: roundHalf(totalOf(entry)),
          mev, mav,
        }
      })
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [musclesByName, routine, level])

  if (!dist) return null

  const known = dist.filter(d => d.group !== CATCH_ALL)
  const other = dist.find(d => d.group === CATCH_ALL)
  const ordered = other ? [...known, other] : known
  // Fallback scale for rows with no target of their own ("Otros"): the biggest
  // group, as before.
  const maxTotal = Math.max(...dist.map(d => d.total), 1)
  const anyTarget = ordered.some(d => d.mav)
  const num = (n) => n.toLocaleString(locale, { maximumFractionDigits: 1 })

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
      borderRadius: 'var(--r-md)',
      padding: '16px',
      marginTop: '8px',
    }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '4px' }}>
        {t('Series por semana')}
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.45, marginBottom: '14px' }}>
        {t('Series semanales por grupo muscular en este ciclo.')}
      </p>

      {ordered.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, padding: '4px 0' }}>
          {t('Define las series de cada ejercicio en el editor para ver el reparto.')}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {ordered.map(d => (
              <GroupBar key={d.group} d={d} maxTotal={maxTotal} t={t} term={term} num={num} />
            ))}
          </div>

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--c-border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, lineHeight: 1.45 }}>
              {t('Cada serie cuenta entera para el músculo principal del ejercicio y media para cada músculo secundario.')}
            </p>
            {anyTarget && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, lineHeight: 1.45 }}>
                {t('Las marcas de cada barra son el mínimo y el objetivo semanal para tu nivel; cada grupo se mide contra el suyo, no contra los demás.')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// One group's bar: solid = sets where this muscle was the main one, faded =
// sets it received as a secondary. The track spans max(target, actual), so the
// MAV tick lands on the right edge until you go past it — and once you do, it
// slides inward and the overshoot is visible.
function GroupBar({ d, maxTotal, t, term, num }) {
  const isOther = d.group === CATCH_ALL
  const scale = d.mav ? Math.max(d.mav, d.total) : maxTotal
  const pct = (v) => `${Math.min(100, (v / scale) * 100)}%`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
        <span style={{ color: isOther ? 'var(--c-text-muted)' : 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {term(d.group)}
        </span>
        <span style={{ flexShrink: 0, color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700 }}>
          {num(d.total)} {d.total === 1 ? t('serie') : t('series')}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: pct(d.direct),
            background: isOther ? 'var(--c-border)' : 'var(--c-action)',
            transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
          <div style={{
            width: pct(d.indirect),
            background: isOther ? 'var(--c-border)' : 'var(--c-action)',
            opacity: 0.35,
            transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
        {d.mev != null && <Tick left={pct(d.mev)} />}
        {d.mav != null && <Tick left={pct(d.mav)} />}
      </div>

      {(d.indirect > 0 || d.mav) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500 }}>
            {d.indirect > 0 && `${num(d.direct)} ${t('directas')} + ${num(d.indirect)} ${t('indirectas')}`}
          </span>
          {d.mav && (
            <span style={{ flexShrink: 0, color: 'var(--c-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500 }}>
              {t('objetivo')} {num(d.mev)}–{num(d.mav)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// La marca sobresale por arriba y por abajo de la barra a propósito: dentro de
// la pista tendría que contrastar a la vez contra el hueco y contra el relleno,
// que son opuestos y cambian con el tema. Sobresaliendo se apoya en el fondo de
// la tarjeta y se ve siempre.
function Tick({ left }) {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', top: '-3px', bottom: '-3px', left,
      width: '2px', marginLeft: '-1px', borderRadius: '1px',
      background: 'var(--c-text-dim)', opacity: 0.55,
    }} />
  )
}
