import { useLang } from '../hooks/useLang'

/*
 * El día entero en un anillo.
 *
 * Dos lecturas a la vez, que es lo que hace que valga la pena frente a una
 * barra:
 *
 *   · CUÁNTO llevas — la porción de anillo pintada es kcal / objetivo. El
 *     hueco que queda es literalmente lo que te falta por comer.
 *   · DE QUÉ — dentro de esa porción, cada macro ocupa lo que aporta en
 *     calorías. Un día de 2.000 kcal casi todo azul es un día de carbos, y eso
 *     se ve sin leer un número.
 *
 * Un anillo de composición pura (solo el reparto, sin objetivo) es más bonito y
 * dice la mitad: enseña que comiste 40% carbos sin decir si comiste poco o
 * mucho. Aquí el objetivo es parte del dibujo.
 *
 * Pasado el objetivo el anillo se completa y ahí se queda: una segunda vuelta
 * se leería como si fueras por la mitad. Quién avisa de que te pasaste es la
 * cifra del centro y la línea de debajo, NO el color del anillo — en esta
 * paleta `--c-action` y `--c-data` son el mismo azul, así que teñirlo de
 * "alerta" no cambiaría un solo píxel. Y los segmentos siguen contando de qué
 * fue el día, que es información que no conviene perder justo cuando te
 * pasaste.
 */

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

// Toda la geometría sale de `size`: el grosor, el radio y hasta el cuerpo de
// la cifra. Así el mismo anillo sirve en la pantalla de Nutrición y, más
// pequeño, en la portada, sin dos juegos de números que mantener a mano.
export default function CalorieRing({ kcal = 0, target = 0, protein = 0, carbs = 0, fat = 0, size = 132 }) {
  const { locale } = useLang()

  const stroke = size * 0.0985            // 13 a 132
  const R = (size - stroke) / 2
  const CIRC = 2 * Math.PI * R

  const pTotal = Math.max(0, Number(protein) || 0) * KCAL_PER_G.protein
  const cTotal = Math.max(0, Number(carbs) || 0) * KCAL_PER_G.carbs
  const fTotal = Math.max(0, Number(fat) || 0) * KCAL_PER_G.fat
  const macroKcal = pTotal + cTotal + fTotal

  const eaten = Math.max(0, Number(kcal) || 0)
  const goal = Number(target) > 0 ? Number(target) : 0
  const over = goal > 0 && eaten > goal
  // Fracción de anillo pintada. Sin objetivo no hay nada contra lo que medir,
  // así que el anillo se queda vacío en vez de fingir un 100%.
  const filled = goal > 0 ? Math.min(1, eaten / goal) : 0

  // Los segmentos reparten la porción pintada según lo que aporta cada macro.
  // Si las kcal registradas no cuadran con los macros —se puede escribir un
  // número de calorías a mano— manda el reparto de los macros para el color y
  // la cifra del centro sigue siendo la que se registró.
  const segs = macroKcal > 0
    ? [
        { key: 'protein', frac: pTotal / macroKcal, color: 'var(--c-data)' },
        { key: 'carbs',   frac: cTotal / macroKcal, color: 'var(--c-data-2)' },
        { key: 'fat',     frac: fTotal / macroKcal, color: 'var(--c-data-3)' },
      ]
    : []

  let offset = 0
  const arcs = segs.map(s => {
    const len = s.frac * filled * CIRC
    const arc = { ...s, len, start: offset }
    offset += len
    return arc
  })

  const fmt = (n) => Math.round(n).toLocaleString(locale)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label={goal > 0 ? `${fmt(eaten)} de ${fmt(goal)} kcal` : `${fmt(eaten)} kcal`}
      >
        {/* Carril: lo que falta por comer. */}
        <circle
          cx={size / 2} cy={size / 2} r={R} fill="none"
          stroke="var(--c-surface-2)" strokeWidth={stroke}
        />
        {arcs.map(a => (
          <circle
            key={a.key}
            cx={size / 2} cy={size / 2} r={R} fill="none"
            stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.len} ${CIRC - a.len}`}
            strokeDashoffset={-a.start}
            style={{ transition: 'stroke-dasharray 600ms var(--ease-out), stroke-dashoffset 600ms var(--ease-out)' }}
          />
        ))}
      </svg>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span className="tnum" style={{
          fontFamily: 'var(--font-sans)', fontSize: `${size * 0.212}px`, fontWeight: 900,
          letterSpacing: '-0.04em', lineHeight: 1,
          color: over ? 'var(--c-action-text)' : 'var(--c-text)',
        }}>
          {fmt(eaten)}
        </span>
        <span className="tnum" style={{
          fontFamily: 'var(--font-sans)', fontSize: `${size * 0.08}px`, fontWeight: 700,
          letterSpacing: '-0.01em', color: 'var(--c-text-muted)', marginTop: '3px',
        }}>
          {goal > 0 ? `/ ${fmt(goal)} kcal` : 'kcal'}
        </span>
      </div>
    </div>
  )
}
