import { Sheet } from './ui'
import MacroBar from './MacroBar'
import { CEILINGS, FLOORS } from '../lib/nutrients'
import { useLang } from '../hooks/useLang'

/*
 * Los micros del día.
 *
 * Dos decisiones que sostienen esta pantalla:
 *
 * 1. TECHOS PRIMERO. Sodio, los dos azúcares, grasa saturada y colesterol
 *    vienen de etiqueta, así que son los más fiables que va a haber aquí — y son
 *    los que se pasan, no los que faltan. Ponerlos arriba, separados y con su
 *    propio encabezado enseña la diferencia entre «alcanzar» y «no pasarse»
 *    mejor que cualquier color.
 *
 * 2. LA COBERTURA SE DICE EN VOZ ALTA. En la base, una clave ausente significa
 *    «desconocido», pero una barra de progreso no tiene ese estado: pinta cero.
 *    Si de siete comidas solo tres traen micros, «el sodio de hoy» es en
 *    realidad «el sodio que conocemos». Sin esa línea la pantalla sería
 *    aritmética correcta contando una cosa que no es verdad.
 */
export default function NutritionMicrosSheet({ totals, targets, entryCount = 0, coveredCount = 0, onOpenTargets, onClose }) {
  const { t, locale } = useLang()
  const tMicros = targets?.micros || {}
  const hayObjetivos = Object.keys(tMicros).length > 0

  const grupo = (titulo, lista, overIsGood) => (
    <section style={{ marginBottom: '22px' }}>
      <h3 style={{
        fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 800,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: 'var(--c-text-muted)', marginBottom: '12px',
      }}>
        {titulo}
      </h3>
      {/* Las columnas van por clase y no en línea: un gridTemplateColumns
          inline ganaría a la utilidad `md:` y el breakpoint no haría nada. */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '14px 18px' }}>
        {lista.map(n => {
          const objetivo = Number(tMicros[n.key]) || 0
          if (objetivo <= 0) {
            return (
              <div key={n.key} style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '5px' }}>
                  {t(n.label)}
                </p>
                <p className="tnum" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--c-text-ghost)' }}>—</p>
              </div>
            )
          }
          // Ausente ≠ cero: si ninguna comida reportó este nutriente, la barra
          // en «0 / techo» leía como un día impecable de sodio — justo la
          // mentira contra la que avisa el propio contrato de micros. El guion
          // dice la verdad: no se sabe. (MicroGrid ya lo hacía; esta hoja no.)
          if (totals?.micros?.[n.key] === undefined) {
            return (
              <div key={n.key} style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '5px' }}>
                  {t(n.label)}
                </p>
                <p className="tnum" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--c-text-ghost)' }}>
                  — <span style={{ fontWeight: 400, fontSize: '11px' }}>/ {objetivo} {n.unit}</span>
                </p>
              </div>
            )
          }
          return (
            <MacroBar
              key={n.key}
              label={t(n.label)}
              current={Number(totals?.micros?.[n.key]) || 0}
              target={objetivo}
              unit={n.unit}
              decimals={n.decimals}
              locale={locale}
              overIsGood={overIsGood}
            />
          )
        })}
      </div>
    </section>
  )

  return (
    <Sheet title={t('Micros del día')} onClose={onClose} maxHeight="92dvh">
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', lineHeight: 1.55, marginBottom: '6px' }}>
        {entryCount === 0
          ? t('Todavía no has registrado nada hoy.')
          : t('{n} de {total} comidas de hoy traen micros. Lo que falta no cuenta como cero: sencillamente no lo sabemos.', { n: coveredCount, total: entryCount })}
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', lineHeight: 1.55, marginBottom: '20px' }}>
        {t('Son estimaciones a partir de lo que comes, no una medición.')}
      </p>

      {hayObjetivos ? (
        <>
          {grupo(t('No pasarse'), CEILINGS, false)}
          {grupo(t('Alcanzar'), FLOORS, true)}
        </>
      ) : (
        <div style={{ padding: '4px 0 8px' }}>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '12px' }}>
            {t('Todavía no tienes objetivos de micros. La app puede calcularlos con tu peso, tu grasa y tu fase.')}
          </p>
          {onOpenTargets && (
            <button
              onClick={onOpenTargets}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '-0.01em', color: 'var(--c-action-text)',
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              {t('Calcular objetivos →')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
