import { useLang } from '../hooks/useLang'

/*
 * Elegir el porcentaje de grasa mirando, no midiendo.
 *
 * Casi nadie tiene un DEXA ni un plicómetro, pero casi todo el mundo sabe si
 * se le marcan los abdominales. Con ese dato el cálculo de calorías pasa de
 * Mifflin-St Jeor (peso, altura, edad) a Katch-McArdle (masa magra), y la
 * proteína pasa a fijarse sobre el músculo en vez de sobre la báscula.
 *
 * Es una estimación y la app lo dice: se guarda con body_fat_source =
 * 'estimado' y la recomendación avisa de que cuenta con ±5 puntos. Vender esto
 * como una medición sería el error.
 *
 * La silueta es UNA sola forma cuyo contorno se interpola desde el porcentaje.
 * Catorce dibujos (siete por sexo) serían catorce archivos que mantener, que no
 * se tematizan y que hay que rehacer si mañana se añade un tramo.
 */

const C = 20                       // centro del viewBox

// Semianchos por tramo. La cintura es la que más se mueve —es lo que de verdad
// cambia con la grasa—; hombros y caderas acompañan.
function shape(bf, sex) {
  const t = Math.max(0, Math.min(1, (bf - (sex === 'f' ? 14 : 7)) / 30))
  return sex === 'f'
    ? { sh: 11 + 2.5 * t, wa: 6.8 + 7.5 * t, hp: 12 + 4.5 * t }
    : { sh: 13 + 2.5 * t, wa: 7.2 + 8.5 * t, hp: 10.5 + 5 * t }
}

function Silhouette({ bf, sex, active }) {
  const { sh, wa, hp } = shape(bf, sex)
  const color = active ? 'var(--c-accent)' : 'var(--c-text-ghost)'

  // Tronco: hombros → cintura → caderas. Piernas: dos formas que se estrechan.
  const torso = [
    `M ${C - sh} 21`,
    `C ${C - sh} 30 ${C - wa} 33 ${C - wa} 43`,
    `C ${C - wa} 50 ${C - hp} 52 ${C - hp} 59`,
    `L ${C + hp} 59`,
    `C ${C + hp} 52 ${C + wa} 50 ${C + wa} 43`,
    `C ${C + wa} 33 ${C + sh} 30 ${C + sh} 21`,
    'Z',
  ].join(' ')

  const legL = `M ${C - hp} 59 L ${C - 0.7} 59 L ${C - 1.6} 96 L ${C - hp + 2.4} 96 Z`
  const legR = `M ${C + hp} 59 L ${C + 0.7} 59 L ${C + 1.6} 96 L ${C + hp - 2.4} 96 Z`

  return (
    <svg viewBox="0 0 40 100" width="34" height="85" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx={C} cy={9} r={5.4} fill={color} />
      <rect x={C - 2.2} y={13} width={4.4} height={8} fill={color} />
      <path d={torso} fill={color} />
      <path d={legL} fill={color} />
      <path d={legR} fill={color} />
      {/* Brazos: colgando, un poco separados del tronco. */}
      <path
        d={`M ${C - sh + 0.5} 23 L ${C - sh - 2.6} 47`}
        stroke={color} strokeWidth="3.4" strokeLinecap="round" fill="none"
      />
      <path
        d={`M ${C + sh - 0.5} 23 L ${C + sh + 2.6} 47`}
        stroke={color} strokeWidth="3.4" strokeLinecap="round" fill="none"
      />
    </svg>
  )
}

// Tramos y su descripción. Lo que hace utilizable esto es la frase, no el
// dibujo: la gente no sabe qué es «20% de grasa», pero sí sabe si se le ven
// los abdominales al mirarse.
const SCALES = {
  m: [
    { pct: 8,  desc: 'Abdominales marcados y venas en los brazos' },
    { pct: 12, desc: 'Abdominales visibles en reposo' },
    { pct: 15, desc: 'Se marcan algo, sobre todo con buena luz' },
    { pct: 20, desc: 'Cintura definida, pero sin abdominales' },
    { pct: 25, desc: 'Barriga blanda, cintura poco marcada' },
    { pct: 30, desc: 'Barriga clara y cara más llena' },
    { pct: 35, desc: 'Barriga marcada y cintura ancha' },
  ],
  f: [
    { pct: 16, desc: 'Abdominales visibles, muy definida' },
    { pct: 20, desc: 'Atlética, con algo de definición' },
    { pct: 24, desc: 'Firme, sin definición marcada' },
    { pct: 28, desc: 'Cintura visible, caderas suaves' },
    { pct: 32, desc: 'Cintura poco marcada' },
    { pct: 38, desc: 'Barriga y caderas más llenas' },
    { pct: 42, desc: 'Cintura ancha' },
  ],
}

/**
 * `sex` llega en el formato de profiles ('Masculino' | 'Femenino' | 'Otro').
 * Sin sexo no se puede pintar una escala honesta —los tramos no son los
 * mismos— así que se pide antes en vez de enseñar la de hombre y callar.
 */
export default function BodyFatPicker({ sex, value, onChange }) {
  const { t } = useLang()
  const sk = sex === 'Femenino' ? 'f' : sex === 'Masculino' ? 'm' : null

  if (!sk) {
    return (
      <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
        {t('Elige tu sexo en «Mis características» para ver la escala: los tramos no son los mismos.')}
      </p>
    )
  }

  const scale = SCALES[sk]
  const current = scale.find(s => s.pct === Number(value))

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', margin: '0 -2px' }}>
        {scale.map(s => {
          const active = Number(value) === s.pct
          return (
            <button
              key={s.pct}
              type="button"
              onClick={() => onChange(s.pct)}
              aria-pressed={active}
              style={{
                flex: '0 0 auto', padding: '8px 6px 6px', cursor: 'pointer',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                background: active ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
                transition: 'all 150ms var(--ease-out)',
              }}
            >
              <Silhouette bf={s.pct} sex={sk} active={active} />
              <span className="tnum" style={{
                display: 'block', marginTop: '4px',
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 800,
                letterSpacing: '-0.01em',
                color: active ? 'var(--c-action-text)' : 'var(--c-text-dim)',
              }}>
                {s.pct}%
              </span>
            </button>
          )
        })}
      </div>

      <p style={{ color: current ? 'var(--c-text-dim)' : 'var(--c-text-muted)', fontSize: '12px', lineHeight: 1.5, marginTop: '8px', minHeight: '18px' }}>
        {current ? t(current.desc) : t('Elige el que más se parezca a como te ves hoy.')}
      </p>

      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
          letterSpacing: '-0.01em',
          color: value == null ? 'var(--c-text-dim)' : 'var(--c-action-text)',
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        }}
      >
        {value == null ? t('Sin especificar') : t('No sé / prefiero no decirlo')}
      </button>
    </div>
  )
}
