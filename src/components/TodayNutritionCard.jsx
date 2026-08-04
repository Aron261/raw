import CalorieRing from './CalorieRing'
import { useLang } from '../hooks/useLang'

/*
 * La comida de hoy, en la portada.
 *
 * Antes esto era un chip entre cuatro, del tamaño de «Racha» y «Peso
 * corporal». Para algo que se mira varias veces al día y se corrige sobre la
 * marcha, un chip es un pie de página.
 *
 * Va ENCIMA del gráfico de volumen a propósito: el volumen semanal se consulta
 * de vez en cuando y esto se consulta antes de cada comida. Y solo lleva el
 * anillo y las calorías: los macros y los micros están a un toque, y meterlos
 * aquí convertiría la portada en una segunda pantalla de nutrición.
 *
 * El anillo sigue viniendo segmentado por macros aunque no haya leyenda: es el
 * mismo dibujo que dentro, más pequeño, y eso es lo que hace que se reconozca
 * como «lo mismo» en vez de como otro widget.
 */
export default function TodayNutritionCard({ totals, targets, onOpen }) {
  const { t, locale } = useLang()

  const kcal = Math.round(Number(totals?.kcal) || 0)
  const goal = Math.round(Number(targets?.kcal) || 0)
  const registrado = kcal > 0
  const restante = goal - kcal
  const fmt = (n) => Math.round(n).toLocaleString(locale)

  return (
    <button
      onClick={onOpen}
      className="fade-in material pressable"
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '16px 18px', marginBottom: '28px',
        animationDelay: '50ms',
      }}
    >
      <CalorieRing
        size={104}
        kcal={kcal}
        target={goal}
        protein={totals?.protein}
        carbs={totals?.carbs}
        fat={totals?.fat}
      />

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
          {t('Comida de hoy')}
        </span>
        <span className="tnum" style={{
          display: 'block', marginTop: '5px',
          fontFamily: 'var(--font-sans)', fontSize: '12.5px', fontWeight: 700,
          letterSpacing: '-0.01em', lineHeight: 1.4,
          color: !registrado ? 'var(--c-text-muted)'
            : restante < 0 ? 'var(--c-action-text)' : 'var(--c-text-dim)',
        }}>
          {!registrado
            ? t('Aún sin registrar')
            : goal <= 0 ? t('Sin objetivo de calorías')
              : restante >= 0
                ? t('Quedan {n} kcal', { n: fmt(restante) })
                : t('{n} kcal por encima', { n: fmt(-restante) })}
        </span>
        <span style={{
          display: 'block', marginTop: '8px',
          fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
          letterSpacing: '-0.01em', color: 'var(--c-action-text)',
        }}>
          {registrado ? t('Ver el día ›') : t('Registrar ›')}
        </span>
      </span>
    </button>
  )
}
