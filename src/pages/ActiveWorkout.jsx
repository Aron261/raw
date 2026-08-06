import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import Layout from '../components/Layout'
import ExerciseRow from '../components/ExerciseRow'
import ExerciseDeck, { END_KEY } from '../components/ExerciseDeck'
import { useExerciseLang } from '../hooks/useExerciseLang'
import { roundStep, groupLabel, canLinkNext, moveKind } from '../lib/supersets'
import RestTimerSheet from '../components/RestTimerSheet'
import { primeChime } from '../lib/chime'
import { useActiveWorkout, useExercisePR, calc1RM, calcVolume, useOutboxCount } from '../hooks/useWorkout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { hoverColor, ERROR_STYLE, pressable, clampLines } from '../lib/ui'
import { useLang } from '../hooks/useLang'
import { useWorkouts } from '../hooks/useWorkout'
import { Sheet, Button, LiveRegion, UndoSnackbar } from '../components/ui'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useIdleWorkoutReminder } from '../hooks/useIdleWorkoutReminder'
import AddExerciseModal from '../components/AddExerciseModal'

/* ── Workout elapsed timer ───────────────────────────────────────────── */
function WorkoutTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const pad = n => String(n).padStart(2, '0')

  return (
    <span
      style={{
        fontFamily: 'ui-monospace, monospace',
        color: 'var(--c-text-dim)',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {h > 0 && `${pad(h)}:`}{pad(m)}:{pad(s)}
    </span>
  )
}

/* ── Finish Confirm Modal ───────────────────────────────────────────── */
function FinishConfirmModal({ workout, workoutExercises, onConfirm, onCancel }) {
  const { t, locale } = useLang()
  // Calcular duración desde started_at hasta ahora
  const durationLabel = () => {
    if (!workout?.started_at) return '—'
    const diffSecs = Math.floor((Date.now() - new Date(workout.started_at).getTime()) / 1000)
    const h = Math.floor(diffSecs / 3600)
    const m = Math.floor((diffSecs % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const totalSets = workoutExercises.reduce((acc, we) => acc + (we.sets?.length || 0), 0)

  const stats = [
    { label: t('Duración'), value: durationLabel() },
    { label: 'Ejercicios', value: workoutExercises.length },
    { label: t('Series totales'), value: totalSets },
  ]

  return (
    <Sheet title={t('Finalizar entreno')} onClose={onCancel}>
      <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-sm)', padding: '12px 14px', marginBottom: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', lineHeight: 2 }}>
            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', letterSpacing: '-0.01em' }}>
              {s.label}
            </span>
            <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', textAlign: 'center', marginBottom: '16px' }}>
        {t('Esta acción no se puede deshacer.')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" onClick={onConfirm}>{t('Sí, finalizar')}</Button>
        <Button variant="secondary" full size="lg" onClick={onCancel}>{t('Cancelar')}</Button>
      </div>
    </Sheet>
  )
}

/* ── Discard Confirm Modal ──────────────────────────────────────────── */
function DiscardConfirmModal({ onConfirm, onCancel, busy }) {
  const { t, locale } = useLang()
  return (
    <Sheet title="Descartar entreno" onClose={onCancel}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        {t('Se eliminará esta sesión y todo lo que llevas registrado en ella. Esta acción no se puede deshacer.')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" loading={busy} disabled={busy} onClick={onConfirm}>
          {busy ? t('Descartando...') : t('Sí, descartar')}
        </Button>
        <Button variant="secondary" full size="lg" disabled={busy} onClick={onCancel}>
          {t('Seguir entrenando')}
        </Button>
      </div>
    </Sheet>
  )
}

/* ── Delete finished workout modal ──────────────────────────────────── */
function DeleteWorkoutModal({ name, onConfirm, onCancel, busy }) {
  const { t, locale } = useLang()
  return (
    <Sheet title="Eliminar entreno" onClose={onCancel}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        Se eliminará «{name}» de tu historial junto con todas sus series. Esta acción no se puede deshacer.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" loading={busy} disabled={busy} onClick={onConfirm}>
          {busy ? t('Eliminando...') : t('Sí, eliminar')}
        </Button>
        <Button variant="secondary" full size="lg" disabled={busy} onClick={onCancel}>{t('Cancelar')}</Button>
      </div>
    </Sheet>
  )
}


/* ── Exercise history sheet ─────────────────────────────────────────── */
function ExerciseHistorySheet({ exercise, userId, onClose }) {
  const { t, locale } = useLang()
  const { prSets, allTimePR, loading } = useExercisePR(exercise?.name, userId)
  const sessions = [...(prSets || [])].reverse() // most recent first
  const bestRM = allTimePR?.best1RM || 0

  // El récord es UNO, y es de la primera vez que se hizo. Si la cifra se repite
  // en tres sesiones, marcar las tres deja el historial diciendo que hay tres
  // récords: repetir una marca no es volver a conseguirla. Como la lista va de
  // más reciente a más antigua, la primera vez es la última que empata.
  const recordIdx = bestRM > 0
    ? sessions.reduce((found, s, i) => (s.best1RM >= bestRM ? i : found), -1)
    : -1

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return '' }
  }

  return (
    <Sheet title={exercise?.name || 'Historial'} subtitle="Sesiones anteriores" onClose={onClose}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <span className="spinner" style={{ width: '18px', height: '18px' }} />
        </div>
      ) : sessions.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
          {t('Aún no hay sesiones registradas de este ejercicio.')}
        </p>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
          {sessions.map((s, i) => {
            const isBest = i === recordIdx
            return (
              <div key={s.workoutId || i} style={{
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                borderRadius: 'var(--r-md)', padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="mono" style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)' }}>
                    {fmtDate(s.date)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isBest && (
                      <span style={{ background: 'var(--c-record)', color: 'var(--c-record-ink)', fontSize: '9px', fontWeight: 900, letterSpacing: '-0.01em', padding: '2px 6px', borderRadius: '4px' }}>
                        {t('Récord')}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                      <span style={{ color: 'var(--c-data)', fontWeight: 800 }}>~{s.best1RM}</span> 1RM
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(s.sets || []).map((set, j) => (
                    <span key={set.id || j} style={{
                      fontSize: '13px', fontWeight: 800, color: 'var(--c-text)',
                      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
                      borderRadius: 'var(--r-xs)', padding: '4px 8px', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {set.reps}×{set.weight}<span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--c-text-dim)', marginLeft: '2px' }}>{s.unit}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/* ── Session summary (on finish) ────────────────────────────────────── */
function SessionSummary({ workout, workoutExercises, userId, onClose }) {
  const { t, locale } = useLang()
  const [prIds, setPrIds] = useState(null) // Set<exercise_id> beating a prior best; null = loading
  const [prevBests, setPrevBests] = useState({}) // exercise_id → best 1RM before this session

  const allSets = workoutExercises.flatMap(we => (we.sets || []).map(s => ({ ...s, unit: we.unit })))
  const totalVolume = Math.round(calcVolume(allSets))
  const totalSets = allSets.length

  const durationLabel = () => {
    const start = new Date(workout.started_at).getTime()
    const end = workout.ended_at ? new Date(workout.ended_at).getTime() : Date.now()
    const mins = Math.max(0, Math.floor((end - start) / 60000))
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const perExercise = workoutExercises.map(we => {
    const sets = we.sets || []
    const best1RM = sets.reduce((b, s) => Math.max(b, calc1RM(s.weight, s.reps)), 0)
    const topSet = sets.reduce((t, s) => (calc1RM(s.weight, s.reps) > (t ? calc1RM(t.weight, t.reps) : 0) ? s : t), null)
    return { exerciseId: we.exercises?.id, name: we.exercises?.name, unit: we.unit, count: sets.length, best1RM, topSet }
  }).filter(e => e.count > 0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ids = perExercise.map(e => e.exerciseId).filter(Boolean)
      if (!ids.length) { setPrIds(new Set()); return }
      try {
        const { data, error } = await supabase
          .from('sets')
          .select('reps, weight, workout_exercises!inner(exercise_id, workout_id, workouts!inner(user_id))')
          .eq('workout_exercises.workouts.user_id', userId)
          .in('workout_exercises.exercise_id', ids)
        if (error) throw error
        // Best 1RM per exercise from sessions OTHER than this one.
        const prevBest = {}
        for (const row of (data || [])) {
          const we = row.workout_exercises
          if (!we || we.workout_id === workout.id) continue
          const rm = calc1RM(row.weight, row.reps)
          if (rm > (prevBest[we.exercise_id] || 0)) prevBest[we.exercise_id] = rm
        }
        const prs = new Set()
        for (const e of perExercise) {
          const prev = prevBest[e.exerciseId] || 0
          if (e.exerciseId && prev > 0 && e.best1RM > prev) prs.add(e.exerciseId)
        }
        if (!cancelled) { setPrIds(prs); setPrevBests(prevBest) }
      } catch { if (!cancelled) setPrIds(new Set()) }
    }
    run()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const prCount = prIds ? prIds.size : 0

  return (
    <Sheet title={workout.name} subtitle="Entreno completo" onClose={onClose}>
      {/* Hero — volume leads (data voice) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px',
        background: 'var(--c-border-subtle)', border: '1px solid var(--c-border-subtle)',
        borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: '14px',
      }}>
        <SummaryStat value={totalVolume.toLocaleString(locale)} unit="kg" label="Volumen" valueColor="var(--c-data)" />
        <SummaryStat value={durationLabel()} label={t('Duración')} />
        <SummaryStat value={totalSets} label="Series" />
      </div>

      {/* PR line — only when earned */}
      {prCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px',
          background: 'var(--c-record)', color: 'var(--c-record-ink)',
          borderRadius: 'var(--r-sm)', padding: '10px 12px',
        }}>
          <span style={{ fontSize: '14px' }}>🏆</span>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em' }}>
            {prCount} {t(prCount === 1 ? 'récord nuevo' : 'récords nuevos')}
          </span>
        </div>
      )}

      {/* Per-exercise recap — honest comparison vs. the best before today:
          ▲ beat it · = matched it · ▼ fell short. Glyph + label, never color alone. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '38vh', overflowY: 'auto', marginBottom: '16px' }}>
        {perExercise.map((e, i) => {
          const isPR = prIds?.has(e.exerciseId)
          const prev = prevBests[e.exerciseId] || 0
          const delta = prev > 0 && e.best1RM > 0 ? Math.round(e.best1RM - prev) : null
          return (
            <div key={e.exerciseId || i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 2px', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', ...clampLines(2) }}>
                {e.name}
              </span>
              {isPR ? (
                <span style={{ flexShrink: 0, background: 'var(--c-record)', color: 'var(--c-record-ink)', fontSize: '9px', fontWeight: 900, letterSpacing: '-0.01em', padding: '2px 6px', borderRadius: '4px' }}>PR</span>
              ) : delta !== null && (
                <span
                  aria-label={delta > 0 ? `Superaste tu 1RM anterior por ${delta}` : delta === 0 ? t('Igualaste tu 1RM anterior') : `Por debajo de tu 1RM anterior por ${-delta}`}
                  style={{
                    flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                    color: delta > 0 ? 'var(--c-success)' : delta === 0 ? 'var(--c-text-muted)' : 'var(--c-text-dim)',
                  }}
                >
                  {delta > 0 ? `▲ +${delta}` : delta === 0 ? '= igual' : `▼ ${delta}`}
                </span>
              )}
              <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: 'var(--c-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {e.count} ser{e.topSet ? <> · {e.topSet.reps}×{e.topSet.weight}{e.unit}</> : ''}
              </span>
            </div>
          )
        })}
      </div>

      <Button variant="primary" full size="lg" onClick={onClose}>{t('Listo')}</Button>
    </Sheet>
  )
}

function SummaryStat({ value, unit, label, valueColor = 'var(--c-text)' }) {
  return (
    <div style={{ background: 'var(--c-surface)', padding: '14px 8px', textAlign: 'center' }}>
      <p style={{ color: valueColor, fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)', marginLeft: '2px' }}>{unit}</span>}
      </p>
      <p className="mono" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginTop: '6px' }}>
        {label}
      </p>
    </div>
  )
}

/* ── First-run logging primer ───────────────────────────────────────── */
// One-time, dismissable hint that teaches the three logging mechanics in
// Raw's own vocabulary (the green ✓, auto-save, the faded previous value).
// Non-blocking; persists dismissal to localStorage so it shows once.
const LOGGING_PRIMER_KEY = 'raw_onboard_logging'

function LoggingPrimer({ onDismiss }) {
  const { t, locale } = useLang()
  const chip = {
    flexShrink: 0, width: '26px', height: '26px', borderRadius: 'var(--r-xs)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
  const text = { color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.4 }

  return (
    <div className="fade-in" style={{
      position: 'relative',
      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
      borderRadius: 'var(--r-md)', padding: '16px', marginBottom: '12px',
    }}>
      <button
        onClick={onDismiss}
        aria-label="Entendido, no mostrar de nuevo"
        style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--c-text-ghost)', fontSize: '14px', lineHeight: 1, padding: '6px' }}
        {...pressable(0.97, {
          onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-text-dim)' },
          onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-ghost)' },
        })}
      >
        ✕
      </button>

      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '12px' }}>
        {t('Cómo registrar')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {/* ✓ — the real done control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-success)', color: 'var(--c-on-success)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span style={text}>{t('Marca la serie como hecha e inicia el descanso.')}</span>
        </div>

        {/* auto-save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 21h14" /></svg>
          </span>
          <span style={text}>{t('Tus reps y peso se guardan solos al salir del campo.')}</span>
        </div>

        {/* ghost previous value */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...chip, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-ghost)', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700 }}>
            8×
          </span>
          <span style={text}>{t('El número tenue en cada campo es tu última vez.')}</span>
        </div>
      </div>
    </div>
  )
}

/* ── ¿Sigues entrenando? ────────────────────────────────────────────── */
// Sale al volver a la app después de un rato largo con el entreno abierto. No
// cierra nada por su cuenta: la app no sabe si terminaste o si estabas en la
// máquina de al lado, así que pregunta y deja decidir.
function StillTrainingSheet({ awayMs, onKeepTraining, onFinish, onEnableNotifications }) {
  const { t } = useLang()
  const [notifState, setNotifState] = useState(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  )
  const minutes = Math.max(1, Math.round(awayMs / 60000))

  const askNotifications = async () => setNotifState(await onEnableNotifications())

  return (
    <Sheet title={t('¿Sigues entrenando?')} onClose={onKeepTraining}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        {t('Llevas {n} min sin abrir la app y este entreno sigue abierto. El cronómetro no se ha parado.', { n: minutes })}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button variant="primary" full size="lg" onClick={onKeepTraining}>{t('Sigo entrenando')}</Button>
        <Button variant="secondary" full size="lg" onClick={onFinish}>{t('Finalizar entreno')}</Button>
      </div>

      {/* El permiso se pide aquí, no al entrar: ahora ya se ha visto para qué
          sirve. Pedirlo antes es la forma más rápida de que se deniegue. */}
      {notifState === 'default' && (
        <button
          onClick={askNotifications}
          style={{
            width: '100%', marginTop: '12px', padding: '10px', background: 'transparent',
            color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
            border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
          }}
        >
          {t('Avisarme con una notificación la próxima vez')}
        </button>
      )}
      {notifState === 'granted' && (
        <p style={{ marginTop: '12px', textAlign: 'center', color: 'var(--c-success)', fontSize: '11px', fontWeight: 700 }}>
          ✓ {t('La próxima vez te llega una notificación')}
        </p>
      )}
      {notifState === 'denied' && (
        <p style={{ marginTop: '12px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
          {t('Las notificaciones están bloqueadas en este navegador. Este aviso te seguirá saliendo al volver.')}
        </p>
      )}
    </Sheet>
  )
}

/* ── Carta de cierre ────────────────────────────────────────────────── */
// La última parada de la baraja, entre el último ejercicio y el primero otra
// vez. Existe para que dar la vuelta no se sienta como haberse perdido: el
// recorrido es circular, pero pasa por un sitio que dice dónde estás.
//
// No empuja a terminar mientras quede trabajo. Con ejercicios pendientes lo
// primero es volver a ellos —"Finalizar" queda de segunda—; solo cuando no
// queda ninguno el botón de cerrar el entreno pasa al frente.
function EndCard({ workout, exercises, doneExs, onJump, onFinish, onGoFirst, finishing }) {
  const { t, locale } = useLang()
  const { label: exLabel } = useExerciseLang()

  const pending = exercises.filter(we => !doneExs.has(we.id))
  const allDone = exercises.length > 0 && pending.length === 0
  const totalSets = exercises.reduce((acc, we) => acc + (we.sets?.length || 0), 0)

  const durationLabel = () => {
    if (!workout?.started_at) return '—'
    const mins = Math.max(0, Math.floor((Date.now() - new Date(workout.started_at).getTime()) / 60000))
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
      boxShadow: 'var(--e-1)', borderRadius: 'var(--r-xl)', padding: '20px 18px',
    }}>
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
        color: allDone ? 'var(--c-success)' : 'var(--c-text-dim)', marginBottom: '6px',
      }}>
        {t('Fin del recorrido')}
      </p>

      <p style={{ color: 'var(--c-text)', fontSize: '23px', fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
        {allDone
          ? t('Todo hecho')
          : t(pending.length === 1 ? 'Te falta 1 ejercicio' : 'Te faltan {n} ejercicios', { n: pending.length })}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '14px 0 16px' }}>
        <EndStat value={`${exercises.length - pending.length}/${exercises.length}`} label={t('hechos')} />
        <EndStat value={totalSets} label={t('Series totales')} />
        <EndStat value={durationLabel()} label={t('Duración')} />
      </div>

      {/* Lo que queda, por nombre y a un toque. Es la razón de que se pueda dar
          la vuelta sin pasar por todo lo demás. */}
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {pending.map(we => (
            <button
              key={we.id}
              type="button"
              onClick={() => onJump(we.id)}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--c-text-dim)', background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-xs)',
                padding: '6px 10px', cursor: 'pointer', maxWidth: '100%',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {exLabel(we.exercises)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pending.length > 0 ? (
          <>
            <Button variant="primary" full size="lg" onClick={() => onJump(pending[0].id)}>
              {t('Seguir con')} {exLabel(pending[0].exercises)}
            </Button>
            {onFinish && (
              <Button variant="secondary" full size="lg" loading={finishing} disabled={finishing} onClick={onFinish}>
                {t('Finalizar entreno')}
              </Button>
            )}
          </>
        ) : (
          <>
            {onFinish && (
              <Button variant="primary" full size="lg" loading={finishing} disabled={finishing} onClick={onFinish}>
                {t('Finalizar entreno')}
              </Button>
            )}
            {exercises.length > 0 && (
              <Button variant="secondary" full size="lg" onClick={onGoFirst}>
                {t('Volver al primero')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EndStat({ value, label }) {
  return (
    <div>
      <p style={{ color: 'var(--c-text)', fontSize: '17px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginTop: '4px' }}>
        {label}
      </p>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function ActiveWorkout() {
  const { id } = useParams()
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { deleteWorkout } = useWorkouts()
  const online = useOnlineStatus()
  const unsynced = useOutboxCount(id)
  const reduce = useReducedMotion()
  const { label: exLabel } = useExerciseLang()

  const {
    workout, workoutExercises, loading, error, stale,
    updateWorkoutName, finishWorkout,
    addExercise, replaceExercise, updateUnit, updateExerciseNotes, addSet, updateSet, deleteSet, removeExercise, moveExercise,
    linkWithNext, unlinkExercise, renameExercise,
  } = useActiveWorkout(id)

  const [historyExercise, setHistoryExercise] = useState(null)
  const [showSummary, setShowSummary] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [swappingId, setSwappingId] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)

  // Undoable mid-session exercise removal (shared primitive) — hide
  // optimistically + 5s "Deshacer" before the row (and its sets) are dropped.
  const exerciseDelete = useUndoableDelete(we => removeExercise(we.id))
  const [primerDismissed, setPrimerDismissed] = useState(() => {
    try { return localStorage.getItem(LOGGING_PRIMER_KEY) === 'done' } catch { return false }
  })
  const dismissPrimer = () => {
    setPrimerDismissed(true)
    try { localStorage.setItem(LOGGING_PRIMER_KEY, 'done') } catch {}
  }
  // Editing a finished workout used to be a two-step confirmation. Editing is
  // reversible — you can just fix the number back — so the walls cost more than
  // they protected. The banner below states the stakes instead.
  const [isEditing, setIsEditing] = useState(false)
  const nameRef = useRef(null)

  // Per-set completion + finished exercises — persisted locally per workout so
  // progress survives a reload mid-session without touching the database.
  const [doneSets, setDoneSets] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`raw_done_sets_${id}`) || '[]')) } catch { return new Set() }
  })
  const [doneExs, setDoneExs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`raw_done_ex_${id}`) || '[]')) } catch { return new Set() }
  })
  useEffect(() => { try { localStorage.setItem(`raw_done_sets_${id}`, JSON.stringify([...doneSets])) } catch {} }, [doneSets, id])
  useEffect(() => { try { localStorage.setItem(`raw_done_ex_${id}`, JSON.stringify([...doneExs])) } catch {} }, [doneExs, id])

  const toggleSetDone = useCallback((setId, nextDone) => {
    setDoneSets(prev => {
      const next = new Set(prev)
      if (nextDone) next.add(setId); else next.delete(setId)
      return next
    })
  }, [])

  // Rest timer — armed each time a set is marked done. `id` keys the pill so a
  // new set restarts it cleanly; +30 only moves the deadline.
  const [rest, setRest] = useState(null) // { endsAt, total, id } | null
  const startRest = useCallback((seconds) => {
    if (!(seconds > 0)) return
    // El descanso arranca desde un toque (marcar la serie) y ahí es donde iOS
    // permite despertar el audio. Cuando el descanso termina ya no hay gesto
    // ninguno, así que si no se ceba aquí el aviso no llega a sonar.
    primeChime()
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, id: Date.now() })
  }, [])
  const extendRest = useCallback((seconds) => {
    setRest(r => r ? { ...r, endsAt: r.endsAt + seconds * 1000, total: r.total + seconds } : r)
  }, [])
  // Ignore a stale dismissal arriving after a newer rest replaced this one.
  const dismissRest = useCallback((restId) => {
    setRest(r => (r && r.id !== restId ? r : null))
  }, [])

  // Auto-advance en la lista de repaso: al terminar un ejercicio se abre el
  // siguiente que queda, para no tener que buscar dónde ibas. Va por token para
  // que volver a terminar el mismo lo vuelva a disparar. Solo abre — nunca
  // cierra a la fuerza uno que se dejó abierto a propósito.
  const [autoExpand, setAutoExpand] = useState(null) // { id, token } | null

  const isFinished = !!workout?.ended_at

  // Aviso de entreno abierto. Solo mientras esté vivo: en una sesión ya cerrada
  // no hay nada que recordar.
  const idle = useIdleWorkoutReminder({
    workoutId: id,
    active: !!workout && !isFinished,
    title: t('Tu entreno sigue abierto'),
    body: t('¿Sigues entrenando? Toca para volver y cerrarlo si ya terminaste.'),
  })

  // Hide the exercise awaiting an undoable removal.
  const visibleExercises = workoutExercises.filter(we => we.id !== exerciseDelete.pending?.id)

  // ── Baraja ────────────────────────────────────────────────────────────
  // Se usa mientras se entrena (y al editar una sesión ya guardada). En
  // repaso puro manda la lista: ahí el trabajo es escanear, no registrar.
  const deckMode = !isFinished || isEditing

  // La baraja se acuerda de POR QUÉ ejercicio ibas, no de en qué posición.
  // Con un índice, cada ejercicio que se termina (y sale de la baraja) o que se
  // borra corre la lista debajo de los pies y te deja mirando otra carta. Una
  // clave sobrevive a que la lista cambie de forma — y sobrevive a recargar.
  const [rawDeckKey, setRawDeckKey] = useState(() => {
    try { return localStorage.getItem(`raw_deck_at_${id}`) || null } catch { return null }
  })
  useEffect(() => {
    try {
      if (rawDeckKey) localStorage.setItem(`raw_deck_at_${id}`, rawDeckKey)
    } catch {}
  }, [rawDeckKey, id])

  // Una clave guardada puede haber dejado de existir (se borró el ejercicio, o
  // es de otra sesión). Se cae al primero que quede por hacer, y si no queda
  // ninguno, al cierre.
  const currentKey = useMemo(() => {
    if (rawDeckKey === END_KEY) return END_KEY
    if (rawDeckKey && visibleExercises.some(we => we.id === rawDeckKey)) return rawDeckKey
    const firstPending = visibleExercises.find(we => !doneExs.has(we.id))
    return firstPending ? firstPending.id : END_KEY
  }, [rawDeckKey, visibleExercises, doneExs])

  // Un ejercicio terminado sale de la baraja: pasar por cartas ya hechas es
  // justo el trabajo que la baraja tenía que ahorrar. Con una excepción — si es
  // el que estás mirando (lo acabas de cerrar, o lo has abierto desde la
  // regleta) se queda en su sitio hasta que te muevas, para poder verlo y
  // reabrirlo sin buscarlo otra vez.
  const rotation = useMemo(
    () => visibleExercises.filter(we => !doneExs.has(we.id) || we.id === currentKey),
    [visibleExercises, doneExs, currentKey]
  )

  const stops = useMemo(() => ([
    ...rotation.map(we => ({ key: we.id, kind: 'exercise', we })),
    { key: END_KEY, kind: 'end' },
  ]), [rotation])

  // La regleta enseña la sesión entera —hechos incluidos—, no solo lo que
  // queda: es el mapa, y un mapa que borra por dónde has pasado no sirve para
  // volver.
  const rail = useMemo(() => ([
    ...visibleExercises.map(we => ({
      key: we.id,
      kind: 'exercise',
      label: exLabel(we.exercises),
      done: doneExs.has(we.id),
      groupId: we.group_id || null,
    })),
    { key: END_KEY, kind: 'end', label: t('Fin del recorrido'), done: false, groupId: null },
  ]), [visibleExercises, doneExs, exLabel, t])

  // El siguiente que queda por hacer, dando la vuelta por el final. Si no queda
  // ninguno, la carta de cierre.
  const nextPendingAfter = useCallback((weId, doneSet) => {
    const n = visibleExercises.length
    const start = visibleExercises.findIndex(we => we.id === weId)
    for (let k = 1; k <= n; k++) {
      const cand = visibleExercises[(start + k) % n]
      if (cand && cand.id !== weId && !doneSet.has(cand.id)) return cand.id
    }
    return END_KEY
  }, [visibleExercises])

  // ── Superseries ───────────────────────────────────────────────────────
  // No hay carta de superserie: siguen siendo dos ejercicios y dos cartas. Lo
  // que cambia es que la baraja se mueve sola entre ellas, que es lo que se
  // hace de verdad — una serie de uno, una del otro, y vuelta a empezar.
  // Las reglas de la vuelta viven en lib/supersets.
  const isDoneEx = useCallback((we) => doneExs.has(we.id), [doneExs])
  const groupLabelFor = useCallback((we) => groupLabel(visibleExercises, we), [visibleExercises])
  const canLink = useCallback((we) => canLinkNext(visibleExercises, we), [visibleExercises])

  // Marcar una serie como hecha: el descanso y el salto los decide la vuelta.
  const handleSetCompleted = useCallback((seconds, meta) => {
    const we = visibleExercises.find(x => x.id === meta?.workoutExerciseId)
    if (!we) { startRest(seconds); return }
    const { rest, next } = roundStep(visibleExercises, we, isDoneEx)
    if (rest) startRest(seconds)
    if (next) setRawDeckKey(next)
  }, [visibleExercises, isDoneEx, startRest])

  // Terminar un ejercicio lo pliega en su resumen, se queda un momento a la
  // vista —ver que se cerró es parte de haberlo cerrado— y después la baraja
  // pasa sola al siguiente que queda. Si te mueves tú durante esa pausa,
  // mandas tú: el salto se cancela.
  const finishTimer = useRef(null)
  useEffect(() => () => clearTimeout(finishTimer.current), [])

  const toggleExerciseFinish = useCallback((weId, nextFinished) => {
    setDoneExs(prev => {
      const next = new Set(prev)
      if (nextFinished) next.add(weId); else next.delete(weId)
      return next
    })

    if (!nextFinished) {
      // Reabrir: vuelve a la baraja y te deja en él.
      clearTimeout(finishTimer.current)
      setRawDeckKey(weId)
      return
    }

    const after = new Set(doneExs)
    after.add(weId)

    if (deckMode) {
      const target = nextPendingAfter(weId, after)
      clearTimeout(finishTimer.current)
      // Clavar la clave en el que se acaba de cerrar antes de nada. Si se deja
      // sin fijar, la caída de respaldo («el primero que quede por hacer») se
      // adelanta al temporizador y te saca de la carta en el mismo toque: el
      // ejercicio se cierra sin que llegues a verlo cerrado.
      setRawDeckKey(weId)
      finishTimer.current = setTimeout(() => {
        setRawDeckKey(k => (k === weId ? target : k))
      }, reduce ? 0 : 520)
    } else {
      const nextPending = workoutExercises.find(we => we.id !== weId && !after.has(we.id))
      if (nextPending) setAutoExpand({ id: nextPending.id, token: Date.now() })
    }
  }, [doneExs, deckMode, nextPendingAfter, workoutExercises, reduce])

  // ExerciseRow's ··· "Eliminar" routes here for the undo window.
  const requestRemoveExercise = (weId) => {
    const we = workoutExercises.find(w => w.id === weId)
    if (!we) return
    exerciseDelete.request(we, {
      deletedMsg: `«${we.exercises?.name || 'Ejercicio'}» eliminado. Toca deshacer para recuperarlo.`,
      restoredMsg: `«${we.exercises?.name || 'Ejercicio'}» restaurado.`,
    })
  }

  const handleDeleteWorkout = async () => {
    setDeletingWorkout(true)
    try {
      await deleteWorkout(workout.id)
      navigate('/', { replace: true })
    } catch (e) {
      console.error(e)
      setDeletingWorkout(false)
      setShowDeleteConfirm(false)
    }
  }

  useEffect(() => {
    if (workout && workout.name !== nameInput && !editingName) setNameInput(workout.name)
  }, [workout])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  const saveName = async () => {
    if (nameInput.trim() && nameInput.trim() !== workout.name) {
      try { await updateWorkoutName(nameInput.trim()) } catch {}
    }
    setEditingName(false)
  }

  const handleFinish = async () => {
    setShowFinishConfirm(false)
    setFinishError(null)
    setFinishing(true)
    try {
      await finishWorkout()
      // Clear local completion flags for this session — it's logged now.
      try { localStorage.removeItem(`raw_done_sets_${id}`); localStorage.removeItem(`raw_done_ex_${id}`) } catch {}
      idle.clear()
      setFinishing(false)
      setShowSummary(true)
    } catch (err) {
      setFinishError(err.message)
      setFinishing(false)
    }
  }

  const handleDiscard = async () => {
    setDiscarding(true)
    setFinishError(null)
    try {
      await deleteWorkout(workout.id)
      try { localStorage.removeItem(`raw_done_sets_${id}`); localStorage.removeItem(`raw_done_ex_${id}`) } catch {}
      idle.clear()
      navigate('/', { replace: true })
    } catch (err) {
      setFinishError(err.message)
      setDiscarding(false)
      setShowDiscardConfirm(false)
    }
  }

  const handleAddExercise = async (name, muscleGroup = null) => {
    try { await addExercise(name, muscleGroup) } catch (err) { console.error(err) }
  }

  const handleSwapExercise = async (name, muscleGroup = null) => {
    if (!swappingId) return
    try { await replaceExercise(swappingId, name, muscleGroup) } catch (err) { console.error(err) }
    setSwappingId(null)
  }

  // Prefer explicit home navigation over navigate(-1) — safer when arriving via direct URL
  const handleBack = () => navigate('/')

  if (loading) {
    return (
      <Layout hideNav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
          <span className="spinner" style={{ width: '20px', height: '20px' }} />
        </div>
      </Layout>
    )
  }

  if (error || !workout) {
    return (
      <Layout hideNav>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '16px', padding: '24px' }}>
          <p style={{ color: 'var(--c-action-text)', fontSize: '13px' }}>{error || t('Entreno no encontrado.')}</p>
          <Button variant="secondary" onClick={handleBack}>← {t('Atrás')}</Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout hideNav>
      <div className="fade-in" style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', paddingBottom: '16px' }}>
          <button
            onClick={handleBack}
            style={{
              fontFamily: 'var(--font-sans)',
              color: 'var(--c-text-dim)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              transition: `color 150ms var(--ease-out)`,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            {...hoverColor('var(--c-text)', 'var(--c-text-dim)')}
          >
            ← {t('Atrás')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isFinished && workout.started_at && <WorkoutTimer startedAt={workout.started_at} />}
            {isFinished && (
              <span style={{ fontFamily: 'var(--font-sans)', color: isEditing ? 'var(--c-action-text)' : 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {isEditing ? t('Editando') : t('Finalizado')}
              </span>
            )}
          </div>
        </div>

        {/* Editing a logged session — say so plainly and continuously, instead
            of asking twice at the door and then going quiet. */}
        {isFinished && isEditing && (
          <div
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
              borderRadius: 'var(--r-sm)', padding: '8px 12px', marginBottom: '16px',
            }}
          >
            <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--c-action)', flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
              letterSpacing: '-0.01em', color: 'var(--c-action-text)',
            }}>
              {t('Estás editando tu historial — los cambios se guardan solos')}
            </span>
          </div>
        )}

        {/* Sync status — one quiet line. Offline, or online with a backlog
            still draining: say how many sets are waiting. Silent when synced.
            `stale` cubre el caso que no se ve en navigator.onLine: hay red pero
            el servidor no contestó, así que esto es la foto guardada. */}
        {(!online || unsynced > 0 || stale) && (
          <div
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
              borderRadius: 'var(--r-sm)', padding: '8px 12px', marginBottom: '16px',
            }}
          >
            <span
              aria-hidden="true"
              className={online ? 'live-dot' : undefined}
              style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--c-action)', flexShrink: 0 }}
            />
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
              letterSpacing: '-0.01em', color: 'var(--c-action-text)',
            }}>
              {unsynced > 0
                ? `${unsynced} ${t(unsynced === 1 ? 'serie sin sincronizar' : 'series sin sincronizar')}${online ? ` — ${t('sincronizando')}` : ''}`
                : !online
                  ? t('Sin conexión — tus series se guardan y se sincronizan al reconectar')
                  : t('Sin respuesta del servidor — estás viendo lo último guardado')}
            </span>
          </div>
        )}

        {/* Workout name */}
        <div style={{ marginBottom: '20px' }}>
          {editingName ? (
            <input
              aria-label={t('Nombre del entreno')}
              ref={nameRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
              className="input-field"
              style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em' }}
            />
          ) : (
            <button
              onClick={() => (!isFinished || isEditing) && setEditingName(true)}
              style={{
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {workout.name}
              </span>
              {(!isFinished || isEditing) && (
                <span style={{ color: 'var(--c-text-ghost)', fontSize: '12px', marginTop: '2px' }}>✎</span>
              )}
            </button>
          )}
        </div>

        {/* Session progress — exercises finalized */}
        {!isFinished && visibleExercises.length > 0 && (() => {
          const finishedCount = visibleExercises.filter(we => doneExs.has(we.id)).length
          const total = visibleExercises.length
          const pct = Math.round((finishedCount / total) * 100)
          const allDone = finishedCount === total
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '999px', background: 'var(--c-surface-2)', overflow: 'hidden' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '999px',
                  background: 'var(--c-success)',
                  transformOrigin: 'left center',
                  transform: `scaleX(${pct / 100})`,
                  transition: 'transform 320ms var(--ease-out)',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '-0.01em', flexShrink: 0,
                color: allDone ? 'var(--c-success)' : 'var(--c-text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {finishedCount}/{total} {t('hechos')}
              </span>
            </div>
          )
        })()}

        {/* Empty state */}
        {visibleExercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: 'var(--r-md)', marginBottom: '16px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {t('Sin ejercicios aún')}
            </p>
            {!isFinished && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
                {t('Agrega tu primer ejercicio para empezar a registrar tus series.')}
              </p>
            )}
          </div>
        )}

        {/* First-run logging primer — teaches the loop where it happens */}
        {!isFinished && !primerDismissed && visibleExercises.length > 0 && (
          <LoggingPrimer onDismiss={dismissPrimer} />
        )}

        {/* Los ejercicios.
            · Sesión viva (o en edición): baraja — un ejercicio por pantalla.
              Entre serie y serie no estás eligiendo ejercicio, estás haciendo
              uno, y el resto de la lista solo compite por la vista.
            · Sesión terminada, en repaso: la lista de siempre. Ahí el trabajo
              es escanear la sesión entera, y una baraja obliga a pasar seis
              cartas para ver lo que una lista dice de un vistazo. */}
        {/* Sin ejercicios no hay recorrido que dar: el estado vacío de arriba ya
            dice lo único que hay que decir, y una carta de cierre debajo sería
            el final de nada. */}
        {visibleExercises.length === 0 ? null : deckMode ? (
          <div style={{ marginBottom: '8px' }}>
            <ExerciseDeck
              stops={stops}
              rail={rail}
              currentKey={currentKey}
              onCurrentChange={setRawDeckKey}
            >
              {(stop) => {
                if (stop.kind === 'end') {
                  return (
                    <EndCard
                      workout={workout}
                      exercises={visibleExercises}
                      doneExs={doneExs}
                      onJump={setRawDeckKey}
                      onGoFirst={() => setRawDeckKey(visibleExercises[0]?.id || END_KEY)}
                      onFinish={isEditing ? undefined : () => setShowFinishConfirm(true)}
                      finishing={finishing}
                    />
                  )
                }
                const we = stop.we
                return (
                  <ExerciseRow
                    deck
                    workoutExercise={we}
                    workoutId={id}
                    groupLabel={groupLabelFor(we)}
                    onAddSet={addSet}
                    onDeleteSet={deleteSet}
                    onUpdateSet={updateSet}
                    onUpdateUnit={updateUnit}
                    onRemoveExercise={requestRemoveExercise}
                    onSwapExercise={(weId) => setSwappingId(weId)}
                    onUpdateNotes={updateExerciseNotes}
                    completedSetIds={doneSets}
                    onToggleSetDone={toggleSetDone}
                    isExerciseFinished={doneExs.has(we.id)}
                    onToggleFinish={toggleExerciseFinish}
                    onShowHistory={setHistoryExercise}
                    onRestStart={!isFinished ? handleSetCompleted : undefined}
                    onMove={moveExercise}
                    onRenameExercise={renameExercise}
                    onLinkNext={canLink(we) ? linkWithNext : undefined}
                    onUnlinkGroup={we.group_id ? unlinkExercise : undefined}
                    moveUpKind={moveKind(visibleExercises, we.id, 'up')}
                    moveDownKind={moveKind(visibleExercises, we.id, 'down')}
                    readOnly={false}
                  />
                )
              }}
            </ExerciseDeck>
          </div>
        ) : (
          /* Lista de repaso — los terminados se pliegan y suben arriba. */
          <div style={{ marginBottom: '8px' }}>
            {(() => {
              const finished = visibleExercises.filter(we => doneExs.has(we.id))
              const pending  = visibleExercises.filter(we => !doneExs.has(we.id))
              const display  = [...finished, ...pending]
              return display.map((we, i) => {
                const exFinished = doneExs.has(we.id)
                const pIdx = exFinished ? -1 : pending.findIndex(p => p.id === we.id)
                return (
                  <div key={we.id} className="stagger-item" style={{ animationDelay: `${i * 40}ms` }}>
                    <ExerciseRow
                      workoutExercise={we}
                      workoutId={id}
                      onAddSet={addSet}
                      onDeleteSet={deleteSet}
                      onUpdateSet={updateSet}
                      onUpdateUnit={updateUnit}
                      onRemoveExercise={requestRemoveExercise}
                      onSwapExercise={undefined}
                      onUpdateNotes={undefined}
                      completedSetIds={doneSets}
                      onToggleSetDone={toggleSetDone}
                      isExerciseFinished={exFinished}
                      onToggleFinish={toggleExerciseFinish}
                      onShowHistory={setHistoryExercise}
                      onRestStart={undefined}
                      autoExpandToken={autoExpand?.id === we.id ? autoExpand.token : null}
                      onMove={undefined}
                      readOnly
                    />
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* Bottom actions */}
        {(!isFinished || isEditing) && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--c-bg-glass)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              paddingTop: '12px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              borderTop: '1px solid var(--c-surface-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            {/* Error surfaces right where the action that caused it lives */}
            {finishError && (
              <div style={{ ...ERROR_STYLE }}>
                {finishError}
              </div>
            )}
            <Button variant="secondary" full size="lg" onClick={() => setShowAdd(true)}>
              + {t('Agregar ejercicio')}
            </Button>
            {isEditing ? (
              <Button variant="primary" full size="lg" onClick={() => setIsEditing(false)}>
                {t('Guardar y cerrar edición')}
              </Button>
            ) : (
              <Button
                variant="primary"
                full
                size="lg"
                loading={finishing}
                disabled={finishing}
                onClick={() => setShowFinishConfirm(true)}
              >
                {finishing ? t('Finalizando...') : t('Finalizar entreno')}
              </Button>
            )}
            {!isEditing && (
              <button
                onClick={() => setShowDiscardConfirm(true)}
                style={{
                  alignSelf: 'center', marginTop: '2px',
                  color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
                  padding: '6px 12px', background: 'transparent',
                  transition: 'color 150ms var(--ease-out)',
                }}
                {...pressable(0.97, {
                  onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-action-text)' },
                  onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-ghost)' },
                })}
              >
                {t('Descartar entreno')}
              </button>
            )}
          </div>
        )}

        {isFinished && (
          <div style={{ paddingBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="secondary" full size="lg" onClick={handleBack}>
              ← Volver al inicio
            </Button>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  width: '100%', padding: '14px', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em',
                  color: 'var(--c-text-dim)', border: '1px solid var(--c-border-subtle)',
                  borderRadius: 'var(--r-sm)', transition: 'color 150ms, border-color 150ms',
                  background: 'transparent', cursor: 'pointer',
                }}
                {...pressable(0.97, {
                  onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.borderColor = 'var(--c-border)' },
                  onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' },
                })}
              >
                {t('Editar entreno')}
              </button>
            ) : (
              <>
                <Button variant="primary" full size="lg" onClick={() => setIsEditing(false)}>
                  {t('Guardar cambios')}
                </Button>
                <Button variant="secondary" full size="lg" onClick={() => setIsEditing(false)}>
                  {t('Cancelar edición')}
                </Button>
              </>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: '100%', padding: '14px', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--c-text-dim)', border: '1px solid var(--c-border-subtle)',
                borderRadius: 'var(--r-sm)', transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
                background: 'transparent', cursor: 'pointer',
              }}
              {...pressable(0.97, {
                onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-action-text)'; e.currentTarget.style.borderColor = 'var(--c-accent)' },
                onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' },
              })}
            >
              {t('Eliminar este entreno')}
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddExerciseModal
          userId={user?.id}
          onAdd={handleAddExercise}
          onClose={() => setShowAdd(false)}
          closeOnSelect={false}
        />
      )}

      {swappingId && (
        <AddExerciseModal
          userId={user?.id}
          title="Cambiar ejercicio"
          subtitle="Solo cambia en este entreno, tu rutina no se modifica."
          onAdd={handleSwapExercise}
          onClose={() => setSwappingId(null)}
          closeOnSelect={true}
        />
      )}

      {showSummary && (
        <SessionSummary
          workout={workout}
          workoutExercises={workoutExercises}
          userId={user?.id}
          onClose={() => navigate('/', { replace: true })}
        />
      )}

      {historyExercise && (
        <ExerciseHistorySheet
          exercise={historyExercise}
          userId={user?.id}
          onClose={() => setHistoryExercise(null)}
        />
      )}

      {idle.awayMs > 0 && !isFinished && (
        <StillTrainingSheet
          awayMs={idle.awayMs}
          onKeepTraining={idle.dismiss}
          onFinish={() => { idle.dismiss(); setShowFinishConfirm(true) }}
          onEnableNotifications={idle.enableNotifications}
        />
      )}

      {showFinishConfirm && (
        <FinishConfirmModal
          workout={workout}
          workoutExercises={workoutExercises}
          onConfirm={handleFinish}
          onCancel={() => setShowFinishConfirm(false)}
        />
      )}

      {showDiscardConfirm && (
        <DiscardConfirmModal
          busy={discarding}
          onConfirm={handleDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeleteWorkoutModal
          name={workout.name}
          busy={deletingWorkout}
          onConfirm={handleDeleteWorkout}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Rest pill — floats above the sticky actions while resting. Keyed per
          rest so each one mounts fresh; the pill animates its own exit. */}
      {rest && !isFinished && (
        <RestTimerSheet
          key={rest.id}
          restId={rest.id}
          endsAt={rest.endsAt}
          total={rest.total}
          onExtend={extendRest}
          onDismiss={dismissRest}
        />
      )}

      {/* Feedback compartido: región viva + snackbar de deshacer (quitar ejercicio) */}
      <LiveRegion>{exerciseDelete.liveMsg}</LiveRegion>
      <UndoSnackbar show={!!exerciseDelete.pending} message="Ejercicio eliminado" onUndo={exerciseDelete.undo} />
    </Layout>
  )
}
