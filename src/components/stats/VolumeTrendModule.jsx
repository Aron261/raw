import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import { useTheme } from '../../hooks/useTheme'

// Monthly volume trend. Hex per palette+theme — CSS vars don't resolve in
// recharts SVG attrs (same pattern as Home / ExerciseDetail).
const CHART_COLORS = {
  'slate-light': { axis: '#565C64', bar: '#3E5C76', current: '#1A1D21', empty: '#DDE0E4' },
  'slate-dark':  { axis: '#9AA0A8', bar: '#7FA0BE', current: '#E9EBEE', empty: '#2F343B' },
  'riso-light':  { axis: '#5A584F', bar: '#2438FF', current: '#FF2E7E', empty: '#D5D2C7' },
  'riso-dark':   { axis: '#A2A096', bar: '#6E7BFF', current: '#FF3D86', empty: '#26271F' },
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value || 0
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: '8px', padding: '6px 10px',
      fontSize: '10px', fontWeight: 700, color: 'var(--c-text)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    }}>
      {label}: {val > 0 ? `${(val / 1000).toFixed(1)}k kg` : '—'}
    </div>
  )
}

export default function VolumeTrendModule({ data }) {
  const { resolved, palette } = useTheme()
  const colors = CHART_COLORS[`${palette}-${resolved}`] || CHART_COLORS['slate-light']
  const chartData = data?.volumeByMonth || []
  const hasData = chartData.some(d => d.volume > 0)
  const lastIdx = chartData.length - 1

  return (
    <section style={{ marginBottom: '32px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        Volumen por mes
      </p>
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)',
        borderRadius: '16px',
        padding: '20px 8px 12px',
        overflow: 'hidden',
      }}>
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-muted)', fontSize: '11px' }}>
            Sin entrenos registrados todavía
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={chartData} barSize={16} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 10, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="volume" radius={[5, 5, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.volume > 0 ? (i === lastIdx ? colors.current : colors.bar) : colors.empty}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
