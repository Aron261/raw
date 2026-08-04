import { useLang } from '../hooks/useLang'

/*
 * Los tres macros al lado del anillo.
 *
 * Cada fila dice dos cosas distintas y las dos hacen falta:
 *
 *   · el % de las CALORÍAS que aporta ese macro — es lo que colorea el anillo,
 *     así que la fila es la leyenda de lo que se está viendo;
 *   · los gramos sobre el objetivo — que es lo accionable: «me faltan 44 g de
 *     proteína» se puede resolver, «llevas el 31%» no.
 *
 * La barrita de debajo es progreso hacia el objetivo, no el reparto: el reparto
 * ya lo cuenta el anillo y repetirlo dos veces habría sido gastar sitio en
 * decir lo mismo.
 */

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

function Row({ label, grams, target, per, color, pctKcal, locale }) {
  const g = Math.max(0, Number(grams) || 0)
  const goal = Number(target) > 0 ? Number(target) : 0
  const pct = goal > 0 ? Math.min(100, (g / goal) * 100) : 0
  const fmt = (n) => Math.round(n).toLocaleString(locale)

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '3px' }}>
        <span
          aria-hidden
          style={{ flexShrink: 0, width: '8px', height: '8px', borderRadius: '2px', background: color }}
        />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)' }}>
          {label}
        </span>
        <span className="tnum" style={{ marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700, color: 'var(--c-text-muted)' }}>
          {pctKcal}%
        </span>
      </div>
      <p className="tnum" style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--c-text)', marginBottom: '5px' }}>
        {fmt(g)}
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-muted)' }}> / {fmt(goal)} g</span>
      </p>
      <div
        style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      >
        <div style={{
          height: '100%', width: '100%',
          transformOrigin: 'left center', transform: `scaleX(${pct / 100})`,
          background: color, borderRadius: '999px',
          transition: 'transform 500ms var(--ease-out)',
        }} />
      </div>
    </div>
  )
}

export default function MacroLegend({ totals, targets }) {
  const { t, locale } = useLang()

  const p = Math.max(0, Number(totals?.protein) || 0)
  const c = Math.max(0, Number(totals?.carbs) || 0)
  const f = Math.max(0, Number(totals?.fat) || 0)
  const macroKcal = p * KCAL_PER_G.protein + c * KCAL_PER_G.carbs + f * KCAL_PER_G.fat
  const share = (grams, per) => (macroKcal > 0 ? Math.round((grams * per * 100) / macroKcal) : 0)

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Row label={t('Proteína')} grams={p} target={targets?.protein_g} per={4} color="var(--c-data)"   pctKcal={share(p, 4)} locale={locale} />
      <Row label={t('Carbos')}   grams={c} target={targets?.carbs_g}   per={4} color="var(--c-data-2)" pctKcal={share(c, 4)} locale={locale} />
      <Row label={t('Grasa')}    grams={f} target={targets?.fat_g}     per={9} color="var(--c-data-3)" pctKcal={share(f, 9)} locale={locale} />
    </div>
  )
}
