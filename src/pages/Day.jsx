import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader, ErrorRetry } from '../components/ui'
import DayView from '../components/calendar/DayView'
import { useWorkouts } from '../hooks/useWorkout'
import { useSchedule } from '../hooks/useSchedule'
import { useRoutines } from '../hooks/useRoutines'
import { projectionByDate } from '../lib/schedule'
import { toLocalISODate, longDate } from '../lib/calendar'
import { useLang } from '../hooks/useLang'

// ── /dia/:fecha ──────────────────────────────────────────────────────────
// Un día, a pantalla completa.
//
// Esto era una bottom sheet y se quedó pequeña en cuanto el día pasó a
// significar tres cosas —entreno, comida y peso— en vez de una. Como pantalla
// gana lo que una hoja no puede dar: URL propia (se comparte y se vuelve con
// el botón atrás), sitio para editar en vez de solo mirar, y flechas para
// pasar de día sin volver a la rejilla.
//
// Lo que NO cambia: el calendario sigue dentro de Inicio y no es una pestaña.
// Raw es rotacional —el ciclo avanza cuando registras un entreno, no cuando
// llega el martes—, y una app organizada alrededor de fechas convierte los
// días vacíos en reproches. Esa indulgencia es una propiedad, no un descuido.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

const shiftISO = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

const navBtn = {
  width: '40px', height: '40px', borderRadius: 'var(--r-sm)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
  color: 'var(--c-text-dim)', fontSize: '16px', lineHeight: 1,
}

export default function Day() {
  const { fecha } = useParams()
  const navigate = useNavigate()
  const { t, locale } = useLang()

  const todayISO = toLocalISODate()
  // Una fecha inventada en la URL no puede reventar la pantalla: cae en hoy.
  const iso = ISO_RE.test(fecha || '') ? fecha : todayISO
  const date = useMemo(() => new Date(`${iso}T00:00:00`), [iso])

  const { workouts, loading, error, fetchWorkouts } = useWorkouts()
  const { sessions, createSession, updateSession, deleteSession, deleteSeries } = useSchedule()
  const { routines, activeRoutine } = useRoutines()

  const activeCycle = (activeRoutine?.type === 'cycle' && activeRoutine?.is_active === true)
    ? activeRoutine : null

  const projection = useMemo(
    () => projectionByDate({ activeCycle, workouts, sessions }),
    [activeCycle, workouts, sessions]
  )

  const dayWorkouts = useMemo(
    () => workouts.filter(w => w.ended_at && toLocalISODate(new Date(w.started_at)) === iso),
    [workouts, iso]
  )
  const daySessions = useMemo(() => sessions.filter(s => s.date === iso), [sessions, iso])

  const go = (delta) => navigate(`/dia/${shiftISO(iso, delta)}`, { replace: true })

  // Solo se dice algo cuando añade: «Hoy», «Ayer», «Mañana», o el año cuando
  // no es este. Un subtítulo que pone «2026» estando en 2026 es ruido — el
  // título ya lleva el día y el mes.
  const year = iso.slice(0, 4)
  const relative =
    iso === todayISO ? t('Hoy')
    : iso === shiftISO(todayISO, -1) ? t('Ayer')
    : iso === shiftISO(todayISO, 1) ? t('Mañana')
    : year !== todayISO.slice(0, 4) ? year
    : null

  return (
    <Layout>
      <div className="fade-in px-4 max-w-lg mx-auto w-full">
        <PageHeader
          title={longDate(date, locale)}
          sub={relative}
          backTo="/"
          right={
            // Chevrones, no flechas: la ← de esta misma fila es «volver», y
            // dos ← idénticos a dos dedos de distancia, haciendo cosas
            // distintas, son una trampa.
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => go(-1)} aria-label={t('Día anterior')} style={navBtn}>‹</button>
              <button onClick={() => go(1)} aria-label={t('Día siguiente')} style={navBtn}>›</button>
            </div>
          }
        />

        {/* Volver a hoy sin contar días hacia atrás con la flecha. */}
        {iso !== todayISO && (
          <button
            onClick={() => navigate(`/dia/${todayISO}`, { replace: true })}
            style={{
              marginBottom: '16px', fontFamily: 'var(--font-sans)', fontSize: '11.5px',
              fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-action-text)',
              background: 'transparent', minHeight: '32px',
            }}
          >
            {t('Ir a hoy')}
          </button>
        )}

        {error && <ErrorRetry message={error} onRetry={fetchWorkouts} />}

        {!error && (
          <div className="pb-8">
            <DayView
              date={date}
              workouts={dayWorkouts}
              sessions={daySessions}
              routines={routines}
              ghost={projection[iso] || null}
              onCreate={createSession}
              onUpdate={updateSession}
              onDelete={deleteSession}
              onDeleteSeries={deleteSeries}
            />
          </div>
        )}
      </div>
    </Layout>
  )
}
