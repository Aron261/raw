import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import Layout from '../components/Layout'
import { useDashboard } from '../hooks/useDashboard'
import { formatDuration } from '../hooks/useWorkout'

// ── Custom tooltip for charts ──────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      padding: '8px 12px',
      borderRadius: '10px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
        {label}
      </p>
      <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800 }}>
        {payload[0].value.toLocaleString()}{unit && ` ${unit}`}
      </p>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px',
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ color: 'var(--c-text)', fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '5px' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{ color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>
      {children}
    </p>
  )
}

// ── Skeleton block ─────────────────────────────────────────────────────
function Skeleton({ height = 48, style = {} }) {
  return (
    <div style={{
      height,
      background: 'var(--c-surface-2)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '12px',
      ...style,
    }} />
  )
}

// ── Today label ────────────────────────────────────────────────────────
const todayStr = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
})

export default function Dashboard() {
  const { data, loading } = useDashboard()
  const navigate = useNavigate()

  return (
    <Layout>
      <div
        className="fade-in"
        style={{ padding: '40px 40px 60px', maxWidth: '960px', margin: '0 auto', width: '100%' }}
      >
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '36px' }}>
          <h1 style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {todayStr}
          </p>
        </div>

        {/* ── Stat cards ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '36px' }}>
            {[...Array(3)].map((_, i) => <Skeleton key={i} height={96} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '36px' }}>
            <StatCard
              label="Total entrenos"
              value={data?.totalWorkouts ?? 0}
              sub="desde el inicio"
            />
            <StatCard
              label="Este mes"
              value={data?.thisMonth ?? 0}
              sub={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            />
            <StatCard
              label="Último entreno"
              value={data?.lastWorkout
                ? new Date(data.lastWorkout.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
              sub={data?.lastWorkout ? data.lastWorkout.name : 'ninguno aún'}
            />
          </div>
        )}

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '36px' }}>

          {/* Workout frequency */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionLabel>Frecuencia semanal</SectionLabel>
            {loading ? (
              <Skeleton height={180} style={{ border: 'none' }} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.weeklyData} barSize={16} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  {/* hex values required — SVG fill/stroke don't accept CSS vars */}
                  <CartesianGrid stroke="#E8E8EE" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip unit="entrenos" />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="count" fill="#FF2D2D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Volume trend */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionLabel>Volumen semanal (lb)</SectionLabel>
            {loading ? (
              <Skeleton height={180} style={{ border: 'none' }} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.weeklyData} barSize={16} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#E8E8EE" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip unit="lb" />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="volume" fill="#FF2D2D" radius={[6, 6, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Best lifts ── */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <SectionLabel>Mejores marcas (1RM estimado)</SectionLabel>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={40} />)}
            </div>
          ) : !data?.bestLifts?.length ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '16px 0' }}>
              Aún no hay datos. Empieza a registrar entrenos.
            </p>
          ) : (
            <div>
              {data.bestLifts.map((lift, i) => (
                <button
                  key={lift.name}
                  onClick={() => navigate(`/exercise/${encodeURIComponent(lift.name)}`)}
                  className="stagger-item"
                  style={{
                    animationDelay: `${i * 40}ms`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 0',
                    borderBottom: i < data.bestLifts.length - 1 ? '1px solid var(--c-border-subtle)' : 'none',
                    transition: `opacity 120ms var(--ease-out)`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ color: 'var(--c-text-ghost)', fontSize: '11px', fontWeight: 800, width: '18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </span>
                    <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                      {lift.name}
                    </span>
                  </div>
                  <span style={{ color: 'var(--c-text-secondary)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {lift.best1RM} <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--c-text-dim)' }}>{lift.unit}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Muscle group volume (last 7 days) ── */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginTop: '20px' }}>
          <SectionLabel>Volumen por músculo — últimos 7 días</SectionLabel>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={32} />)}
            </div>
          ) : !data?.muscleGroupData?.length ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '16px 0' }}>
              Sin datos esta semana. Registra un entreno para ver el desglose.
            </p>
          ) : (() => {
            const max = data.muscleGroupData[0].volume
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.muscleGroupData.map((mg, i) => (
                  <div key={mg.group} className="stagger-item" style={{ animationDelay: `${i * 35}ms` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--c-text)' }}>
                        {mg.group}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {mg.volume.toLocaleString()} lb
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--c-surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(mg.volume / max) * 100}%`,
                        background: i === 0 ? 'var(--c-accent)' : `oklch(${55 + i * 4}% 0.04 255)`,
                        borderRadius: '999px',
                        transition: 'width 600ms var(--ease-out)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </Layout>
  )
}
