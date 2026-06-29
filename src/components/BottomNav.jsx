import { NavLink } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'

// ── Icons ──────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ProgramaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="3" rx="1.5" />
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" />
      <rect x="3" y="17" width="18" height="3" rx="1.5" />
    </svg>
  )
}

function CoachIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// ── Tab item ──────────────────────────────────────────────────────────
function TabItem({ to, label, Icon, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
    >
      {({ isActive }) => (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
          padding: '8px 0 4px',
          position: 'relative',
        }}>
          {/* Active line indicator */}
          <div style={{
            position: 'absolute',
            top: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: isActive ? '20px' : '0px',
            height: '2px',
            borderRadius: '0 0 2px 2px',
            background: 'var(--c-accent)',
            transition: 'width 200ms var(--ease-out)',
          }} />
          <div style={{
            color: isActive ? 'var(--c-accent)' : 'var(--c-text-ghost)',
            transition: 'color 200ms var(--ease-out)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon />
          </div>
          <span style={{
            fontSize: '10px', fontWeight: isActive ? 700 : 600,
            textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1,
            color: isActive ? 'var(--c-accent)' : 'var(--c-text-ghost)',
            transition: 'color 200ms var(--ease-out)',
          }}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  )
}

// ── Center Start action ───────────────────────────────────────────────
function StartAction({ onClick }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <button
        onClick={onClick}
        aria-label="Empezar entreno"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '48px', height: '48px', borderRadius: '16px',
          background: 'var(--c-action)', color: 'var(--c-on-action)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          transition: 'transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out)',
          flexShrink: 0,
          marginBottom: '4px',
        }}
        onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.14)' }}
        onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)' }}
        onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)' }}
      >
        <PlusIcon />
      </button>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────
export default function BottomNav({ onStart }) {
  const { profile } = useProfile()
  const isTrainer = !!profile?.is_trainer

  // Profile lives in the top-right avatar, not the nav — which frees a slot so
  // trainers keep BOTH Historial and Coach. Start stays centered: Rutinas is
  // always immediately right of it; Coach appends for trainers, else a spacer
  // keeps the layout balanced.
  // Lifter:  Inicio | Historial | [START] | Rutinas | ·
  // Trainer: Inicio | Historial | [START] | Rutinas | Coach
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--c-bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--c-border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center',
        maxWidth: '480px', margin: '0 auto',
        height: '60px', padding: '0 4px',
      }}>
        <TabItem to="/"        label="Inicio"    Icon={HomeIcon}    exact />
        <TabItem to="/history" label="Historial" Icon={HistoryIcon} />
        <StartAction onClick={onStart} />
        <TabItem to="/rutinas" label="Rutinas"   Icon={ProgramaIcon} />
        {isTrainer
          ? <TabItem to="/coach" label="Coach" Icon={CoachIcon} />
          : <span style={{ flex: 1 }} aria-hidden="true" />
        }
      </div>
    </nav>
  )
}
