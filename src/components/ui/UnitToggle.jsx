// ── UnitToggle ───────────────────────────────────────────────────────────
// Una unidad a la vez. Antes kg y lb se mostraban las dos, siempre, y había que
// leer cuál estaba resaltada para saber en cuál estabas registrando: dos
// etiquetas para un dato que solo puede tener un valor. Aquí se ve la que está
// activa y un toque la cambia.
//
// La pastilla visible es pequeña porque vive en filas densas (la cabecera de un
// ejercicio), pero el área tocable del botón llega a 44px en `sm` gracias al
// padding transparente de alrededor — el dedo sudado del gimnasio no tiene que
// acertarle a 20px.
//
// Accesibilidad: sin las dos opciones a la vista, el control tiene que decir en
// voz alta en cuál está y qué pasa al tocarlo, así que el aria-label nombra las
// dos. El glifo ⇄ es la señal visual de que esto se puede tocar; sin él, una
// unidad suelta se lee como una etiqueta muerta.
import { pressable, PRESS_TRANSITION } from '../../lib/ui'

export default function UnitToggle({
  value,
  units = ['kg', 'lb'],
  onChange,
  size = 'md',
  readOnly = false,
  className,
}) {
  const current = units.includes(value) ? value : units[0]
  const next = units[(units.indexOf(current) + 1) % units.length]

  const sm = size === 'sm'

  const pill = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sm ? '3px' : '5px',
    background: 'var(--c-surface-2)',
    border: '1px solid var(--c-border)',
    borderRadius: sm ? '6px' : '10px',
    color: 'var(--c-text)',
    fontFamily: 'var(--font-sans)',
    fontSize: sm ? '10px' : '11px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    padding: sm ? '5px 8px' : '0 14px',
    minWidth: sm ? '44px' : '56px',
    minHeight: sm ? '26px' : '44px',
    transition: 'background 120ms var(--ease-out), border-color 120ms var(--ease-out)',
  }

  if (readOnly) {
    return (
      <span className={className} style={{ ...pill, color: 'var(--c-text-dim)', flexShrink: 0 }}>
        {current}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onChange(next)}
      // Nombra las dos: quien no ve la pantalla no puede deducir la alternativa.
      aria-label={`Unidad: ${current}. Tocar para cambiar a ${next}`}
      title={`Cambiar a ${next}`}
      style={{
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        // Área tocable de 44px sin engordar la pastilla visible.
        padding: sm ? '9px 0' : 0,
        margin: sm ? '-9px 0' : 0,
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        transition: PRESS_TRANSITION,
      }}
      {...pressable(0.93, {
        onMouseEnter: e => { e.currentTarget.firstChild.style.borderColor = 'var(--c-action-border)' },
        onMouseLeave: e => { e.currentTarget.firstChild.style.borderColor = 'var(--c-border)' },
      })}
    >
      <span style={pill}>
        {current}
        <span aria-hidden="true" style={{ color: 'var(--c-text-muted)', fontSize: sm ? '9px' : '10px' }}>⇄</span>
      </span>
    </button>
  )
}
