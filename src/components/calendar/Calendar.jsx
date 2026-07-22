import { useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_PRESS } from '../../lib/motion'
import Segmented from '../stats/Segmented'
import {
  monthMatrix, monthLabel, weekDays, weekRangeLabel, longDate,
  toLocalISODate, weekKey, mondayOf, KINDS, DONE_COLOR,
} from '../../lib/calendar'

const DAY_HEADS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Punto de un día: relleno = pasó de verdad (entreno registrado o plan hecho),
// anillo = todavía es un plan.
function Dot({ color, filled, size = 6 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
        background: filled ? color : 'transparent',
        border: filled ? 'none' : `1.5px solid ${color}`,
      }}
    />
  )
}

// ── Vista mes ────────────────────────────────────────────────────────────
// Densidad máxima: el mes entero de un vistazo, cada día reducido a puntos.
function MonthGrid({ anchor, todayISO, doneByDate, planByDate, deloadWeeks, onSelectDay, reduce }) {
  const cells = useMemo(
    () => monthMatrix(anchor.getFullYear(), anchor.getMonth()),
    [anchor]
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAY_HEADS.map((d, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.06em', color: 'var(--c-text-ghost)', paddingBottom: '4px',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((date) => {
          const iso = toLocalISODate(date)
          const inMonth = date.getMonth() === anchor.getMonth()
          const isToday = iso === todayISO
          const done = doneByDate[iso] || []
          const plan = planByDate[iso] || []
          const isDeloadWeek = deloadWeeks.has(weekKey(date))

          const dots = [
            ...done.map((_, i) => ({ key: `d${i}`, color: DONE_COLOR, filled: true })),
            ...plan.map((s, i) => ({
              key: `p${i}`,
              color: (KINDS[s.kind] || KINDS.note).color,
              filled: s.status === 'done',
            })),
          ]
          const shown = dots.slice(0, 4)
          const extra = dots.length - shown.length

          return (
            <motion.button
              key={iso}
              data-date={iso}
              onClick={() => onSelectDay?.(date)}
              aria-label={`${longDate(date)} — ${done.length} entrenos, ${plan.length} planificados`}
              whileTap={reduce ? undefined : { scale: 0.93 }}
              transition={SPRING_PRESS}
              style={{
                position: 'relative',
                minHeight: '46px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '6px 2px 4px',
                borderRadius: '10px',
                background: isDeloadWeek ? 'var(--c-surface-2)' : 'transparent',
                border: isToday ? '1.5px solid var(--c-accent)' : '1.5px solid transparent',
                opacity: inMonth ? 1 : 0.32,
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px',
                fontWeight: isToday ? 800 : 600,
                fontVariantNumeric: 'tabular-nums',
                color: isToday ? 'var(--c-accent)' : 'var(--c-text-dim)',
                lineHeight: 1,
              }}>
                {date.getDate()}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', minHeight: '8px', flexWrap: 'wrap' }}>
                {shown.map(d => <Dot key={d.key} color={d.color} filled={d.filled} />)}
                {extra > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--c-text-ghost)', lineHeight: 1 }}>
                    +{extra}
                  </span>
                )}
              </span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}

// Ficha de una sesión dentro de la columna del día. En 7 columnas no cabe una
// frase, así que manda el color (qué tipo es) y el texto se recorta a dos
// líneas — el detalle completo vive en la hoja del día, a un toque.
function DayChip({ color, filled, label, detail, struck }) {
  return (
    <span style={{
      display: 'block', width: '100%',
      borderLeft: `2px solid ${color}`,
      background: filled ? 'var(--c-surface-3)' : 'transparent',
      borderRadius: '0 4px 4px 0',
      padding: '3px 1px 3px 3px',
    }}>
      <span style={{
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        fontSize: '9.5px', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em',
        color: struck ? 'var(--c-text-muted)' : 'var(--c-text)',
        textDecoration: struck ? 'line-through' : 'none',
        // Cortar por palabras, nunca por letras: "Uppe/r 1" no se lee.
        overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none',
      }}>
        {label}
      </span>
      {detail && (
        <span style={{
          display: 'block', fontFamily: 'var(--font-mono)', fontSize: '8px',
          color: 'var(--c-text-muted)', lineHeight: 1.3, marginTop: '1px',
        }}>
          {detail}
        </span>
      )}
    </span>
  )
}

// ── Vista semana ─────────────────────────────────────────────────────────
// El acercamiento: la semana como siete columnas, una por día, para leer la
// programación de un vistazo — lunes a domingo de izquierda a derecha, igual
// que la rejilla del mes. Cada columna es tocable y abre la hoja del día.
function WeekColumns({ anchor, todayISO, doneByDate, planByDate, deloadWeeks, dayById, onSelectDay, reduce }) {
  const days = useMemo(() => weekDays(anchor), [anchor])
  const isDeloadWeek = deloadWeeks.has(weekKey(anchor))

  return (
    <>
      {isDeloadWeek && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
          borderRadius: '10px', padding: '8px 11px', marginBottom: '8px',
        }}>
          <Dot color={KINDS.deload.color} filled size={7} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-dim)',
          }}>
            Semana de descarga
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', alignItems: 'stretch' }}>
        {days.map((date, i) => {
          const iso = toLocalISODate(date)
          const isToday = iso === todayISO
          const done = doneByDate[iso] || []
          const plan = planByDate[iso] || []
          const empty = done.length === 0 && plan.length === 0

          return (
            <motion.button
              key={iso}
              data-date={iso}
              onClick={() => onSelectDay?.(date)}
              aria-label={`${longDate(date)} — ${done.length} entrenos, ${plan.length} planificados`}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              transition={SPRING_PRESS}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px',
                minHeight: '112px', padding: '7px 2px 6px',
                borderRadius: '10px', textAlign: 'left',
                background: isToday ? 'var(--c-action-dim)' : 'var(--c-surface-2)',
                border: `1px solid ${isToday ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
                cursor: 'pointer',
              }}
            >
              {/* Cabecera de la columna: día y número */}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: isToday ? 'var(--c-accent)' : 'var(--c-text-ghost)',
                }}>
                  {DAY_ABBR[i]}
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 900,
                  letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
                  color: isToday ? 'var(--c-accent)' : 'var(--c-text)',
                }}>
                  {date.getDate()}
                </span>
              </span>

              {/* Contenido del día, apilado hacia abajo */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                {empty && (
                  <span aria-hidden="true" style={{
                    height: '2px', width: '12px', margin: '4px auto 0',
                    background: 'var(--c-border)', borderRadius: '2px',
                  }} />
                )}

                {done.map(w => (
                  <DayChip
                    key={w.id}
                    color={DONE_COLOR}
                    filled
                    label={w.name}
                    detail={(w.workout_exercises || []).length ? `${(w.workout_exercises || []).length} ej` : null}
                  />
                ))}

                {plan.map(s => {
                  const meta = KINDS[s.kind] || KINDS.note
                  // Si la sesión está vinculada a un día de rutina, el plan real
                  // ya existe: se muestra de qué se compone, no solo su nombre.
                  const linked = s.routine_day_id ? dayById[s.routine_day_id] : null
                  const exCount = linked
                    ? (linked.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length
                    : 0
                  return (
                    <DayChip
                      key={s.id}
                      color={meta.color}
                      filled={s.status === 'done'}
                      struck={s.status === 'skipped'}
                      label={s.title || meta.label}
                      detail={exCount > 0 ? `${exCount} ej` : null}
                    />
                  )
                })}
              </span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}

// ── Calendar ─────────────────────────────────────────────────────────────
// Dos acercamientos sobre los mismos datos: el mes para ver la forma del
// entrenamiento, la semana para leer y programar el detalle. Un solo `anchor`
// (una fecha) manda en ambos, así que cambiar de vista nunca te teletransporta:
// la semana que ves es la del mes que estabas mirando.
export default function Calendar({ workouts = [], sessions = [], routines = [], onSelectDay }) {
  const reduce = useReducedMotion()
  const today = new Date()
  const [mode, setMode] = useState('mes')
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const todayISO = toLocalISODate(today)

  const doneByDate = useMemo(() => {
    const map = {}
    for (const w of workouts) {
      if (!w.ended_at || !w.started_at) continue
      const k = toLocalISODate(new Date(w.started_at))
      ;(map[k] = map[k] || []).push(w)
    }
    return map
  }, [workouts])

  const planByDate = useMemo(() => {
    const map = {}
    for (const s of sessions) {
      ;(map[s.date] = map[s.date] || []).push(s)
    }
    return map
  }, [sessions])

  const deloadWeeks = useMemo(() => {
    const set = new Set()
    for (const s of sessions) {
      if (s.kind === 'deload') set.add(weekKey(new Date(`${s.date}T00:00:00`)))
    }
    return set
  }, [sessions])

  // routine_day_id → día de rutina, para leer el contenido de una sesión vinculada.
  const dayById = useMemo(() => {
    const map = {}
    for (const r of routines) for (const d of r.routine_days || []) map[d.id] = d
    return map
  }, [routines])

  const isWeek = mode === 'semana'

  // Un paso = un mes o una semana, según el acercamiento.
  const move = (delta) => setAnchor(a => isWeek
    ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + delta * 7)
    : new Date(a.getFullYear(), a.getMonth() + delta, 1))

  const goToday = () => setAnchor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const showingNow = isWeek
    ? toLocalISODate(mondayOf(anchor)) === toLocalISODate(mondayOf(today))
    : anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth()

  const navBtn = {
    width: '36px', height: '36px', borderRadius: '10px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
    color: 'var(--c-text-dim)', fontSize: '15px', lineHeight: 1,
  }

  return (
    <section
      aria-label="Calendario de entrenamiento"
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '16px',
        padding: '16px 14px 14px',
      }}
    >
      {/* Cabecera: periodo + acercamiento + navegación */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: isWeek ? '19px' : '22px', lineHeight: 1.05, color: 'var(--c-text)' }}>
            {isWeek ? weekRangeLabel(anchor) : monthLabel(anchor.getFullYear(), anchor.getMonth())}
          </p>
          {!showingNow && (
            <button
              onClick={goToday}
              style={{
                marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-accent)', background: 'transparent',
              }}
            >
              Ir a hoy
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => move(-1)} aria-label={isWeek ? 'Semana anterior' : 'Mes anterior'} style={navBtn}>←</button>
          <button onClick={() => move(1)} aria-label={isWeek ? 'Semana siguiente' : 'Mes siguiente'} style={navBtn}>→</button>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <Segmented
          ariaLabel="Acercamiento del calendario"
          value={mode}
          onChange={setMode}
          options={[{ id: 'mes', label: 'Mes' }, { id: 'semana', label: 'Semana' }]}
        />
      </div>

      {isWeek
        ? <WeekColumns {...{ anchor, todayISO, doneByDate, planByDate, deloadWeeks, dayById, onSelectDay, reduce }} />
        : <MonthGrid {...{ anchor, todayISO, doneByDate, planByDate, deloadWeeks, onSelectDay, reduce }} />}

      {/* Leyenda — mínima, solo lo que aparece en la rejilla */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--c-border-subtle)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-ghost)' }}>
          <Dot color={DONE_COLOR} filled /> Hecho
        </span>
        {['strength', 'cardio', 'mobility', 'deload'].map(k => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-ghost)' }}>
            <Dot color={KINDS[k].color} /> {KINDS[k].label}
          </span>
        ))}
      </div>
    </section>
  )
}
