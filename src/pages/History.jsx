import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import WorkoutCard from '../components/WorkoutCard'
import { LiveRegion, UndoSnackbar } from '../components/ui'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useLang } from '../hooks/useLang'
import { useWorkouts, calc1RM, calcVolume } from '../hooks/useWorkout'

const fmtVol = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString())

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
          const rm = calc1RM(s.weight, s.reps)
          if (rm > 0 && rm > (best[name] || 0)) { best[name] = rm; isPR = true }
        }
      }
      if (isPR) ids.add(w.id)
    }
    return ids
  }, [workouts])

  // Group by month (Spanish, capitalized) + per-month session count and volume.
  const months = useMemo(() => {
    const acc = {}
    for (const w of visibleWorkouts) {
      const d = new Date(w.started_at)
      const raw = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      const key = raw.charAt(0).toUpperCase() + raw.slice(1)
      if (!acc[key]) acc[key] = { items: [], volume: 0 }
      acc[key].items.push(w)
      const sets = (w.workout_exercises || []).flatMap(we =>
        (we.sets || []).map(s => ({ ...s, unit: we.unit || 'kg' }))
      )
      acc[key].volume += calcVolume(sets)
    }
    return acc
  }, [workouts, workoutDelete.pending?.id])

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
            {Object.entries(months).map(([month, { items, volume }]) => (
              <div key={month} className="mb-8">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <h2 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', letterSpacing: '-0.01em' }}>{month}</h2>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '-0.01em', color: 'var(--c-text-muted)' }}>
                    {items.length} {items.length === 1 ? 'entreno' : 'entrenos'}
                    {volume > 0 && <> · <span style={{ color: 'var(--c-data)', fontWeight: 700 }}>{fmtVol(Math.round(volume))} kg</span></>}
                  </p>
                </div>
                <div className="space-y-3">
                  {items.map((workout, i) => (
                    <div key={workout.id} className="stagger-item" style={{ '--i': i }}>
                    <WorkoutCard
                      workout={workout}
                      onDelete={w => workoutDelete.request(w, {
                        deletedMsg: `Entreno «${w.name}» eliminado. Toca deshacer para recuperarlo.`,
                        restoredMsg: `Entreno «${w.name}» restaurado.`,
                      })}
                      onDuplicate={duplicateWorkout}
                      hasPR={prWorkoutIds.has(workout.id)}
                    />
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
