import { useLang } from '../hooks/useLang'
import { isRecurring } from '../lib/goals'

// Una meta con su barra.
//
// Vive fuera de las pantallas porque las dos que muestran metas —la portada del
// levantador y la ficha del entrenador— tienen que enseñar exactamente lo
// mismo. La ficha pintaba solo «Objetivo: 100 kg», sin barra ni porcentaje: el
// entrenador veía la meta pero no si su cliente iba a llegar.
//
// El texto de estado es un dato, no un ánimo. Donde antes decía «Apenas
// empiezas. Suma tu próximo entreno.» ahora dice cuánto falta y cuánto queda de
// plazo; PRODUCT.md descarta la arenga, y un número no envejece ni suena falso
// el día que vas mal.

const fmt = (n, locale) =>
  Number(n ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 })

// «12 / 20 días este mes», «95 / 100 kg × 5 reps», «110,8 / 120 kg (1RM est.)»
function measureLine(goal, t, locale) {
  const cur = fmt(goal.current, locale)
  const tgt = fmt(goal.target_value, locale)
  switch (goal.type) {
    case 'days_trained':
      return `${cur} / ${tgt} ${t('días este mes')}`
    case 'sessions_per_week':
      return `${cur} / ${tgt} ${t('días esta semana')}`
    case 'body_weight':
      return `${cur} / ${tgt} ${goal.unit}`
    default:
      return goal.target_reps
        ? `${cur} / ${tgt} ${goal.unit} × ${goal.target_reps} reps`
        : `${cur} / ${tgt} ${goal.unit} (1RM est.)`
  }
}

// Lo que falta y lo que queda de plazo, en una línea.
//
// Cada tramo se traduce entero, no palabra a palabra: "faltan {v} {u}" y
// "{v} {u} to go" no colocan el número en el mismo sitio, y encadenar
// fragmentos sueltos produce inglés de máquina.
function statusLine(goal, t, locale) {
  if (goal.completed_at) {
    const d = new Date(goal.completed_at).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    return { text: t('Cumplida el {d}', { d }), tone: 'done' }
  }
  if (goal.reached) return { text: t('Cumplida'), tone: 'done' }

  const unit = goal.unit === 'días'
    ? (goal.remaining === 1 ? t('día') : t('días'))
    : goal.unit
  const parts = [t('Faltan {v} {u}', { v: fmt(goal.remaining, locale), u: unit })]

  const p = goal.pace
  let tone = 'plain'
  if (p) {
    if (p.overdue) {
      parts.push(t('fuera de plazo'))
      tone = 'late'
    } else {
      parts.push(p.daysLeft === 1 ? t('queda 1 día') : t('quedan {n} días', { n: p.daysLeft }))
      if (!p.onTrack) { parts.push(t('vas por detrás')); tone = 'late' }
    }
  }
  return { text: parts.join(' · '), tone }
}

// Un solo acento en toda la app (DESIGN.md): «por detrás» no puede pintarse de
// rojo porque no hay rojo. Lo dice la palabra, y el color solo separa lo
// cumplido (verde ganado) de lo que sigue en curso.
const TONE_COLOR = {
  done: 'var(--c-success)',
  late: 'var(--c-action-text)',
  plain: 'var(--c-text-muted)',
}

export default function GoalRow({ goal, onDelete, onComplete, onReopen, coachName = null }) {
  const { t, locale } = useLang()
  const status = statusLine(goal, t, locale)
  const done = !!goal.completed_at
  // Una meta recurrente no se archiva: se vuelve a jugar cada semana o cada
  // mes, así que ofrecer «guardar» sobre ella sería prometer un archivo que la
  // próxima ventana desmiente.
  const canArchive = goal.reached && !done && !!onComplete && !isRecurring(goal)

  return (
    <div style={{ opacity: done ? 0.62 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
            {goal.label}
          </p>
          <p style={{ color: TONE_COLOR[status.tone], fontSize: '11px', fontWeight: 500 }}>
            {status.text}
          </p>
          {coachName && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 600, marginTop: '3px' }}>
              {t('Meta de')} {coachName}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
          {canArchive && (
            <button
              onClick={() => onComplete(goal)}
              style={{ color: 'var(--c-success)', fontSize: '11px', fontWeight: 800, letterSpacing: '-0.01em', minHeight: '44px', padding: '0 8px' }}
              aria-label={`${t('Guardar como cumplida')}: ${goal.label}`}
            >
              {t('Guardar')}
            </button>
          )}
          {done && onReopen && (
            <button
              onClick={() => onReopen(goal)}
              style={{ color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 700, minHeight: '44px', padding: '0 8px' }}
              aria-label={`${t('Reabrir')}: ${goal.label}`}
            >
              {t('Reabrir')}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(goal)}
              style={{ color: 'var(--c-text-muted)', fontSize: '13px', minWidth: '44px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'color 120ms' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-action-text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-muted)' }}
              aria-label={`${t('Eliminar')}: ${goal.label}`}
              title={t('Eliminar')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div
        style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', marginBottom: '6px', overflow: 'hidden' }}
        role="progressbar"
        aria-valuenow={goal.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={goal.label}
      >
        <div style={{
          height: '100%',
          width: '100%',
          transformOrigin: 'left center',
          transform: `scaleX(${goal.pct / 100})`,
          background: goal.pct >= 100 ? 'var(--c-record)' : 'var(--c-action)',
          borderRadius: '999px',
          transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {measureLine(goal, t, locale)}
        </span>
        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: goal.pct >= 100 ? 'var(--c-success)' : 'var(--c-text-dim)' }}>
          {goal.pct}%
        </span>
      </div>
    </div>
  )
}
