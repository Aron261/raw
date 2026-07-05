import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAdmin } from '../hooks/useAdmin'
import { useProfile } from '../hooks/useProfile'
import { useTheme } from '../hooks/useTheme'
import { ERROR_STYLE } from '../lib/ui'

const CHART = {
  'slate-light': { bar: '#3E5C76', axis: '#565C64' },
  'slate-dark':  { bar: '#7FA0BE', axis: '#9AA0A8' },
  'riso-light':  { bar: '#2438FF', axis: '#67696c' },
  'riso-dark':   { bar: '#6E7BFF', axis: '#A2A096' },
}

const CARD = {
  background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
  borderRadius: '16px', padding: '20px',
}
const SECTION_TITLE = {
  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--c-text-dim)', marginBottom: '16px', paddingBottom: '10px',
  borderBottom: '1px solid var(--c-border-subtle)',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('es', { month: 'short', day: 'numeric' })
}

// ── Metric tile ────────────────────────────────────────────────────────────
function Metric({ label, value, sub }) {
  return (
    <div style={{ ...CARD, padding: '16px' }}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '4px', lineHeight: 1 }}>{value ?? '—'}</p>
      {sub && <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}

function MiniChart({ data, color, axis }) {
  return (
    <div style={{ height: '150px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fill: axis, fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
          <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip
            labelFormatter={dayLabel}
            contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '10px', fontSize: '11px' }}
          />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── User management row ──────────────────────────────────────────────────────
function UserRow({ u, onSetBeta, onSetAdmin, onDelete }) {
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const wrap = (fn) => async () => {
    setBusy(true)
    try { await fn() } catch (e) { alert(e.message || 'Error') } finally { setBusy(false) }
  }

  const chip = (on, label) => (
    <span style={{
      fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '2px 7px', borderRadius: '999px',
      background: on ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
      color: on ? 'var(--c-accent)' : 'var(--c-text-ghost)',
      border: `1px solid ${on ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
    }}>{label}</span>
  )

  return (
    <tr style={{ borderTop: '1px solid var(--c-border-subtle)', opacity: busy ? 0.5 : 1 }}>
      <td style={{ padding: '10px 8px' }}>
        <div style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>{u.name || '—'}</div>
        <div style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>{u.email}</div>
      </td>
      <td style={{ padding: '10px 8px', color: 'var(--c-text-dim)', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
      <td style={{ padding: '10px 8px', color: 'var(--c-text-dim)', fontSize: '11px', whiteSpace: 'nowrap' }}>{u.workout_count} · {u.last_workout_at ? fmtDate(u.last_workout_at) : 'nunca'}</td>
      <td style={{ padding: '10px 8px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {chip(u.beta_approved, 'Beta')}
          {u.is_trainer && chip(true, 'Coach')}
          {u.is_admin && chip(true, 'Admin')}
        </div>
      </td>
      <td style={{ padding: '10px 8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" disabled={busy} onClick={wrap(() => onSetBeta(u.id, !u.beta_approved))}
            style={btnStyle}>{u.beta_approved ? 'Quitar beta' : 'Dar beta'}</button>
          <button type="button" disabled={busy} onClick={wrap(() => onSetAdmin(u.id, !u.is_admin))}
            style={btnStyle}>{u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
          {confirmDel ? (
            <button type="button" disabled={busy} onClick={wrap(() => onDelete(u.id))}
              style={{ ...btnStyle, color: '#fff', background: 'var(--c-danger, #C0392B)', borderColor: 'transparent' }}>Confirmar</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmDel(true)}
              style={{ ...btnStyle, color: 'var(--c-danger, #C0392B)', borderColor: 'var(--c-danger, #C0392B)' }}>Eliminar</button>
          )}
        </div>
      </td>
    </tr>
  )
}

const btnStyle = {
  fontSize: '10px', fontWeight: 700, padding: '5px 9px', borderRadius: '8px',
  border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', color: 'var(--c-text-dim)',
  cursor: 'pointer', whiteSpace: 'nowrap',
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()
  const { resolved, palette } = useTheme()
  const cc = CHART[`${palette}-${resolved}`] || CHART['slate-light']
  const { profile, loading: profileLoading } = useProfile()
  const { overview, users, loading, error, refetch, setBeta, setAdmin, deleteUser } = useAdmin()

  // Gate: espera a que el perfil cargue; si no es admin, fuera.
  if (profileLoading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="animate-pulse" style={{ color: 'var(--c-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cargando…</span>
      </div>
    )
  }
  if (!profile?.is_admin) return <Navigate to="/" replace />

  const m = overview?.metrics || {}

  return (
    <div className="fade-in" style={{ minHeight: '100dvh', background: 'var(--c-bg)' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 20px 60px', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Admin</p>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1 }}>Panel de control</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={refetch} style={{ ...btnStyle, padding: '8px 12px' }}>↻ Refrescar</button>
            <button type="button" onClick={() => navigate('/')} style={{ ...btnStyle, padding: '8px 12px' }}>Volver a la app</button>
          </div>
        </div>

        {/* Desktop hint (mobile only) */}
        <p className="md:hidden" style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginBottom: '20px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
          Este panel está pensado para escritorio. Puedes usarlo aquí, pero se ve mejor en una pantalla grande.
        </p>

        {error && <div style={{ ...ERROR_STYLE, marginBottom: '20px' }}>{error}</div>}

        {loading && !overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[100, 180, 220].map((h, i) => <div key={i} style={{ height: h, background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', opacity: 1 - i * 0.15 }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              <Metric label="Usuarios" value={m.total_users} sub={`+${m.signups_7d ?? 0} en 7d`} />
              <Metric label="Activos 7d" value={m.active_users_7d} sub={`${m.active_users_30d ?? 0} en 30d`} />
              <Metric label="Entrenos" value={m.total_workouts} sub={`${m.workouts_7d ?? 0} en 7d`} />
              <Metric label="Series" value={m.total_sets} />
              <Metric label="Beta aprobados" value={m.beta_approved} sub={`de ${m.total_users ?? 0}`} />
              <Metric label="Entrenadores" value={m.trainers} sub={`${m.active_trainer_links ?? 0} vínculos`} />
              <Metric label="Mensajes" value={m.total_messages} />
              <Metric label="Admins" value={m.admins} />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <section style={CARD}>
                <p style={SECTION_TITLE}>Registros · últimos 30 días</p>
                <MiniChart data={overview?.signups_series || []} color={cc.bar} axis={cc.axis} />
              </section>
              <section style={CARD}>
                <p style={SECTION_TITLE}>Entrenos · últimos 30 días</p>
                <MiniChart data={overview?.workouts_series || []} color={cc.bar} axis={cc.axis} />
              </section>
            </div>

            {/* Recent activity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <section style={CARD}>
                <p style={SECTION_TITLE}>Últimos registros</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(overview?.recent_signups || []).map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? '1px solid var(--c-border-subtle)' : 'none' }}>
                      <span style={{ color: 'var(--c-text)', fontSize: '12px' }}>{s.name || s.email}</span>
                      <span style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>{fmtDate(s.created_at)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section style={CARD}>
                <p style={SECTION_TITLE}>Últimos entrenos</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(overview?.recent_workouts || []).map((w, i) => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? '1px solid var(--c-border-subtle)' : 'none' }}>
                      <span style={{ color: 'var(--c-text)', fontSize: '12px' }}>{w.name} · <span style={{ color: 'var(--c-text-dim)' }}>{w.user_name || w.email}</span></span>
                      <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtDateTime(w.started_at)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* System health */}
            <section style={CARD}>
              <p style={SECTION_TITLE}>Salud del sistema</p>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginBottom: '14px' }}>
                Tamaño de la base de datos: <strong style={{ color: 'var(--c-text)' }}>{overview?.db_size || '—'}</strong>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {(overview?.health || []).slice(0, 12).map(h => (
                  <div key={h.table} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '8px', padding: '8px 10px' }}>
                    <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.table}</span>
                    <span style={{ color: 'var(--c-text)', fontSize: '11px', fontWeight: 700, marginLeft: '8px' }}>{h.size}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: 'var(--c-text-ghost)', fontSize: '10px', marginTop: '12px', lineHeight: 1.5 }}>
                Los avisos completos de seguridad/rendimiento (advisors) se revisan en el panel de Supabase.
              </p>
            </section>

            {/* User management */}
            <section style={CARD}>
              <p style={SECTION_TITLE}>Usuarios · {users.length}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead>
                    <tr>
                      {['Usuario', 'Registro', 'Entrenos', 'Estado', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '0 8px 8px', color: 'var(--c-text-ghost)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <UserRow key={u.id} u={u} onSetBeta={setBeta} onSetAdmin={setAdmin} onDelete={deleteUser} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
