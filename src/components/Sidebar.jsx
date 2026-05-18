import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function RoutinesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function CycleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

const navItems = [
  { to: '/',          label: 'Inicio',    Icon: DashboardIcon, exact: true },
  { to: '/history',   label: 'Entrenos',  Icon: HistoryIcon },
  { to: '/programa',  label: 'Programa',  Icon: RoutinesIcon },
  { to: '/progress',  label: 'Progreso',  Icon: ProgressIcon },
  { to: '/profile',   label: 'Perfil',    Icon: ProfileIcon },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      style={{
        width: '220px',
        flexShrink: 0,
        height: '100dvh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border-subtle)',
        boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Wordmark */}
      <div style={{ padding: '28px 24px 24px' }}>
        <span
          style={{
            display: 'block',
            fontSize: '24px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: 'var(--c-accent)',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          RAW
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--c-text-ghost)',
            marginTop: '4px',
          }}
        >
          Workout Tracker
        </span>
      </div>

      <div style={{ height: '1px', background: 'var(--c-border-subtle)', margin: '0 16px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: isActive ? 'var(--c-text)' : 'var(--c-text-dim)',
              background: isActive ? 'var(--c-surface-2)' : 'transparent',
              transition: `color 150ms var(--ease-out), background 150ms var(--ease-out)`,
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.dataset.active) e.currentTarget.style.color = 'var(--c-text-secondary)'
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.dataset.active) e.currentTarget.style.color = ''
            }}
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? 'var(--c-accent)' : 'inherit', flexShrink: 0 }}>
                  <Icon />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ height: '1px', background: 'var(--c-border-subtle)', margin: '0 16px' }} />

      {/* User + sign out */}
      <div style={{ padding: '16px 24px 24px' }}>
        <p
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--c-text-ghost)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '10px',
          }}
        >
          {user?.email}
        </p>
        <button
          onClick={handleSignOut}
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--c-text-dim)',
            border: '1px solid var(--c-border-subtle)',
            padding: '6px 12px',
            borderRadius: '8px',
            transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--c-accent)'
            e.currentTarget.style.borderColor = 'var(--c-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--c-text-dim)'
            e.currentTarget.style.borderColor = 'var(--c-border-subtle)'
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
