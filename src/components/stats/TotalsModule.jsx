// All-time totals — number-as-hero. Mirrors Home's "Esta semana" 3-up grid.

function formatVolume(v) {
  if (!v) return '—'
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

function formatCount(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString()
}

export default function TotalsModule({ data }) {
  const t = data?.totals || { workouts: 0, volume: 0, sets: 0 }
  const cells = [
    { value: formatCount(t.workouts), label: t.workouts === 1 ? 'entreno' : 'entrenos' },
    { value: formatVolume(t.volume), label: 'kg levantados' },
    { value: formatCount(t.sets), label: t.sets === 1 ? 'serie' : 'series' },
  ]

  return (
    <section style={{ marginBottom: '32px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        Histórico
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {cells.map((c, i) => (
          <div key={c.label} style={{ paddingLeft: i > 0 ? '16px' : 0, borderLeft: i > 0 ? '1px solid var(--c-border-subtle)' : 'none' }}>
            <p style={{ color: 'var(--c-text)', fontFamily: 'var(--font-display)', fontSize: '42px', letterSpacing: '0.01em', lineHeight: 0.9, marginBottom: '8px' }}>
              {c.value}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 400, letterSpacing: '0.03em', lineHeight: 1.3 }}>
              {c.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
