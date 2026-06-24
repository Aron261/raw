// Persistent primary action — the always-available "start a workout" affordance.
// Floats above the bottom nav so the app's core job is one tap from any lifter
// screen. Wired to the global WorkoutPickerModal in Layout.
export default function StartFab({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Empezar entreno"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
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
      Empezar
    </button>
  )
}
