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
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  color: 'var(--c-text-dim)',
}

// Error alert style.
export const ERROR_STYLE = {
  background: 'rgba(255,45,45,0.08)',
  border: '1px solid var(--c-accent-border)',
  color: 'var(--c-accent)',
  fontSize: '12px',
  padding: '10px 12px',
  borderRadius: '10px',
  lineHeight: 1.4,
}
