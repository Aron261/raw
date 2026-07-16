import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useWorkouts } from '../hooks/useWorkout'
import { useNutritionDay, useNutritionTargets, toLocalISODate, DEFAULT_TARGETS } from '../hooks/useNutrition'
import { useUnreadCounts } from '../hooks/useUnreadCounts'

// ── Date helpers ─────────────────────────────────────────────────────────
function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Section row ──────────────────────────────────────────────────────────
// El menú es un índice de póster: nombre de sección en display, un dato real
// debajo, hairline entre filas. Sin tarjetas — la tipografía es la estructura.
function SectionRow({ title, sub, subTone = 'muted', live = false, to, soon = false, kind, initial, index, onNavigate }) {
  const subColor = {
    muted:  'var(--c-text-muted)',
    strong: 'var(--c-text-dim)',
    action: 'var(--c-action-text)',
  }[subTone]

  const isProfile = kind === 'profile'

  return (
    <button
      onClick={() => onNavigate(to)}
      className="stagger-item hub-row"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        width: '100%', textAlign: 'left',
        // Profile sits apart from the content sections: a touch of extra top
        // room so it reads as the account footer of the index, not a 6th world.
        padding: isProfile ? '26px 0 22px' : '22px 0',
        background: 'transparent',
        border: 'none',
        borderTop: index === 0 ? 'none' : '1px solid var(--c-border-subtle)',
        marginTop: isProfile ? '6px' : 0,
        cursor: 'pointer',
        animationDelay: `${index * 45}ms`,
        transition: 'opacity 150ms var(--ease-out)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {isProfile && (
          <span
            aria-hidden="true"
            style={{
              width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
              color: 'var(--c-action-text)', fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em',
            }}
          >
            {initial}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <span
            className={isProfile ? undefined : 'font-display text-[36px] md:text-[46px]'}
            style={{
              display: 'block',
              // Profile uses the sans page-title voice (sentence case), not the
              // Anton poster shout — it's a utility, not a content section.
              fontFamily: isProfile ? 'var(--font-sans)' : undefined,
              fontSize: isProfile ? '24px' : undefined,
              fontWeight: isProfile ? 900 : undefined,
              letterSpacing: isProfile ? '-0.03em' : undefined,
              lineHeight: 0.95,
              color: soon ? 'var(--c-text-ghost)' : 'var(--c-text)',
            }}
          >
            {title}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            marginTop: isProfile ? '4px' : '8px',
            maxWidth: '100%',
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.03em',
            color: subColor,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {live && (
              <span
                className="live-dot"
                aria-hidden="true"
                style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--c-action)', flexShrink: 0,
                }}
              />
            )}
            {sub}
          </span>
        </div>
      </div>
      <span aria-hidden="true" className="hub-arrow" style={{ color: 'var(--c-text-ghost)', fontSize: '20px', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
        →
      </span>
    </button>
  )
}

// ── Hub ──────────────────────────────────────────────────────────────────
export default function Hub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const isTrainer = !!profile?.is_trainer

  // Datos de un vistazo por sección — todos cacheados (SWR), carga silenciosa.
  const { workouts, loading: workoutsLoading } = useWorkouts()
  const { totals } = useNutritionDay(toLocalISODate())
  const { targets } = useNutritionTargets()
  const { counts: unreadMap } = useUnreadCounts()

  const activeWorkout = useMemo(() => workouts.find(w => !w.ended_at) || null, [workouts])

  const weekCount = useMemo(() => {
    const monday = getMondayOfWeek()
    return workouts.filter(w => w.ended_at && new Date(w.started_at) >= monday).length
  }, [workouts])

  const unread = useMemo(
    () => Object.values(unreadMap || {}).reduce((a, b) => a + b, 0),
    [unreadMap]
  )

  const kcalTarget = targets?.kcal || DEFAULT_TARGETS.kcal
  const kcalToday = Math.round(totals.kcal)

  // Sub-líneas: un dato honesto por sección, nunca relleno.
  const trainingSub = activeWorkout
    ? 'Entreno en curso'
    : workoutsLoading
      ? '···'
      : weekCount === 0
        ? 'Sin entrenos esta semana'
        : `${weekCount} ${weekCount === 1 ? 'entreno' : 'entrenos'} esta semana`

  const nutritionSub = kcalToday > 0
    ? `${kcalToday.toLocaleString('es-CO')} / ${kcalTarget.toLocaleString('es-CO')} kcal hoy`
    : 'Registra tu primera comida'

  const coachSub = unread > 0
    ? `${unread} ${unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`
    : 'Tus clientes'

  const profileSub = profile?.name || user?.email || 'Ajustes y cuenta'

  const rows = [
    { title: 'Entreno',    sub: trainingSub,  to: '/',  live: !!activeWorkout, subTone: activeWorkout ? 'action' : 'muted' },
    { title: 'Nutrición',  sub: nutritionSub, to: '/nutrition' },
    ...(isTrainer ? [{ title: 'Coach', sub: coachSub, to: '/coach', subTone: unread > 0 ? 'action' : 'muted' }] : []),
    { title: 'Perfil',     sub: profileSub, to: '/profile', kind: 'profile', initial: (profile?.name || user?.email || '?').charAt(0).toUpperCase() },
  ]

  return (
    <Layout>
      <div className="w-full px-5 pt-10 pb-10 max-w-[480px] mx-auto md:max-w-[640px] md:px-8 md:py-12">

        {/* ── Header — el saludo y la fecha viven en Hoy, la portada. Aquí solo
            hace falta decir dónde estás: esto es un índice, no un recibimiento. ── */}
        <div className="fade-in" style={{ marginBottom: '28px' }}>
          <h1 className="text-[30px] md:text-[36px]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            Menú
          </h1>
        </div>

        {/* ── Índice de secciones ── */}
        <nav aria-label="Secciones">
          {rows.map((row, i) => (
            <SectionRow key={row.title} {...row} index={i} onNavigate={navigate} />
          ))}
        </nav>

      </div>
    </Layout>
  )
}
