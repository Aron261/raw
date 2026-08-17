import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui'
import Calendar from '../components/calendar/Calendar'
import { useWorkouts } from '../hooks/useWorkout'
import { useSchedule } from '../hooks/useSchedule'
import { useRoutines } from '../hooks/useRoutines'
import { usePlan } from '../hooks/usePlan'
import { useLang } from '../hooks/useLang'
import { projectionByDate } from '../lib/schedule'
import { toLocalISODate, KINDS } from '../lib/calendar'

// Calendario — sección propia.
//
// Vivía al fondo de Inicio, primero desplegado y ocupando una pantalla entera,
// después plegado detrás de un botón. Plegarlo alivió la portada pero dejó la
// rareza intacta: era la única superficie grande de la app sin casa, escondida
// dentro de otra pantalla.
//
// Ahora es una sección como Longevidad — se entra desde el chip de Inicio y se
// vuelve con la cabecera. Lo que NO cambia es que sigue sin ser pestaña de la
// barra: Raw es rotacional (el ciclo avanza cuando registras un entreno, no
// cuando llega el martes) y hacer del calendario la espina dorsal invertiría esa
// propiedad, convirtiendo los días vacíos en huecos que te miran mal. Planear
// es tarea de sofá: merece su sitio, no el primer plano.
export default function Calendario() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { workouts } = useWorkouts()
  const { sessions } = useSchedule()
  const { activeRoutine, routines } = useRoutines()
  const { isPro } = usePlan()

  const openDay = (d) => navigate(`/dia/${toLocalISODate(d)}`)

  const activeCycle = (activeRoutine?.type === 'cycle' && activeRoutine?.is_active === true)
    ? activeRoutine : null

  // La previsión del ciclo sobre los días que de verdad se entrenan. No se
  // guarda nada: son fantasmas en la rejilla hasta que los fijas. Es Pro.
  const projection = useMemo(
    () => (isPro ? projectionByDate({ activeCycle, workouts, sessions }) : {}),
    [isPro, activeCycle, workouts, sessions]
  )

  const todayISO = toLocalISODate()
  const nextPlanned = useMemo(
    () => sessions
      .filter(s => s.date >= todayISO && s.status === 'planned')
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null,
    [sessions, todayISO]
  )
  const nextGhost = useMemo(() => {
    const dates = Object.keys(projection).sort()
    const iso = dates.find(d => !nextPlanned || d < nextPlanned.date)
    return iso ? projection[iso] : null
  }, [projection, nextPlanned])

  const proximo = nextPlanned
    ? (nextPlanned.title || t(KINDS[nextPlanned.kind]?.label || 'Fuerza'))
    : nextGhost ? (nextGhost.day?.day_name || t('Fuerza'))
    : null

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        <PageHeader
          title={t('Calendario')}
          sub={proximo
            ? `${t('Próximo')}: ${proximo}`
            : t('Toca un día para planear')}
        />

        <Calendar
          workouts={workouts}
          sessions={sessions}
          routines={routines}
          projection={projection}
          onSelectDay={openDay}
        />

        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 500, lineHeight: 1.5, marginTop: '14px', paddingBottom: '32px' }}>
          {t('Lo punteado es lo que le toca al ciclo si sigues a tu ritmo. No está guardado: toca un día para fijarlo.')}
        </p>
      </div>
    </Layout>
  )
}
