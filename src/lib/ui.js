// Shared press-scale feedback props for interactive elements.
// Usage: <button {...pressProps(0.97)} ...>
export function pressProps(scale = 0.97) {
  return {
    onMouseDown: e => { e.currentTarget.style.transform = `scale(${scale})` },
    onMouseUp:   e => { e.currentTarget.style.transform = 'scale(1)' },
    onMouseLeave:e => { e.currentTarget.style.transform = 'scale(1)' },
    onTouchStart:e => { e.currentTarget.style.transform = `scale(${scale})` },
    onTouchEnd:  e => { e.currentTarget.style.transform = 'scale(1)' },
  }
}

// pressProps + tus propios handlers en el mismo control.
//
// pressProps ya define onMouseLeave (para soltar la escala), así que un
// {...pressProps()} encima de un onMouseLeave propio se lo come — y el borde
// resaltado se queda pegado al salir el ratón. Esto los encadena.
//
// El sitio donde importa de verdad no es el ratón: en un móvil el hover no
// existe, así que un control que solo reacciona a onMouseEnter no reacciona a
// nada. La escala al tocar es lo único que confirma que el dedo llegó.
export function pressable(scale = 0.97, extra = {}) {
  const base = pressProps(scale)
  const chain = (a, b) => (a && b ? (e) => { a(e); b(e) } : a || b)
  // El estilo inline gana a la hoja de estilos, así que un control con su
  // propia `transition` (para el color, por ejemplo) se quedaba sin transición
  // de transform y la escala pegaba un tirón al soltar. En vez de obligar a
  // cada llamador a acordarse, se añade sola la primera vez que se toca.
  const ensure = (e) => {
    const el = e.currentTarget
    if (!el.style.transition.includes('transform')) {
      el.style.transition = el.style.transition
        ? `${el.style.transition}, ${PRESS_TRANSITION}`
        : PRESS_TRANSITION
    }
  }
  return {
    ...extra,
    onMouseDown:  chain((e) => { ensure(e); base.onMouseDown(e) },  extra.onMouseDown),
    onMouseUp:    chain(base.onMouseUp,    extra.onMouseUp),
    onMouseLeave: chain(base.onMouseLeave, extra.onMouseLeave),
    onTouchStart: chain((e) => { ensure(e); base.onTouchStart(e) }, extra.onTouchStart),
    onTouchEnd:   chain(base.onTouchEnd,   extra.onTouchEnd),
  }
}

// Transición que acompaña a pressable. Corta a propósito: confirmar un toque
// tiene que ir por delante del dedo, no detrás.
export const PRESS_TRANSITION = 'transform 140ms var(--ease-out)'

// Shared hover color-swap props.
// Usage: <button {...hoverColor('#fff', '#444')} ...>
export function hoverColor(active = '#fff', base = '#444') {
  return {
    onMouseEnter: e => { e.currentTarget.style.color = active },
    onMouseLeave: e => { e.currentTarget.style.color = base },
  }
}

// Common label style used throughout the app.
export const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--c-text-dim)',
}

// Error alert style — themed via the action role (Raw has no separate red).
export const ERROR_STYLE = {
  background: 'var(--c-action-dim)',
  border: '1px solid var(--c-action-border)',
  color: 'var(--c-action-text)',
  fontSize: '12px',
  padding: '10px 12px',
  borderRadius: 'var(--r-sm)',
  lineHeight: 1.4,
}
