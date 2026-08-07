import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, Field, Button } from '../ui'
import { KINDS, KIND_ORDER, longDate, toLocalISODate } from '../../lib/calendar'
import { isLoggable, formatSessionLog } from '../../lib/schedule'
import { useStartRoutineWorkout } from '../../hooks/useStartRoutineWorkout'
import { useLang } from '../../hooks/useLang'
import SessionLogSheet from './SessionLogSheet'

// Cómo se repite algo. Cuatro, ocho y doce semanas seguidas cubren un mes, un
// bloque y un trimestre — el vocabulario con el que la gente ya planea.
//
// La descarga es el caso raro: no se repite semana tras semana, se repite CADA
// tantas. Nadie hace deload cuatro semanas seguidas; se hace una cada cuatro.
// Por eso el mismo control cambia de significado según qué estés planeando, en
// vez de pedir dos campos (cuántas veces y cada cuánto) que juntos son un
// crucigrama.
const REPEAT_OPTIONS = [
  { id: 'once',  label: 'Una vez',   count: 1,  every: 1 },
  { id: 'w4',    label: '4 semanas', count: 4,  every: 1 },
  { id: 'w8',    label: '8 semanas', count: 8,  every: 1 },
  { id: 'w12',   label: '12 semanas', count: 12, every: 1 },
]

const DELOAD_REPEAT_OPTIONS = [
  { id: 'once', label: 'Una vez',        count: 1, every: 1 },
  { id: 'e4',   label: 'Cada 4 semanas', count: 6, every: 4 },
  { id: 'e6',   label: 'Cada 6 semanas', count: 5, every: 6 },
  { id: 'e8',   label: 'Cada 8 semanas', count: 4, every: 8 },
]

// ── DaySheet ─────────────────────────────────────────────────────────────
// Un día del calendario: lo que ya pasó (entrenos registrados, solo lectura) y
// lo que está planeado (editable). Planear es la acción principal — el
// formulario está siempre abierto, sin un paso extra de "agregar".
export default function DaySheet({
  date, workouts = [], sessions = [], routines = [], ghost = null,
  onCreate, onUpdate, onDelete, onDeleteSeries, onClose,
}) {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()
  const iso = toLocalISODate(date)

  const [kind, setKind] = useState('strength')
  const [title, setTitle] = useState('')
  const [routineDayId, setRoutineDayId] = useState('')
  const [notes, setNotes] = useState('')
  const [repeatId, setRepeatId] = useState('once')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [logging, setLogging] = useState(null)
  const [err, setErr] = useState(null)

  // Días de ciclo disponibles para vincular una sesión de fuerza.
  const dayOptions = routines.flatMap(r =>
    (r.routine_days || []).map(d => ({
      id: d.id,
      routineId: r.id,
      routineName: r.name,
      label: `${r.name} — ${d.day_name}`,
      day: d,
    }))
  )

  const repeatOptions = kind === 'deload' ? DELOAD_REPEAT_OPTIONS : REPEAT_OPTIONS
  const repeat = repeatOptions.find(o => o.id === repeatId) || repeatOptions[0]

  const handleCreate = async () => {
    setSaving(true)
    setErr(null)
    try {
      const picked = dayOptions.find(o => o.id === routineDayId)
      await onCreate({
        date: iso,
        kind,
        title,
        notes,
        repeatWeeks: repeat.count,
        repeatEvery: repeat.every,
        routine_id: kind === 'strength' && picked ? picked.routineId : null,
        routine_day_id: kind === 'strength' && picked ? picked.id : null,
      })
      setTitle(''); setNotes(''); setRoutineDayId(''); setRepeatId('once')
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  // Planeado → Hecho → Saltado → Planeado.
  //
  // Con una excepción: dar por hecho un cardio o una movilidad abre la hoja de
  // registro en vez de marcarlo a secas. Es el único momento en que existen las
  // cifras —acabas de bajarte de la bici—, y sin ellas la sesión vuelve a ser
  // un punto de color. Saltar hacia atrás no pregunta nada.
  // Registrar algo ya hecho: nace la sesión cerrada y se abre la hoja para
  // ponerle las cifras encima. Nunca se repite — lo que ya pasó pasó una vez.
  const handleLogNow = async () => {
    setSaving(true)
    setErr(null)
    try {
      const created = await onCreate({
        date: iso,
        kind,
        title,
        notes,
        repeatWeeks: 1,
        status: 'done',
        routine_id: null,
        routine_day_id: null,
      })
      setTitle(''); setNotes(''); setRepeatId('once')
      const row = Array.isArray(created) ? created[0] : created
      if (row?.id) setLogging(row)
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const cycle = async (s) => {
    if (s.status === 'planned' && isLoggable(s.kind)) { setLogging(s); return }
    const next = s.status === 'planned' ? 'done' : s.status === 'done' ? 'skipped' : 'planned'
    setBusyId(s.id)
    try {
      // Deshacer un "hecho" se lleva por delante las cifras: pertenecían a esa
      // sesión hecha, y dejarlas colgando de un plan pendiente sería basura.
      const clear = next === 'planned' || next === 'skipped'
        ? { duration_min: null, distance_km: null, rpe: null }
        : {}
      await onUpdate(s.id, { status: next, ...clear })
    }
    catch (e) { setErr(e.message || 'No se pudo actualizar.') }
    finally { setBusyId(null) }
  }

  const remove = async (s) => {
    setBusyId(s.id)
    setConfirmId(null)
    try { await onDelete(s.id) }
    catch (e) { setErr(e.message || 'No se pudo eliminar.') }
    finally { setBusyId(null) }
  }

  const removeSeries = async (s) => {
    setBusyId(s.id)
    setConfirmId(null)
    try { await onDeleteSeries?.(s.series_id) }
    catch (e) { setErr(e.message || 'No se pudo eliminar.') }
    finally { setBusyId(null) }
  }

  // La ✕ de una ocurrencia suelta borra directamente. La de una serie pregunta
  // primero: "quitar el cardio de los martes" y "quitar el de este martes" son
  // dos intenciones distintas y una de ellas toca ocho días de calendario.
  const requestRemove = (s) => {
    if (s.series_id) setConfirmId(confirmId === s.id ? null : s.id)
    else remove(s)
  }

  // Empezar de verdad una sesión de fuerza vinculada a un día de rutina.
  const start = async (s) => {
    const opt = dayOptions.find(o => o.id === s.routine_day_id)
    if (!opt) return
    setBusyId(s.id)
    try {
      const w = await startWorkoutFromRoutineDay({
        routineId: opt.routineId,
        routineDayId: opt.id,
        routineName: opt.routineName,
        day: opt.day,
      })
      navigate(`/workout/${w.id}`)
    } catch (e) {
      setErr(e.message || 'No se pudo empezar el entreno.')
      setBusyId(null)
    }
  }

  // ── La previsión ───────────────────────────────────────────────────────
  // El ciclo ya sabe qué toca; el calendario lo dibuja en gris. Aquí se puede
  // convertir en un plan de verdad (fijar) o hacerlo directamente (empezar).
  const ghostDay = ghost ? dayOptions.find(o => o.id === ghost.day?.id) : null

  const pinGhost = async () => {
    setBusyId('ghost')
    setErr(null)
    try {
      await onCreate({
        date: iso,
        kind: 'strength',
        title: ghost.day?.day_name || '',
        notes: '',
        routine_id: ghost.routineId,
        routine_day_id: ghost.day?.id,
      })
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.')
    } finally {
      setBusyId(null)
    }
  }

  const startGhost = async () => {
    if (!ghostDay) return
    setBusyId('ghost')
    try {
      const w = await startWorkoutFromRoutineDay({
        routineId: ghostDay.routineId,
        routineDayId: ghostDay.id,
        routineName: ghostDay.routineName,
        day: ghostDay.day,
      })
      navigate(`/workout/${w.id}`)
    } catch (e) {
      setErr(e.message || 'No se pudo empezar el entreno.')
      setBusyId(null)
    }
  }

  const STATUS_LABEL = { planned: 'Planeado', done: 'Hecho', skipped: 'Saltado' }

  // Mientras se anotan las cifras, la hoja del día CEDE el sitio en vez de
  // dejar que la otra se apile encima. Dos Sheet montadas a la vez se pelean:
  // las dos escuchan Escape y Tab sobre `document`, y stopPropagation no frena
  // a otro oyente del mismo nodo — así que un Escape cerraba las dos de golpe y
  // el atrapado de foco se iba a la de abajo. Cerrar la de arriba devuelve
  // aquí, que es lo que se espera de una hoja que se abrió desde esta.
  if (logging) {
    return (
      <SessionLogSheet
        session={logging}
        onSave={(fields) => onUpdate(logging.id, fields)}
        onClose={() => setLogging(null)}
      />
    )
  }

  return (
    <Sheet title={longDate(date)} onClose={onClose}>
      {err && (
        <p style={{ color: 'var(--c-action-text)', fontSize: '11px', marginBottom: '10px' }}>{err}</p>
      )}

      {/* ── Entrenos registrados (solo lectura) ── */}
      {workouts.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>
            {t('Registrado')}
          </p>
          {workouts.map(w => (
            <button
              key={w.id}
              onClick={() => navigate(`/workout/${w.id}`)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                borderRadius: 'var(--r-sm)', padding: '11px 12px', marginBottom: '6px',
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--c-accent)', flexShrink: 0 }} />
              <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.name}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--c-text-ghost)', fontSize: '14px' }} aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Sesiones planificadas ── */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>
            {t('Planeado')}
          </p>
          {sessions.map(s => {
            const meta = KINDS[s.kind] || KINDS.note
            const busy = busyId === s.id
            return (
              <div key={s.id} style={{ marginBottom: '6px' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                  borderRadius: 'var(--r-sm)', padding: '10px 12px',
                  opacity: busy ? 0.5 : s.status === 'skipped' ? 0.55 : 1,
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: s.status === 'done' ? meta.color : 'transparent',
                  border: s.status === 'done' ? 'none' : `1.5px solid ${meta.color}`,
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    color: 'var(--c-text)', fontSize: '13px', fontWeight: 700,
                    textDecoration: s.status === 'skipped' ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.title || meta.label}
                  </p>
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                    {meta.label} · {STATUS_LABEL[s.status]}
                    {s.series_id ? ` · ${t('Cada semana')}` : ''}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
                  {/* Lo registrado manda sobre la etiqueta: "45 min · 8,2 km"
                      dice bastante más que "Cardio · Hecho". */}
                  {s.status === 'done' && formatSessionLog(s, { locale, t }) && (
                    <p style={{
                      fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)',
                      fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
                      fontVariantNumeric: 'tabular-nums', marginTop: '3px',
                    }}>
                      {formatSessionLog(s, { locale, t })}
                    </p>
                  )}
                </div>

                {s.routine_day_id && s.status !== 'done' && (
                  <button
                    onClick={() => start(s)}
                    disabled={busy}
                    style={{
                      flexShrink: 0, background: 'var(--c-accent)', color: 'var(--c-on-action)',
                      border: 'none', borderRadius: 'var(--r-xs)', padding: '7px 10px',
                      fontSize: '10px', fontWeight: 800,
                    }}
                  >
                    {t('Empezar')}
                  </button>
                )}
                {s.status === 'done' && isLoggable(s.kind) && (
                  <button
                    onClick={() => setLogging(s)}
                    disabled={busy}
                    aria-label={`Editar lo registrado: ${s.title || meta.label}`}
                    style={{
                      flexShrink: 0, minWidth: '32px', minHeight: '32px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--c-text-dim)', fontSize: '12px', background: 'transparent',
                    }}
                  >
                    ✎
                  </button>
                )}
                <button
                  onClick={() => cycle(s)}
                  disabled={busy}
                  aria-label={`Cambiar estado: ${s.title || meta.label}`}
                  title="Planeado → Hecho → Saltado"
                  style={{
                    flexShrink: 0, minWidth: '32px', minHeight: '32px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text-dim)', fontSize: '13px', background: 'transparent',
                  }}
                >
                  {s.status === 'done' ? '✓' : s.status === 'skipped' ? '↺' : '○'}
                </button>
                <button
                  onClick={() => requestRemove(s)}
                  disabled={busy}
                  aria-label={`Eliminar: ${s.title || meta.label}`}
                  style={{
                    flexShrink: 0, minWidth: '32px', minHeight: '32px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text-muted)', fontSize: '12px', background: 'transparent',
                  }}
                >
                  ✕
                </button>
              </div>

              {confirmId === s.id && (
                <div style={{
                  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
                  padding: '9px 12px', marginTop: '-1px',
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                  borderTop: 'none', borderRadius: '0 0 var(--r-sm) var(--r-sm)',
                }}>
                  <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, marginRight: 'auto' }}>
                    {t('Se repite cada semana')}
                  </span>
                  <button
                    onClick={() => remove(s)}
                    style={{
                      minHeight: '32px', padding: '7px 10px', fontSize: '10px', fontWeight: 800,
                      borderRadius: 'var(--r-xs)', background: 'var(--c-surface-3)',
                      border: '1px solid var(--c-border-subtle)', color: 'var(--c-text-dim)',
                    }}
                  >
                    {t('Solo este día')}
                  </button>
                  <button
                    onClick={() => removeSeries(s)}
                    style={{
                      minHeight: '32px', padding: '7px 10px', fontSize: '10px', fontWeight: 800,
                      borderRadius: 'var(--r-xs)', background: 'var(--c-accent)',
                      border: 'none', color: 'var(--c-on-action)',
                    }}
                  >
                    {t('Toda la serie')}
                  </button>
                </div>
              )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Lo que el ciclo prevé para este día ── */}
      {ghost && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>
            {t('Previsto')}
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'transparent', border: '1px dashed var(--c-border)',
            borderRadius: 'var(--r-sm)', padding: '10px 12px',
            opacity: busyId === 'ghost' ? 0.5 : 1,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ghost.day?.day_name || t('Fuerza')}
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                {ghost.routineName}
                {ghostDay ? ` · ${(ghostDay.day.routine_day_exercises || []).filter(e => e.exercise_name?.trim()).length} ej` : ''}
              </p>
            </div>
            {ghostDay && (
              <button
                onClick={startGhost}
                disabled={busyId === 'ghost'}
                style={{
                  flexShrink: 0, background: 'var(--c-accent)', color: 'var(--c-on-action)',
                  border: 'none', borderRadius: 'var(--r-xs)', padding: '7px 10px',
                  fontSize: '10px', fontWeight: 800,
                }}
              >
                {t('Empezar')}
              </button>
            )}
            <button
              onClick={pinGhost}
              disabled={busyId === 'ghost'}
              style={{
                flexShrink: 0, background: 'var(--c-surface-2)', color: 'var(--c-text-dim)',
                border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-xs)',
                padding: '7px 10px', fontSize: '10px', fontWeight: 800,
              }}
            >
              {t('Fijar')}
            </button>
          </div>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '10.5px', lineHeight: 1.5, marginTop: '7px' }}>
            {t('Lo que le toca al ciclo si mantienes tu ritmo. Todavía no está escrito.')}
          </p>
        </div>
      )}

      {/* ── Planear algo nuevo ── */}
      <Field label="Qué vas a hacer">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {KIND_ORDER.map(k => {
            const on = kind === k
            return (
              <button
                key={k}
                onClick={() => { setKind(k); setRepeatId('once') }}
                style={{
                  padding: '8px 12px', borderRadius: '999px',
                  fontSize: '11px', fontWeight: 700,
                  background: on ? 'var(--c-accent)' : 'var(--c-surface-2)',
                  color: on ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                  border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                  transition: 'background 150ms, color 150ms',
                }}
              >
                {KINDS[k].label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Título" hint="Opcional — ej: «Cardio 40 min» o «Upper A»">
        <input
          className="input-field"
          placeholder={KINDS[kind].label}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </Field>

      {kind === 'strength' && dayOptions.length > 0 && (
        <Field label="Vincular a un día de rutina" hint="Opcional — te deja empezar el entreno desde aquí">
          <select className="input-field" value={routineDayId} onChange={e => setRoutineDayId(e.target.value)}>
            <option value="">— Sin vincular —</option>
            {dayOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Field>
      )}

      {kind === 'deload' && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
          {t('La semana de esta fecha se marcará como descarga en el calendario.')}
        </p>
      )}

      <Field label="Notas">
        <input
          className="input-field"
          placeholder="Opcional"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </Field>

      {/* Repetir. Lo que se repite —cardio los martes, movilidad los domingos—
          es justo lo que nadie sostiene escribiéndolo día a día. Un descanso o
          una nota suelta no se repiten: no se ofrece. */}
      {kind !== 'note' && (
        <Field
          label="Repetir"
          hint={kind === 'deload' ? 'A partir de esta semana' : 'Cada semana, a partir de este día'}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {repeatOptions.map(o => {
              const on = repeatId === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setRepeatId(o.id)}
                  aria-pressed={on}
                  style={{
                    minHeight: '44px', padding: '8px 12px', borderRadius: '999px',
                    fontSize: '11px', fontWeight: 700,
                    background: on ? 'var(--c-accent)' : 'var(--c-surface-2)',
                    color: on ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                    border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {t(o.label)}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {saving ? 'Guardando...' : 'Agregar al calendario'}
      </Button>

      {/* Registrar algo que YA hiciste sin haberlo planeado antes. Hasta ahora
          era imposible: un cardio no planeado no tenía dónde caber, así que no
          se anotaba en ningún sitio. */}
      {isLoggable(kind) && (
        <div style={{ marginTop: '8px' }}>
          <Button variant="secondary" full size="lg" disabled={saving} onClick={handleLogNow}>
            {t('Ya lo hice')}
          </Button>
        </div>
      )}

    </Sheet>
  )
}
