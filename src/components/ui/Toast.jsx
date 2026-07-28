// Shared feedback primitives.
//
// LiveRegion — a visually-hidden polite live region. Keep one mounted per
// surface and write short strings to it ("Meta creada", "Comida eliminada")
// so screen-reader users hear state changes that are otherwise only visual.
//
// Toast — a transient floating notice (auto-dismissing) for action results
// that have no inline home — e.g. a failed background action. Themed via the
// action role, announced through role=alert.
//
// UndoSnackbar — the floating "… · Deshacer" bar shown during an undoable
// delete's grace window. Pairs with useUndoableDelete.

import { useEffect } from 'react'

const srOnly = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

export function LiveRegion({ children }) {
  return <p role="status" aria-live="polite" style={srOnly}>{children}</p>
}

export function Toast({ message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onDismiss?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div
      role="alert"
      className="fade-in"
      style={{
        position: 'fixed', left: '16px', right: '16px',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        maxWidth: '448px', margin: '0 auto', zIndex: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: 'var(--c-surface)', color: 'var(--c-action-text)',
        border: '1px solid var(--c-action-border)',
        borderRadius: 'var(--r-md)', padding: '12px 12px 12px 16px',
        boxShadow: 'var(--e-3)',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 700, minWidth: 0, lineHeight: 1.4 }}>
        {message}
      </span>
      <button
        onClick={onDismiss}
        aria-label="Cerrar"
        style={{
          flexShrink: 0, width: '32px', height: '32px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-text-dim)', fontSize: '15px', lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}

export function UndoSnackbar({ show, message, actionLabel = 'Deshacer', onUndo }) {
  if (!show) return null
  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed', left: '16px', right: '16px',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        maxWidth: '448px', margin: '0 auto', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: 'var(--c-text)', color: 'var(--c-bg)',
        borderRadius: 'var(--r-md)', padding: '12px 12px 12px 16px',
        boxShadow: 'var(--e-3)',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {message}
      </span>
      <button
        onClick={onUndo}
        style={{
          flexShrink: 0, minHeight: '40px', padding: '0 16px', borderRadius: 'var(--r-sm)',
          background: 'var(--c-bg)', color: 'var(--c-text)',
          fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em',
        }}
      >
        {actionLabel}
      </button>
    </div>
  )
}
