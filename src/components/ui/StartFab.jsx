import { useLang } from '../../hooks/useLang'
// Persistent primary action — the desktop twin of the tab bar's "+". Opens the
// same QuickAddSheet in Layout, so the app's core jobs (entreno, peso, comida,
// rutina) are one tap from any screen.
export default function StartFab({ onClick, offset = 72 }) {
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      aria-label="Agregar"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: `calc(${offset}px + env(safe-area-inset-bottom))`,
        zIndex: 45,
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: 'var(--c-action)', color: 'var(--c-on-action)',
        border: 'none', borderRadius: '999px',
        padding: '14px 18px',
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.01em',
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        transition: 'transform 160ms var(--ease-out)',
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)' }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {t('Agregar')}
    </button>
  )
}
