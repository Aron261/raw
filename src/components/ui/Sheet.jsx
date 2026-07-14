import { useEffect, useLayoutEffect, useRef, useCallback, useId } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useDragControls, useReducedMotion, animate } from 'motion/react'

// The single bottom-sheet shell for Raw. Scrim + grab handle + optional header,
// safe-area aware, scrollable.
//
// Motion: the panel is a spring — it enters from below, can be dragged down
// from the handle and flicked away (velocity-projected), and rubber-bands if
// pulled up past rest. The scrim dims in lockstep with the drag, so pulling the
// sheet down literally lets the content behind show through. Everything is
// interruptible; nothing waits on a fixed-duration keyframe.
//
// As a modal dialog it still: traps Tab focus, restores focus to the trigger on
// close, closes on Escape, locks body scroll, and is announced via role dialog
// + aria-modal with the title as its accessible name.
//
// Reduced motion: entrance/exit become opacity cross-fades and drag is disabled.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ENTER = { type: 'spring', bounce: 0.18, duration: 0.42 }
const SETTLE = { type: 'spring', bounce: 0.12, duration: 0.4 }
const DISMISS = { type: 'spring', bounce: 0, duration: 0.3 }

export default function Sheet({ title, subtitle, onClose, children, maxHeight = '90dvh', headerRight = null }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const reduce = useReducedMotion()
  const dragControls = useDragControls()

  const y = useMotionValue(0)
  const scrim = useMotionValue(0)
  const opacity = useMotionValue(reduce ? 0 : 1)
  const panelH = useRef(600)
  const closing = useRef(false)

  // The scrim's opacity is a pure function of how far the panel has travelled
  // down — drag, entrance, and dismiss all feed the same relationship.
  useMotionValueEvent(y, 'change', (v) => {
    scrim.set(clamp(1 - v / panelH.current, 0, 1))
  })

  // Enter: measure the real height, then spring up from below (or cross-fade).
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight || 600
    panelH.current = h
    if (reduce) {
      y.set(0)
      animate(scrim, 1, { duration: 0.2 })
      animate(opacity, 1, { duration: 0.2 })
    } else {
      y.set(h)
      animate(y, 0, ENTER)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    if (reduce) {
      animate(scrim, 0, { duration: 0.18 })
      animate(opacity, 0, { duration: 0.18 }).finished.then(() => onClose?.())
    } else {
      animate(y, panelH.current, DISMISS).finished.then(() => onClose?.())
    }
  }, [onClose, reduce, y, scrim, opacity])

  // Focus trap, Escape-to-close, body scroll lock, focus restore.
  useEffect(() => {
    const panel = panelRef.current
    const previouslyFocused = document.activeElement
    panel?.focus()

    const focusableItems = () =>
      Array.from(
        panel?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter(el => !el.disabled && el.offsetParent !== null)

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return }
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
  }, [close])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div
        onClick={close}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--c-scrim)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          opacity: scrim,
        }}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.14, bottom: 0 }}
        onDragEnd={(e, info) => {
          if (info.velocity.y > 600 || info.offset.y > panelH.current * 0.3) close()
          else animate(y, 0, SETTLE)
        }}
        style={{
          position: 'relative', zIndex: 1, y, opacity,
          background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderBottom: 'none',
          borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px',
          maxHeight, overflowY: 'auto', outline: 'none',
          padding: '20px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Grab handle — the drag starts here so scrollable content still scrolls. */}
        <div
          onPointerDown={(e) => { if (!reduce) dragControls.start(e) }}
          style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            height: '28px', marginTop: '-12px', marginBottom: '6px',
            cursor: reduce ? 'default' : 'grab', touchAction: 'none',
          }}
        >
          <div style={{ width: '36px', height: '4px', background: 'var(--c-border)', borderRadius: '999px' }} />
        </div>

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
                  onClick={close}
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
      </motion.div>
    </div>
  )
}
