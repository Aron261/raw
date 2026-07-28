import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, Field, Button } from '../ui'
import { KINDS, KIND_ORDER, longDate, toLocalISODate } from '../../lib/calendar'
import { useStartRoutineWorkout } from '../../hooks/useStartRoutineWorkout'
import { useLang } from '../../hooks/useLang'

// ── DaySheet ─────────────────────────────────────────────────────────────
// Un día del calendario: lo que ya pasó (entrenos registrados, solo lectura) y
// lo que está planeado (editable). Planear es la acción principal — el
// formulario está siempre abierto, sin un paso extra de "agregar".
export default function DaySheet({
  date, workouts = [], sessions = [], routines = [],
  onCreate, onUpdate, onDelete, onClose,
}) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { startWorkoutFromRoutineDay } = useStartRoutineWorkout()
  const iso = toLocalISODate(date)

  const [kind, setKind] = useState('strength')
  const [title, setTitle] = useState('')
  const [routineDayId, setRoutineDayId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
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
        routine_id: kind === 'strength' && picked ? picked.routineId : null,
        routine_day_id: kind === 'strength' && picked ? picked.id : null,
      })
      setTitle(''); setNotes(''); setRoutineDayId('')
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const cycle = async (s) => {
    const next = s.status === 'planned' ? 'done' : s.status === 'done' ? 'skipped' : 'planned'
    setBusyId(s.id)
    try { await onUpdate(s.id, { status: next }) }
    catch (e) { setErr(e.message || 'No se pudo actualizar.') }
    finally { setBusyId(null) }
  }

  const remove = async (s) => {
    setBusyId(s.id)
    try { await onDelete(s.id) }
    catch (e) { setErr(e.message || 'No se pudo eliminar.') }
    finally { setBusyId(null) }
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

  const STATUS_LABEL = { planned: 'Planeado', done: 'Hecho', skipped: 'Saltado' }

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
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                  borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: '6px',
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
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
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
                  onClick={() => remove(s)}
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
            )
          })}
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
                onClick={() => setKind(k)}
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

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={handleCreate}>
        {saving ? 'Guardando...' : 'Agregar al calendario'}
      </Button>
    </Sheet>
  )
}
