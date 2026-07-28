// All-time totals — the page hero. One dominant number (total volume lifted),
// with workouts + sets as subordinate stats. The number is the hero.

function formatVolume(v) {
  if (!v) return '0'
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

function formatCount(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

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
  const t = data?.totals || { workouts: 0, volume: 0, sets: 0 }

  return (
    <section style={{ marginBottom: '40px' }}>
      {/* Hero: total volume lifted */}
      <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '64px', letterSpacing: '-0.04em', lineHeight: 0.82 }}>
        {formatVolume(t.volume)}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text-dim)', marginLeft: '6px' }}>kg</span>
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '8px' }}>
        levantados en total
      </p>

      {/* Subordinate stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
        <SubStat value={formatCount(t.workouts)} label={t.workouts === 1 ? 'entreno' : 'entrenos'} />
        <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--c-border-subtle)' }} />
        <SubStat value={formatCount(t.sets)} label={t.sets === 1 ? 'serie' : 'series'} />
      </div>
    </section>
  )
}
