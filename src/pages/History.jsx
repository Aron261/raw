import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { LiveRegion, UndoSnackbar } from '../components/ui'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useLang } from '../hooks/useLang'
import { formatVolume } from '../lib/format'
import { useWorkouts, calc1RMKg, calcVolume } from '../hooks/useWorkout'
import { useSchedule } from '../hooks/useSchedule'
import { isLoggable } from '../lib/schedule'
import SessionCard from '../components/SessionCard'


// Standalone page by default; `embedded` renders just the content (no Layout,
// no page title) for composition inside Progreso.
export default function History({ embedded = false }) {
  const navigate = useNavigate()
  const { t, locale } = useLang()
  const { workouts, loading, error, fetchWorkouts, deleteWorkout, duplicateWorkout } = useWorkouts()

  // Undoable delete (shared primitive) — hide optimistically, commit after a
  // grace window, announce to screen readers.
  const workoutDelete = useUndoableDelete(w => deleteWorkout(w.id))
  const visibleWorkouts = workouts.filter(w => w.id !== workoutDelete.pending?.id)

  // Cardio y movilidad REGISTRADOS. Un plan sin cumplir no es historial.
  const { sessions } = useSchedule()
  const loggedSessions = useMemo(
    () => sessions.filter(s => s.status === 'done' && isLoggable(s.kind)),
    [sessions]
  )

  // Workout ids that set an all-time PR — a set whose estimated 1RM beat the
  // running best for that exercise. Walk oldest → newest so "best so far" is true.
  const prWorkoutIds = useMemo(() => {
    const ids = new Set()
    const best = {}
    const chrono = [...workouts]
      .filter(w => w.ended_at)
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    for (const w of chrono) {
      let isPR = false
      for (const we of w.workout_exercises || []) {
        const name = we.exercises?.name
        if (!name) continue
        for (const s of we.sets || []) {
          // En kilos: sin normalizar, cambiar el toggle a lb regalaba una
          // insignia de PR (100 lb > 90 "kg") o escondía una real.
          const rm = calc1RMKg(s.weight, s.reps, we.unit)
          if (rm > 0 && rm > (best[name] || 0)) { best[name] = rm; isPR = true }
        }
      }
      if (isPR) ids.add(w.id)
    }
    return ids
  }, [workouts])

  // Group by month (Spanish, capitalized) + per-month session count and volume.
  //
  // El historial dejó de ser solo de fuerza: el cardio y la movilidad
  // registrados se intercalan por fecha entre los entrenos. Antes no aparecían
  // en ninguna pantalla — se hacían, se marcaban, y desaparecían. La cuenta y
  // el volumen de la cabecera siguen siendo de los entrenos (una salida en
  // bici no levanta kilos); los minutos se dicen aparte.
  const months = useMemo(() => {
    const acc = {}
    const bucket = (d) => {
      const raw = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      const key = raw.charAt(0).toUpperCase() + raw.slice(1)
      if (!acc[key]) acc[key] = { items: [], volume: 0, workouts: 0, minutes: 0 }
      return acc[key]
    }

    for (const w of visibleWorkouts) {
      const m = bucket(new Date(w.started_at))
      m.items.push({ type: 'workout', at: w.started_at, data: w })
      m.workouts++
      const sets = (w.workout_exercises || []).flatMap(we =>
        (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
      )
      m.volume += calcVolume(sets)
    }

    for (const s of loggedSessions) {
      const m = bucket(new Date(`${s.date}T00:00:00`))
      m.items.push({ type: 'session', at: `${s.date}T23:59:59`, data: s })
      m.minutes += s.duration_min || 0
    }

    // Dentro del mes, lo más reciente primero — como ya venían los entrenos.
    for (const m of Object.values(acc)) {
      m.items.sort((a, b) => new Date(b.at) - new Date(a.at))
    }
    return acc
  }, [workouts, loggedSessions, workoutDelete.pending?.id, locale])

  const content = (
    <>
        {/* Header */}
        <div className={embedded ? 'pb-4' : 'pt-10 pb-6'}>
          {!embedded && (
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '30px', letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.02 }}>
              {t('Historial')}
            </h1>
          )}
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', letterSpacing: '-0.01em', marginTop: embedded ? 0 : '6px' }}>
            {visibleWorkouts.length} {visibleWorkouts.length === 1 ? 'entreno registrado' : 'entrenos registrados'}
          </p>
        </div>

        {/* Loading state — foreshadows month header + cards */}
        {loading && (
          <div aria-hidden="true">
            {[...Array(2)].map((_, g) => (
              <div key={g} style={{ marginBottom: '32px' }}>
                <div className="skeleton" style={{ height: '11px', width: '120px', borderRadius: 'var(--r-xs)', marginBottom: '14px' }} />
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '96px', borderRadius: 'var(--r-lg)', opacity: 1 - (g * 2 + i) * 0.12 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)', color: 'var(--c-action-text)', fontSize: '13px', padding: '12px 14px', borderRadius: 'var(--r-md)', marginBottom: '16px' }}>
            <span>{t('No pudimos cargar tu historial.')}</span>
            <button onClick={fetchWorkouts} style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-action-border)', borderRadius: 'var(--r-xs)', padding: '6px 12px', background: 'transparent' }}>
              {t('Reintentar')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visibleWorkouts.length === 0 && (
          <div className="text-center py-16" style={{ border: '1px dashed var(--c-border)', borderRadius: 'var(--r-lg)', padding: '48px 24px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>{t('Sin entrenos aún')}</p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px', lineHeight: 1.5, maxWidth: '30ch', marginInline: 'auto' }}>
              {t('Cada sesión que registres aparece aquí, agrupada por mes.')}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ marginTop: '16px', background: 'var(--c-accent)', color: 'var(--c-on-action)', border: 'none', borderRadius: 'var(--r-md)', padding: '11px 20px', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em' }}
            >
              {t('Empezar un entreno')}
            </button>
          </div>
        )}

        {/* Workouts grouped by month */}
        {!loading && !error && (
          <div className="pb-8">
            {Object.entries(months).map(([month, { items, volume, workouts: count, minutes }]) => (
              <div key={month} className="mb-8">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <h2 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', letterSpacing: '-0.01em' }}>{month}</h2>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '-0.01em', color: 'var(--c-text-muted)' }}>
                    {count} {count === 1 ? 'entreno' : 'entrenos'}
                    {volume > 0 && <> · <span style={{ color: 'var(--c-data)', fontWeight: 700 }}>{formatVolume(volume, locale)} kg</span></>}
                    {minutes > 0 && <> · {minutes} {t('min')}</>}
                  </p>
                </div>
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={item.data.id} className="stagger-item" style={{ '--i': i }}>
                    {item.type === 'workout' ? (
                      <WorkoutCard
                        workout={item.data}
                        onDelete={w => workoutDelete.request(w, {
                          deletedMsg: `Entreno «${w.name}» eliminado. Toca deshacer para recuperarlo.`,
                          restoredMsg: `Entreno «${w.name}» restaurado.`,
                        })}
                        onDuplicate={duplicateWorkout}
                        hasPR={prWorkoutIds.has(item.data.id)}
                      />
                    ) : (
                      <SessionCard
                        session={item.data}
                        onClick={s => navigate(`/dia/${s.date}`)}
                      />
                    )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Feedback compartido: región viva + snackbar de deshacer */}
      <LiveRegion>{workoutDelete.liveMsg}</LiveRegion>
      <UndoSnackbar show={!!workoutDelete.pending} message="Entreno eliminado" onUndo={workoutDelete.undo} />
    </>
  )

  if (embedded) return content

  return (
    <Layout>
      <div className="fade-in px-4 max-w-lg mx-auto w-full">
        {content}
      </div>
    </Layout>
  )
}
