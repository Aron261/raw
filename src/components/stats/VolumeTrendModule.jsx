import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import SectionHeader from './SectionHeader'
import Segmented from './Segmented'
import { useLang } from '../../hooks/useLang'
import { useChartColors } from '../../lib/chartColors'
import { ChartTooltip } from '../charts/chartTheme'
import { formatVolume } from '../../lib/format'


const RANGE_OPTIONS = [{ id: '6', label: '6M' }, { id: '12', label: '12M' }]

export default function VolumeTrendModule({ data }) {
  const { t, locale } = useLang()
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
            <Tooltip
              content={<ChartTooltip format={(v) => `${formatVolume(v, locale, { empty: '0' })} kg`} />}
              cursor={{ fill: colors.cursor }}
            />
            {/* Un solo tono: el mes en curso a plena intensidad y los demás
                bajando la opacidad. Antes el actual usaba un color propio, y
                con una sola paleta eso obligaba a inventarse un segundo azul
                para una barra. */}
            {/* minPointSize como función deja un tocón de 3px en los meses a
                cero. Sin él, una barra de altura cero no dibuja nada y nueve
                meses sin entrenar se leían como una gráfica rota en vez de
                como nueve meses sin entrenar. */}
            <Bar
              dataKey="volume"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
              minPointSize={(v) => (v > 0 ? 2 : 3)}
            >
              {chartData.map((entry, i) => {
                const empty = entry.volume === 0
                return (
                  <Cell
                    key={i}
                    fill={empty ? colors.empty : colors.bar}
                    fillOpacity={empty || i === lastIdx ? 1 : 0.42}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
