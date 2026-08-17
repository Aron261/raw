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

// Volumen en el tiempo.
//
// Era solo mensual, y eso mentía dos veces al mes: el mes en curso siempre está
// a medias, así que su barra parecía un desplome hasta el día 25, y el delta
// «este mes ▼ 60 % vs. el anterior» daba una mala noticia falsa a principios de
// cada mes.
//
// Ahora la vista por defecto son 12 semanas —la semana es la unidad en que se
// escriben los programas y la que ya está cerrada casi siempre— y la mensual
// sigue disponible, pero comparando los dos últimos meses COMPLETOS y marcando
// el actual como en curso. Un periodo a medias no se compara con uno entero.

const RANGE_OPTIONS = [
  { id: 'w12', label: '12 sem' },
  { id: 'm6',  label: '6 M' },
  { id: 'm12', label: '12 M' },
]

export default function VolumeTrendModule({ data }) {
  const { t, locale } = useLang()
  const colors = useChartColors()
  const [range, setRange] = useState('w12')

  const months = data?.volumeByMonth || []
  const weeks = data?.weeklyActivity || []
  const byWeek = range === 'w12'

  const chartData = byWeek
    ? weeks
    : (range === 'm6' ? months.slice(-6) : months)

  const hasData = chartData.some(d => d.volume > 0)
  const lastIdx = chartData.length - 1

  // La comparación siempre entre dos periodos CERRADOS: en semanas, las dos
  // anteriores a la actual; en meses, los dos anteriores al actual.
  const closed = byWeek ? weeks.slice(0, -1) : months.slice(0, -1)
  const cur = closed[closed.length - 1]?.volume || 0
  const prev = closed[closed.length - 2]?.volume || 0
  const deltaPct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
  const up = deltaPct != null && deltaPct >= 0

  // El periodo en curso lleva subrayado además del color: en el gimnasio no se
  // puede confiar en distinguir dos tonos del mismo azul.
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
    <section>
      <SectionHeader
        subtitle={byWeek ? t('Kg totales por semana.') : t('Kg totales por mes.')}
        right={<Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel={t('Rango de volumen')} />}
      />

      {deltaPct != null && (
        <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '-4px', marginBottom: '10px', color: 'var(--c-text-muted)' }}>
          {byWeek ? t('Última semana cerrada') : t('Último mes cerrado')}{' '}
          <span style={{ color: up ? 'var(--c-success)' : 'var(--c-action-text)', fontWeight: 800 }}>
            {up ? '▲' : '▼'} {Math.abs(deltaPct)}%
          </span>{' '}
          {t('vs. el anterior')}
        </p>
      )}

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-muted)', fontSize: '11px', border: '1px dashed var(--c-border-subtle)', borderRadius: 'var(--r-md)' }}>
          {t('Sin entrenos registrados todavía')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={range === 'm6' ? 26 : 16} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis
              dataKey="label"
              tick={renderTick}
              axisLine={false} tickLine={false}
              interval={byWeek ? 1 : 0}
              height={24}
            />
            <YAxis hide />
            <Tooltip
              content={<ChartTooltip format={(v) => `${formatVolume(v, locale, { empty: '0' })} kg`} />}
              cursor={{ fill: colors.cursor }}
            />
            {/* Un solo tono: el periodo en curso a plena intensidad y los demás
                bajando la opacidad. Antes el actual usaba un color propio, y
                con una sola paleta eso obligaba a inventarse un segundo azul
                para una barra. */}
            {/* minPointSize como función deja un tocón de 3px en los periodos a
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

      <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, marginTop: '6px' }}>
        {byWeek ? t('La última barra es la semana en curso, todavía a medias.') : t('La última barra es el mes en curso, todavía a medias.')}
      </p>
    </section>
  )
}
