import { useLang } from '../../hooks/useLang'
import { formatVolume, formatCount } from '../../lib/format'

// All-time totals — the page hero. One dominant number (total volume lifted),
// with workouts + sets as subordinate stats. The number is the hero.


function SubStat({ value, label }) {
  return (
    <div>
      <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 400, letterSpacing: '-0.01em', marginTop: '5px' }}>
        {label}
      </p>
    </div>
  )
}

export default function TotalsModule({ data }) {
  // Se llamaba `t`, que es como se llama la función de traducción en todo el
  // resto del código: aquí la sombreaba y hacía imposible usar useLang sin
  // romper cuatro líneas por accidente.
  const totals = data?.totals || { workouts: 0, volume: 0, sets: 0 }
  const c = data?.consistency
  const { t, locale } = useLang()

  // El total histórico solo sube, así que por sí solo no informa de nada: la
  // línea de debajo dice qué has movido en las últimas 4 semanas y si eso es
  // más o menos que en las 4 anteriores. Es la diferencia entre una vitrina y
  // un instrumento.
  const up = c?.deltaVolume != null && c.deltaVolume >= 0

  return (
    <section>
      {/* Hero: total volume lifted */}
      <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '64px', letterSpacing: '-0.04em', lineHeight: 0.82 }}>
        {formatVolume(totals.volume, locale, { empty: '0' })}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text-dim)', marginLeft: '6px' }}>kg</span>
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '8px' }}>
        {t('levantados en total')}
      </p>

      {c && c.volume4 > 0 && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '6px' }}>
          <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
            {formatVolume(c.volume4, locale, { empty: '0' })} kg
          </span>{' '}
          {t('en las últimas 4 semanas')}
          {c.deltaVolume != null && (
            <>
              {' · '}
              <span style={{ color: up ? 'var(--c-success)' : 'var(--c-action-text)', fontWeight: 800 }}>
                {up ? '▲' : '▼'} {Math.abs(c.deltaVolume)}%
              </span>
            </>
          )}
        </p>
      )}

      {/* Subordinate stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
        <SubStat value={formatCount(totals.workouts, locale)} label={totals.workouts === 1 ? 'entreno' : 'entrenos'} />
        <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--c-border-subtle)' }} />
        <SubStat value={formatCount(totals.sets, locale)} label={totals.sets === 1 ? 'serie' : 'series'} />
      </div>
    </section>
  )
}
