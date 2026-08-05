import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Layout from '../components/Layout'
import PRBadge from '../components/PRBadge'
import { useExercisePR, calc1RM } from '../hooks/useWorkout'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../hooks/useLang'
import { useExerciseLang } from '../hooks/useExerciseLang'
import { useExerciseMedia } from '../hooks/useExerciseMedia'
import ExerciseGif from '../components/ExerciseGif'
import { ErrorRetry } from '../components/ui'
import { useChartColors } from '../lib/chartColors'
import {
  gridProps, axisProps, ChartTooltip,
  AreaFillDefs, useAreaFillId, lastPointDot,
} from '../components/charts/chartTheme'


// Custom tooltip — light theme
// Rep ranges to highlight in the PR table
const REP_RANGES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]

export default function ExerciseDetail() {
  const { t, locale } = useLang()
  const { name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cc = useChartColors()
  const fillId = useAreaFillId()

  const exerciseName = decodeURIComponent(name)
  const { prSets, allTimePR, loading, error, refetch } = useExercisePR(exerciseName, user?.id)
  const media = useExerciseMedia(exerciseName)
  const { term, lang } = useExerciseLang()

  // Primarios y secundarios en una línea, traducidos y sin repetir. Los
  // secundarios van detrás porque el primario es el que decide si es el
  // ejercicio que buscabas.
  const musclesLine = useMemo(() => {
    const all = [...(media?.primary_muscles ?? []), ...(media?.secondary_muscles ?? [])]
    return [...new Set(all.filter(Boolean).map(term))].join(' · ')
  }, [media, term])

  // Chart: date + best 1RM per session
  const chartData = prSets.map(session => ({
    date: new Date(session.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    '1RM': session.best1RM,
  }))

  const allTimeBest1RM = allTimePR?.best1RM || 0

  // PR by rep range: for each rep count, best weight logged ever
  const prByReps = useMemo(() => {
    // Flatten all sets from all sessions
    const allSets = prSets.flatMap(session =>
      (session.sets || []).map(s => ({ ...s, unit: session.unit, date: session.date }))
    )

    // Best weight per rep count
    const bestByRep = {}
    for (const set of allSets) {
      if (!set.reps || !set.weight) continue
      const existing = bestByRep[set.reps]
      if (!existing || set.weight > existing.weight) {
        bestByRep[set.reps] = set
      }
    }

    // Keep only rep ranges we care about (that have data), sorted asc
    return REP_RANGES
      .filter(r => bestByRep[r])
      .map(r => ({ reps: r, ...bestByRep[r] }))
  }, [prSets])

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '8px' }}>
          <button
            onClick={() => navigate(-1)}
            aria-label={t('Volver')}
            style={{
              color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0,
              // Era el único «volver» de la app sin nombre accesible y sin
              // área de toque: 44px lo pone al nivel del resto.
              minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center',
            }}
          >
            ←
          </button>
          {/* Sin recorte: es el título de la pantalla y no compite con nada.
              Iba a una línea con ellipsis, así que «Extensión en polea alta
              con cuerda» se leía «Extensión en polea alta c…» — justo la parte
              que la distingue de «…con barra». */}
          <h1 style={{ color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            {exerciseName}
          </h1>
        </div>

        {/* Cómo se hace: la animación y qué músculos entran. Arriba del todo
            porque es lo que responde «¿es este el ejercicio?», y esa pregunta
            va antes que cualquier número. Si la fila no tiene animación
            aprobada, ExerciseGif devuelve null y no queda ni el hueco. */}
        {media?.gif_url && media.media_reviewed && (
          <div style={{
            display: 'flex', gap: '14px', alignItems: 'center',
            background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
            boxShadow: 'var(--e-1)', borderRadius: 'var(--r-md)',
            padding: '12px', margin: '16px 0 0',
          }}>
            <ExerciseGif exercise={media} size={104} rounded={10} />
            <div style={{ minWidth: 0 }}>
              {musclesLine && (
                <>
                  <span style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', display: 'block' }}>
                    {t('Músculos')}
                  </span>
                  <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {musclesLine}
                  </span>
                </>
              )}
              {/* La descripción solo existe en español en la librería. Con la
                  app en inglés se colaba tal cual bajo unos músculos ya
                  traducidos, que es justo la pantalla mezclada que la app
                  dejó de tener cuando el idioma pasó a mandar sobre todo.
                  Hasta que haya description_en, en inglés no se enseña. */}
              {lang === 'es' && media.description && (
                <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', lineHeight: 1.45, marginTop: musclesLine ? '6px' : 0 }}>
                  {media.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* All-time PR callout */}
        {allTimePR && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)',
            padding: '12px 16px', borderRadius: 'var(--r-md)', margin: '16px 0 24px',
          }}>
            <PRBadge />
            <div>
              <span style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', display: 'block' }}>
                {t('Mejor 1RM estimado')}
              </span>
              <span style={{ color: 'var(--c-text)', fontWeight: 900, fontSize: '22px' }}>
                {allTimePR.best1RM}
                <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '13px', marginLeft: '4px' }}>{allTimePR.unit}</span>
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div aria-hidden="true">
            <div className="skeleton" style={{ height: '180px', marginBottom: '32px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton" style={{ height: '64px', borderRadius: 'var(--r-md)' }} />
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <ErrorRetry
            message={t('No pudimos cargar el progreso de este ejercicio.')}
            onRetry={refetch}
            style={{ marginBottom: '16px' }}
          />
        )}

        {!loading && !error && prSets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', border: '1px dashed var(--c-border)', borderRadius: 'var(--r-md)' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>{t('Sin datos aún')}</p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px' }}>{t('Registra este ejercicio para ver tu progreso.')}</p>
          </div>
        )}

        {!loading && !error && prSets.length > 0 && (
          <>
            {/* Progression chart */}
            <div style={{ marginBottom: '32px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '16px' }}>
                {t('Progresión 1RM')}
              </p>
              <div style={{ height: '180px', width: '100%' }}>
                <AreaFillDefs id={fillId} colors={cc} />
                <ResponsiveContainer width="100%" height="100%">
                  {/* Hex literal — var() no resuelve dentro de un atributo SVG */}
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid {...gridProps(cc)} />
                    <XAxis {...axisProps(cc)} dataKey="date" />
                    <YAxis {...axisProps(cc)} width={38} />
                    <Tooltip
                      content={<ChartTooltip format={(v) => `${v} 1RM`} />}
                      cursor={{ stroke: cc.grid, strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="1RM"
                      stroke={cc.line}
                      strokeWidth={2.4}
                      fill={`url(#${fillId})`}
                      dot={lastPointDot(cc)}
                      activeDot={{ fill: cc.line, r: 5, strokeWidth: 2, stroke: 'var(--c-surface)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PR by rep range */}
            {prByReps.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '12px' }}>
                  {t('Mejor peso por reps')}
                </p>
                <div style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
                  borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                }}>
                  {prByReps.map((entry, i) => {
                    const dateStr = new Date(entry.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
                    const isFirst = i === 0
                    return (
                      <div
                        key={entry.reps}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderTop: isFirst ? 'none' : '1px solid var(--c-border-subtle)',
                        }}
                      >
                        {/* Rep badge */}
                        <div style={{
                          width: '36px', height: '36px',
                          background: 'var(--c-surface-2)',
                          borderRadius: 'var(--r-sm)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginRight: '12px',
                        }}>
                          <span style={{ color: 'var(--c-text)', fontWeight: 900, fontSize: '13px' }}>{entry.reps}</span>
                        </div>

                        {/* Label */}
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                            {entry.reps === 1 ? '1 rep' : `${entry.reps} reps`}
                          </span>
                        </div>

                        {/* Weight + date */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '15px' }}>
                            {entry.weight}
                            <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{entry.unit}</span>
                          </span>
                          <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '1px' }}>{dateStr}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Session history */}
            <div style={{ paddingBottom: '32px' }}>
              <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '12px' }}>
                {t('Historial')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...prSets].reverse().map(session => {
                  const sessionDate = new Date(session.date).toLocaleDateString(locale, {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })
                  const isAllTimePR = session.best1RM === allTimeBest1RM

                  return (
                    <div key={session.workoutId} style={{
                      background: 'var(--c-surface)',
                      border: `1px solid ${isAllTimePR ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
                      borderRadius: 'var(--r-md)',
                      padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                          {sessionDate}
                        </span>
                        {isAllTimePR && <PRBadge />}
                      </div>

                      {/* Sets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[...session.sets]
                          .sort((a, b) => a.set_number - b.set_number)
                          .map(set => {
                            const set1RM = calc1RM(set.weight, set.reps)
                            const isSetPR = isAllTimePR && set1RM === session.best1RM
                            return (
                              <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                                <span style={{ color: 'var(--c-text-muted)', width: '20px', fontSize: '11px' }}>{set.set_number}</span>
                                <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
                                  {set.reps} × {set.weight}
                                  <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{session.unit}</span>
                                </span>
                                <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginLeft: 'auto' }}>~{set1RM} 1RM</span>
                                {isSetPR && <PRBadge />}
                              </div>
                            )
                          })}
                      </div>

                      {/* Session best */}
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--c-border-subtle)' }}>
                        <span style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>
                          {t('Mejor:')} <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{session.best1RM} 1RM</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
