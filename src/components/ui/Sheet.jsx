// The single bottom-sheet shell for Raw. Scrim + handle + optional header,
// safe-area aware, scrollable. Replaces the hand-rolled modal markup that was
// copy-pasted across the create flows.
export default function Sheet({ title, subtitle, onClose, children, maxHeight = '90dvh', headerRight = null }) {
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
        className="modal-sheet"
        style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderBottom: 'none',
          borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px',
          maxHeight, overflowY: 'auto',
          padding: '20px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: '32px', height: '3px', background: 'var(--c-border)', borderRadius: '2px', margin: '0 auto 18px' }} />
        {(title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: subtitle ? '8px' : '16px' }}>
            <div style={{ minWidth: 0 }}>
              {title && <h3 style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h3>}
              {subtitle && <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px', lineHeight: 1.5 }}>{subtitle}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {headerRight}
              {onClose && (
                <button onClick={onClose} aria-label="Cerrar" style={{ color: 'var(--c-text-dim)', fontSize: '16px', lineHeight: 1, padding: '4px' }}>✕</button>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
