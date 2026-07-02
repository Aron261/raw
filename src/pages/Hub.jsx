import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useProfile } from '../hooks/useProfile'
import { useWorkouts } from '../hooks/useWorkout'
import { useNutritionDay, useNutritionTargets, toLocalISODate, DEFAULT_TARGETS } from '../hooks/useNutrition'
import { useSupplements } from '../hooks/useSupplements'
import { useUnreadCounts } from '../hooks/useUnreadCounts'

// ── Date helpers ─────────────────────────────────────────────────────────
function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const dateStr = (() => {
  const s = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
})()

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ── Section row ──────────────────────────────────────────────────────────
// El menú es un índice de póster: nombre de sección en display, un dato real
// debajo, hairline entre filas. Sin tarjetas — la tipografía es la estructura.
function SectionRow({ title, sub, subTone = 'muted', live = false, to, soon = false, index, onNavigate }) {
  const subColor = {
    muted:  'var(--c-text-muted)',
    strong: 'var(--c-text-dim)',
    action: 'var(--c-action-text)',
  }[subTone]

  return (
    <button
      onClick={() => onNavigate(to)}
      className="stagger-item"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        width: '100%', textAlign: 'left',
        padding: '22px 0',
        background: 'transparent',
        border: 'none',
        borderTop: index === 0 ? 'none' : '1px solid var(--c-border-subtle)',
        cursor: 'pointer',
        animationDelay: `${index * 45}ms`,
        transition: 'opacity 150ms var(--ease-out)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          className="font-display"
          style={{
            display: 'block',
            fontSize: '36px', lineHeight: 0.95,
            color: soon ? 'var(--c-text-ghost)' : 'var(--c-text)',
          }}
        >
          {title}
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          marginTop: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.03em',
          color: subColor,
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
      <span aria-hidden="true" style={{ color: 'var(--c-text-ghost)', fontSize: '20px', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
        →
      </span>
    </button>
  )
}

// ── Hub ──────────────────────────────────────────────────────────────────
export default function Hub() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const firstName = profile?.name?.split(' ')[0] || ''
  const isTrainer = !!profile?.is_trainer

  // Datos de un vistazo por sección — todos cacheados (SWR), carga silenciosa.
  const { workouts, loading: workoutsLoading } = useWorkouts()
  const { totals } = useNutritionDay(toLocalISODate())
  const { targets } = useNutritionTargets()
  const { active: activeSupps, takenCount } = useSupplements()
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

  const longevitySub = activeSupps.length > 0
    ? `${takenCount}/${activeSupps.length} suplementos hoy`
    : 'Arma tu stack'

  const coachSub = unread > 0
    ? `${unread} ${unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`
    : 'Tus clientes'

  const rows = [
    { title: 'Entreno',    sub: trainingSub,  to: '/training',  live: !!activeWorkout, subTone: activeWorkout ? 'action' : 'muted' },
    { title: 'Nutrición',  sub: nutritionSub, to: '/nutrition' },
    { title: 'Longevidad', sub: longevitySub, to: '/longevity' },
    ...(isTrainer ? [{ title: 'Coach', sub: coachSub, to: '/coach', subTone: unread > 0 ? 'action' : 'muted' }] : []),
    { title: 'Social',     sub: 'Próximamente', to: '/social', soon: true },
  ]

  return (
    <Layout showProfile>
      <div className="w-full px-5 pt-10 pb-10 max-w-[480px] mx-auto md:max-w-[640px] md:px-8 md:py-12">

        {/* ── Header ── */}
        <div className="fade-in" style={{ marginBottom: '28px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-data)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {dateStr}
          </p>
          <h1 className="pr-12 md:pr-0" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
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
