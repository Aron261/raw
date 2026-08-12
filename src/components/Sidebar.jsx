import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useLang } from '../hooks/useLang'
import { outbox } from '../lib/outbox'

function BarbellIcon() {
  const { t } = useLang()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
      <path d="M3 9.5v5" /><path d="M21 9.5v5" /><path d="M6.5 12h11" />
    </svg>
  )
}

function ProgressIcon() {
  const { t } = useLang()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function RoutinesIcon() {
  const { t } = useLang()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function NutritionIcon() {
  const { t } = useLang()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

function CoachIcon() {
  const { t } = useLang()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
    </svg>
  )
}

function NavItem({ to, label, Icon, exact }) {
  const { t } = useLang()
  return (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        borderRadius: 'var(--r-sm)',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: isActive ? 'var(--c-text)' : 'var(--c-text-dim)',
        background: isActive ? 'var(--c-surface-2)' : 'transparent',
        transition: `color 150ms var(--ease-out), background 150ms var(--ease-out)`,
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? 'var(--c-action-text)' : 'inherit', flexShrink: 0 }}>
            <Icon />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

function GroupLabel({ children }) {
  const { t } = useLang()
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: '11px', fontWeight: 700,
      letterSpacing: '-0.01em',
      color: 'var(--c-text-ghost)',
      padding: '14px 14px 5px',
      userSelect: 'none',
    }}>
      {children}
    </p>
  )
}

export default function Sidebar() {
  const { t } = useLang()
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    // signOut borra el outbox (higiene de dispositivo compartido). Si hay
    // series sin sincronizar, eso es pérdida de datos: se avisa antes.
    const pending = await outbox.count()
    if (pending > 0 && !window.confirm(
      t('Tienes {n} series sin sincronizar. Si cierras sesión ahora, se perderán. ¿Cerrar sesión igualmente?', { n: pending })
    )) return
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
        boxShadow: 'var(--e-2)',
        overflow: 'hidden',
      }}
    >
      {/* Wordmark → hub */}
      <NavLink to="/" style={{ padding: '28px 24px 20px', display: 'block' }}>
        <span
          style={{
            display: 'block',
            fontSize: '24px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: 'var(--c-action-text)',
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
            letterSpacing: '-0.01em',
            color: 'var(--c-text-ghost)',
            marginTop: '4px',
          }}
        >
          {t('Todo tu progreso')}
        </span>
      </NavLink>

      <div style={{ height: '1px', background: 'var(--c-border-subtle)', margin: '0 16px' }} />

      {/* Nav — sections (el índice "Menú" se fusionó con Inicio) */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto' }}>
        <GroupLabel>{t('Entreno')}</GroupLabel>
        <NavItem to="/"         label={t('Inicio')}   Icon={BarbellIcon} exact />
        <NavItem to="/progreso" label={t('Progreso')} Icon={ProgressIcon} />
        <NavItem to="/rutinas"  label={t('Rutinas')}  Icon={RoutinesIcon} />

        <GroupLabel>{t('Vida')}</GroupLabel>
        <NavItem to="/nutrition" label={t('Nutrición')}  Icon={NutritionIcon} />

        {profile?.is_trainer && (
          <>
            <GroupLabel>{t('Coaching')}</GroupLabel>
            <NavItem to="/coach" label={t('Coach')} Icon={CoachIcon} />
          </>
        )}
      </nav>

      <div style={{ height: '1px', background: 'var(--c-border-subtle)', margin: '0 16px' }} />

      {/* Perfil — avatar + identidad, la misma entrada que la fila del hub */}
      <div style={{ padding: '10px 8px 0' }}>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: 'var(--r-sm)',
            background: isActive ? 'var(--c-surface-2)' : 'transparent',
            transition: `background 150ms var(--ease-out)`,
          })}
        >
          <span
            aria-hidden="true"
            style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
              color: 'var(--c-action-text)', fontSize: '13px', fontWeight: 900, letterSpacing: '-0.02em',
            }}
          >
            {(profile?.name || user?.email || '?').charAt(0).toUpperCase()}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'Perfil'}
            </span>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--c-text-ghost)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {user?.email}
            </span>
          </span>
        </NavLink>
      </div>
      <div style={{ padding: '10px 24px 24px' }}>
        <button
          onClick={handleSignOut}
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--c-text-dim)',
            border: '1px solid var(--c-border-subtle)',
            padding: '6px 12px',
            borderRadius: 'var(--r-xs)',
            transition: `color 150ms var(--ease-out), border-color 150ms var(--ease-out)`,
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--c-action-text)'
            e.currentTarget.style.borderColor = 'var(--c-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--c-text-dim)'
            e.currentTarget.style.borderColor = 'var(--c-border-subtle)'
          }}
        >
          {t('Cerrar sesión')}
        </button>
      </div>
    </aside>
  )
}
