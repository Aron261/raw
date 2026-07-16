import { NavLink, useLocation } from 'react-router-dom'
import { sectionFor } from '../lib/sections'

// ── Icons ──────────────────────────────────────────────────────────────
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function BarbellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11" />
      <path d="M17.5 6.5v11" />
      <path d="M3 9.5v5" />
      <path d="M21 9.5v5" />
      <path d="M6.5 12h11" />
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
// The tab bar belongs to the Training section. The hub and the other
// sections (Nutrición, Longevidad, Social, Coach, Perfil) navigate from
// the hub menu + back headers, so the bar stays out of their way.
// Training: Menú | Inicio | [START] | Historial | Rutinas
export default function BottomNav({ onStart }) {
  const { pathname } = useLocation()
  if (sectionFor(pathname) !== 'training') return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--c-bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Scroll-edge fade — content dissolves into the glass instead of meeting
          a hard 1px divider (Apple: scroll edge effects, not dividers). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, top: '-24px', height: '24px',
          background: 'linear-gradient(to top, var(--c-bg-glass), transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{
        display: 'flex', alignItems: 'center',
        maxWidth: '480px', margin: '0 auto',
        height: '60px', padding: '0 4px',
      }}>
        <TabItem to="/"         label="Menú"      Icon={MenuIcon}    exact />
        <TabItem to="/training" label="Inicio"    Icon={BarbellIcon} />
        <StartAction onClick={onStart} />
        <TabItem to="/history"  label="Historial" Icon={HistoryIcon} />
        <TabItem to="/rutinas"  label="Rutinas"   Icon={ProgramaIcon} />
      </div>
    </nav>
  )
}
