import { NavLink } from 'react-router-dom'
import { pressProps } from '../lib/ui'

// ── Icons ──────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ProgramaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="3" rx="1.5" />
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" />
      <rect x="3" y="17" width="18" height="3" rx="1.5" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          padding: '6px 0',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isActive ? 'var(--c-accent-dim)' : 'transparent',
            border: isActive ? '1px solid var(--c-accent-border)' : '1px solid transparent',
            color: isActive ? 'var(--c-accent)' : 'var(--c-text-ghost)',
            transition: 'all 200ms var(--ease-out)',
          }}>
            <Icon />
          </div>
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', lineHeight: 1,
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

// ── Center + button ───────────────────────────────────────────────────
function StartButton({ onPress }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <button
        onClick={onPress}
        aria-label="Iniciar entreno"
        style={{
          width: '54px', height: '54px', borderRadius: '50%',
          background: 'var(--c-accent)',
          border: '3px solid var(--c-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'translateY(-14px)',
          boxShadow: '0 4px 20px rgba(255,45,45,0.45), 0 1px 4px rgba(0,0,0,0.12)',
          color: '#fff',
          fontSize: '26px',
          fontWeight: 300,
          lineHeight: 1,
          transition: 'transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-16px) scale(1.06)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(255,45,45,0.55), 0 1px 4px rgba(0,0,0,0.12)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(-14px)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,45,45,0.45), 0 1px 4px rgba(0,0,0,0.12)'
        }}
        {...pressProps(0.94)}
      >
        +
      </button>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────
export default function BottomNav({ onStartWorkout }) {
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        maxWidth: '480px', margin: '0 auto',
        height: '60px', padding: '0 4px',
      }}>
        <TabItem to="/"         label="Inicio"   Icon={HomeIcon}    exact />
        <TabItem to="/history"  label="Entrenos" Icon={HistoryIcon} />
        <StartButton onPress={onStartWorkout} />
        <TabItem to="/programa" label="Programa" Icon={ProgramaIcon} />
        <TabItem to="/profile"  label="Perfil"   Icon={ProfileIcon} />
      </div>
    </nav>
  )
}
