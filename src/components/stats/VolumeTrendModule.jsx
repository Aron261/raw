import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import { useTheme } from '../../hooks/useTheme'
import SectionHeader from './SectionHeader'
import Segmented from './Segmented'
import { useLang } from '../../hooks/useLang'
import { useChartColors } from '../../lib/chartColors'


function ChartTooltip({ active, payload, label }) {
  const { t } = useLang()
  if (!active || !payload?.length) return null
  const val = payload[0]?.value || 0
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-xs)', padding: '6px 10px',
      fontSize: '10px', fontWeight: 700, color: 'var(--c-text)',
      boxShadow: 'var(--e-2)',
    }}>
      {label}: {val > 0 ? `${(val / 1000).toFixed(1)}k kg` : '—'}
    </div>
  )
}

const RANGE_OPTIONS = [{ id: '6', label: '6M' }, { id: '12', label: '12M' }]

export default function VolumeTrendModule({ data }) {
  const { t } = useLang()
  const colors = useChartColors()
  const [range, setRange] = useState('12')

  const all = data?.volumeByMonth || []
  const chartData = range === '6' ? all.slice(-6) : all
  const hasData = chartData.some(d => d.volume > 0)
  const lastIdx = chartData.length - 1

  // Delta: current month vs previous.
  const cur = all[all.length - 1]?.volume || 0
  const prev = all[all.length - 2]?.volume || 0
  const deltaPct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
  const up = deltaPct != null && deltaPct >= 0

  // Current month gets a bold, accent-colored axis label (not color alone).
  const renderTick = ({ x, y, payload, index }) => {
    const isCurrent = index === lastIdx
    return (
      <text
        x={x} y={y + 12} textAnchor="middle"
        fill={isCurrent ? colors.current : colors.axis}
        fontSize={10} fontWeight={isCurrent ? 800 : 700}
        style={{ textDecoration: isCurrent ? 'underline' : 'none' }}
      >
        {payload.value}
      </text>
    )
  }

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title="Volumen"
        subtitle={deltaPct != null
          ? undefined
          : 'Kg totales por mes.'}
        right={all.length > 6 ? <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel="Rango de meses" /> : null}
      />

      {deltaPct != null && (
        <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '-4px', marginBottom: '10px', color: 'var(--c-text-muted)' }}>
          Este mes{' '}
          <span style={{ color: up ? 'var(--c-success)' : 'var(--c-action-text)', fontWeight: 800 }}>
            {up ? '▲' : '▼'} {Math.abs(deltaPct)}%
          </span>{' '}
          vs. el anterior
        </p>
      )}

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-muted)', fontSize: '11px', border: '1px dashed var(--c-border-subtle)', borderRadius: 'var(--r-md)' }}>
          {t('Sin entrenos registrados todavía')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={range === '6' ? 26 : 16} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="label" tick={renderTick} axisLine={false} tickLine={false} interval={0} height={24} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="volume" radius={[5, 5, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.volume > 0 ? (i === lastIdx ? colors.current : colors.bar) : colors.empty} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
