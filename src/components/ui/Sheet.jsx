import { useEffect, useRef, useId } from 'react'

// The single bottom-sheet shell for Raw. Scrim + handle + optional header,
// safe-area aware, scrollable. Replaces the hand-rolled modal markup that was
// copy-pasted across the create flows.
//
// As a modal dialog it: traps Tab focus, restores focus to the trigger on
// close, closes on Escape, locks body scroll, and is announced via role
// dialog + aria-modal with the title as its accessible name.
export default function Sheet({ title, subtitle, onClose, children, maxHeight = '90dvh', headerRight = null }) {
  const panelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const panel = panelRef.current
    const previouslyFocused = document.activeElement

    // Focus the panel so screen readers announce the dialog and its title;
    // Tab then moves into the content.
    panel?.focus()

    const focusableItems = () =>
      Array.from(
        panel?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter(el => !el.disabled && el.offsetParent !== null)

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusableItems()
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--c-scrim)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panelRef}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderBottom: 'none',
          borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px',
          maxHeight, overflowY: 'auto', outline: 'none',
          padding: '20px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 18px' }} />
        {(title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: subtitle ? '8px' : '16px' }}>
            <div style={{ minWidth: 0 }}>
              {title && <h3 id={titleId} style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h3>}
              {subtitle && <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px', lineHeight: 1.5 }}>{subtitle}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {headerRight}
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  style={{
                    flexShrink: 0, width: '44px', height: '44px', marginTop: '-10px', marginRight: '-10px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
