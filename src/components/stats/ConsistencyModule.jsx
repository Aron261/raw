import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import SectionHeader from './SectionHeader'
import { useLang } from '../../hooks/useLang'
import { useChartColors } from '../../lib/chartColors'
import { ChartTooltip } from '../charts/chartTheme'

// Constancia — cada cuánto entrenas de verdad.
//
// Era el agujero grande de Estadísticas: la página sabía cuántos kilos habías
// levantado desde siempre y cuál era tu mejor 1RM, pero no si llevabas tres
// semanas sin aparecer. La frecuencia es lo que de verdad predice el progreso y
// era justo lo que no se podía ver.
//
// La cifra grande son sesiones por semana en las últimas cuatro (la semana en
// curso queda fuera: está a medias). Debajo, la comparación con las cuatro
// anteriores, la racha, el hueco más largo y —si has planeado algo— cuánto de
// lo planeado cumpliste.

function Figure({ value, unit, label, tone = 'text' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        color: tone === 'dim' ? 'var(--c-text-dim)' : 'var(--c-text)',
        fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 900,
        letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {unit && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)', marginLeft: '3px' }}>
            {unit}
          </span>
        )}
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 400, letterSpacing: '-0.01em', marginTop: '5px' }}>
        {label}
      </p>
    </div>
  )
}

const Divider = () => (
  <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--c-border-subtle)' }} />
)

export default function ConsistencyModule({ data }) {
  const { t, locale } = useLang()
  const colors = useChartColors()

  const c = data?.consistency
  const weeks = data?.weeklyActivity || []
  const adh = data?.adherence
  if (!c) return null

  const hasWeeks = weeks.some(w => w.sessions > 0)
  const up = c.deltaPerWeek != null && c.deltaPerWeek >= 0

  // Sesiones por semana con un decimal solo cuando hace falta: "3 por semana"
  // se lee mejor que "3,0 por semana".
  const perWeek = c.perWeek.toLocaleString(locale, { maximumFractionDigits: 1 })

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title={t('Constancia')}
        subtitle={t('Sesiones por semana en las últimas 4 semanas completas.')}
      />

      <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '48px', letterSpacing: '-0.04em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>
        {perWeek}
        <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text-dim)', marginLeft: '6px' }}>
          {t('por semana')}
        </span>
      </p>

      {c.deltaPerWeek != null ? (
        <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', color: 'var(--c-text-muted)' }}>
          <span style={{ color: up ? 'var(--c-success)' : 'var(--c-action-text)', fontWeight: 800 }}>
            {up ? '▲' : '▼'} {Math.abs(c.deltaPerWeek)}%
          </span>{' '}
          {t('vs. las 4 anteriores')} ({c.prevPerWeek.toLocaleString(locale, { maximumFractionDigits: 1 })}/{t('sem')})
        </p>
      ) : (
        <p style={{ fontSize: '12px', fontWeight: 500, marginTop: '8px', color: 'var(--c-text-muted)' }}>
          {t('Todavía no hay un periodo anterior con el que compararte.')}
        </p>
      )}

      {/* Sesiones por semana — 12 semanas. En barras porque la pregunta es
          "¿cuántas semanas me salté?", y un hueco se ve mejor que se lee. */}
      {hasWeeks && (
        <div style={{ marginTop: '18px' }}>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={weeks} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 9, fontWeight: 700 }}
                axisLine={false} tickLine={false} interval={2} height={20}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                content={<ChartTooltip format={(v) => `${v} ${v === 1 ? t('sesión') : t('sesiones')}`} />}
                cursor={{ fill: colors.cursor }}
              />
              <Bar dataKey="sessions" radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={(v) => (v > 0 ? 2 : 3)}>
                {weeks.map((wk, i) => {
                  const empty = wk.sessions === 0
                  return (
                    <Cell
                      key={i}
                      fill={empty ? colors.empty : colors.bar}
                      fillOpacity={empty || wk.current ? 1 : 0.42}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '18px' }}>
        <Figure
          value={c.streakWeeks}
          label={c.streakWeeks === 1 ? t('semana seguida') : t('semanas seguidas')}
        />
        <Divider />
        <Figure
          value={c.daysSinceLast == null ? '—' : c.daysSinceLast}
          label={c.daysSinceLast === 1 ? t('día sin entrenar') : t('días sin entrenar')}
        />
        {c.longestGapDays > 0 && (
          <>
            <Divider />
            <Figure value={c.longestGapDays} label={t('hueco más largo (90 d)')} tone="dim" />
          </>
        )}
      </div>

      {/* Adherencia — solo si hay algo planeado. Sin calendario esto sería una
          barra al 0 % culpando de un plan que nunca existió. */}
      {adh && (
        <div style={{
          marginTop: '18px', padding: '14px 16px',
          background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
          boxShadow: 'var(--e-1)', borderRadius: 'var(--r-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {t('Cumpliste lo que planeaste')}
            </span>
            <span style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '14px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
              {adh.pct}%
            </span>
          </div>
          <div style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}
            role="progressbar" aria-valuenow={adh.pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={t('Cumpliste lo que planeaste')}
          >
            <div style={{
              height: '100%', width: '100%', transformOrigin: 'left center',
              transform: `scaleX(${adh.pct / 100})`,
              background: 'var(--c-action)', borderRadius: '999px',
              transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, marginTop: '6px' }}>
            {t('{done} de {planned} sesiones planeadas en 8 semanas', { done: adh.done, planned: adh.planned })}
          </p>
        </div>
      )}
    </section>
  )
}
