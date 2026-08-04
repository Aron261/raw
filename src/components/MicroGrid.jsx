import { PRIORITY, NUTRIENT_BY_KEY } from '../lib/nutrients'
import { useLang } from '../hooks/useLang'

/*
 * Los nueve micros que se siguen de cerca, en la propia pantalla del día.
 *
 * En porcentaje del objetivo y no en cantidad absoluta, por una razón: nadie
 * sabe si 340 mg de calcio es mucho o poco, y todo el mundo entiende un 34%.
 * La cantidad exacta sigue estando —en la hoja completa, con las unidades— para
 * cuando hace falta el número.
 *
 * Pasar del 100% NO es un problema aquí: los nueve son pisos, cosas que hay que
 * alcanzar. Por eso la barra se llena y se queda verde en vez de ponerse en
 * alerta, y el porcentaje sigue contando por encima de cien: 238% de vitamina C
 * es un dato, no un aviso. Los cuatro techos —sodio, azúcar, grasa saturada y
 * colesterol— no están en esta rejilla precisamente porque ahí pasarse SÍ
 * importa, y mezclarlos enseñaría a leer las dos cosas igual.
 */
export default function MicroGrid({ totals, targets, onOpenAll }) {
  const { t } = useLang()
  const tm = targets?.micros || {}
  const cur = totals?.micros || {}

  // «Sin dato» y «cero» no son lo mismo, y aquí se nota más que en ningún
  // sitio: si una comida no reportó vitamina C, pintar 0% dice que no comiste
  // nada de vitamina C, que es falso y además desanima a seguir registrando.
  // Una clave que no aparece en NINGUNA comida del día sale con un guion.
  const filas = PRIORITY.map(n => {
    const objetivo = Number(tm[n.key]) || 0
    const reportado = cur[n.key] !== undefined && cur[n.key] !== null
    const valor = Number(cur[n.key]) || 0
    return {
      ...n,
      objetivo,
      reportado,
      pct: objetivo > 0 && reportado ? Math.round((valor / objetivo) * 100) : null,
    }
  })

  // El denominador son los que SE SABEN, no los nueve: «1 de 9» cuando de
  // cuatro no hay dato culpa al usuario de un hueco que es de información.
  const medibles = filas.filter(f => f.pct !== null)
  const cumplidos = medibles.filter(f => f.pct >= 100).length
  const conObjetivo = filas.filter(f => f.objetivo > 0)

  return (
    <section className="fade-in material" style={{ padding: '18px', marginBottom: '22px', animationDelay: '60ms' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
          {t('Micros')}
        </h2>
        {medibles.length > 0 && (
          <span className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
            {t('{ok} de {total}', { ok: cumplidos, total: medibles.length })}
          </span>
        )}
      </div>

      {conObjetivo.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12.5px', lineHeight: 1.5 }}>
          {t('Sin objetivos de micros todavía. La app puede calcularlos con tu peso, tu grasa y tu fase.')}
        </p>
      ) : (
        <div className="grid grid-cols-2" style={{ gap: '14px 18px' }}>
          {filas.map(f => {
            const sinDato = f.pct === null
            const lleno = !sinDato && f.pct >= 100
            return (
              <div key={f.key} style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                    letterSpacing: '-0.01em', color: 'var(--c-text-dim)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t(f.label)}
                  </span>
                  <span className="tnum" style={{
                    marginLeft: 'auto', flexShrink: 0,
                    fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 800,
                    letterSpacing: '-0.01em',
                    color: sinDato ? 'var(--c-text-ghost)' : lleno ? 'var(--c-success)' : 'var(--c-text)',
                  }}>
                    {sinDato ? '—' : `${f.pct}%`}
                  </span>
                </div>
                <div
                  style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}
                  role="progressbar"
                  aria-valuenow={sinDato ? 0 : Math.min(100, f.pct)}
                  aria-valuemin={0} aria-valuemax={100} aria-label={t(f.label)}
                >
                  <div style={{
                    height: '100%', width: '100%',
                    transformOrigin: 'left center',
                    transform: `scaleX(${sinDato ? 0 : Math.min(100, f.pct) / 100})`,
                    background: lleno ? 'var(--c-success)' : 'var(--c-data)',
                    borderRadius: '999px',
                    transition: 'transform 500ms var(--ease-out)',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onOpenAll}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          marginTop: '16px', paddingTop: '14px',
          background: 'transparent',
          border: 'none', borderTop: '1px solid var(--c-border-subtle)',
          fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '-0.01em', color: 'var(--c-action-text)', cursor: 'pointer',
        }}
      >
        {t('Ver los 16 y la cobertura del día ›')}
      </button>
    </section>
  )
}
