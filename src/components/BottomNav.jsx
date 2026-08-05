import { NavLink, useLocation } from 'react-router-dom'
import { hasTabBar } from '../lib/sections'
import { useLang } from '../hooks/useLang'

// ── Icons ──────────────────────────────────────────────────────────────
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

// Una manzana: es lo que se lee como «comida» sin tener que pensarlo. Un
// cubierto o un plato son más neutros pero a 20px se convierten en manchas.
function NutricionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8.5c-1.2-1.4-2.7-2-4.2-1.7C5.6 7.2 4 9.3 4 12.2c0 3.6 2.6 7.3 4.7 7.8 1.1.3 2.2-.4 3.3-.4s2.2.7 3.3.4c2.1-.5 4.7-4.2 4.7-7.8 0-2.9-1.6-5-3.8-5.4-1.5-.3-3 .3-4.2 1.7Z" />
      <path d="M12 8.5V5.2" />
      <path d="M12 5.2c1.6 0 2.9-1 3.2-2.2-1.7-.3-3.2.8-3.2 2.2Z" />
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
      {/* Las pestañas inactivas iban en --c-text-ghost, que DESIGN.md reserva
          para decoración: 2.13:1 sobre el hueso, a 10px, en la navegación
          principal de la app. --c-text-dim las sube a 5.45:1 sin tocar el
          contraste de la activa, que es lo que las distingue. */}
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
            color: isActive ? 'var(--c-action-text)' : 'var(--c-text-dim)',
            transition: 'color 200ms var(--ease-out)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon />
          </div>
          <span style={{
            fontSize: '10px', fontWeight: isActive ? 700 : 600, letterSpacing: '-0.01em', lineHeight: 1,
            color: isActive ? 'var(--c-action-text)' : 'var(--c-text-dim)',
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
function StartAction({ onClick, label }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <button
        onClick={onClick}
        aria-label={label}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '48px', height: '48px', borderRadius: 'var(--r-lg)',
          background: 'var(--c-action)', color: 'var(--c-on-action)',
          border: 'none', cursor: 'pointer',
          boxShadow: 'var(--e-2)',
          transition: 'transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out)',
          flexShrink: 0,
          marginBottom: '4px',
        }}
        onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; e.currentTarget.style.boxShadow = 'var(--e-1)' }}
        onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--e-2)' }}
        onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--e-2)' }}
      >
        <PlusIcon />
      </button>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────
// Inicio | Progreso | [+] | Nutrición | Rutinas
//
// Inicio ocupa el extremo izquierdo, que es donde empieza la lectura.
//
// Nutrición entra y Perfil sale. Nutrición no tenía pestaña: se llegaba desde
// un chip de Inicio y desde el «+», y con eso costaba encontrarla para algo que
// se abre varias veces al día. Perfil, en cambio, se toca de higos a brevas —
// es configuración. Entre dos cosas que compiten por un hueco, gana la que se
// usa a diario. A Perfil se entra desde su tarjeta en Inicio, y la barra sigue
// apareciendo dentro de /profile para poder salir.
//
// "Ejercicios" ya no es pestaña. Clasificar y vincular ejercicios es
// mantenimiento que se hace de vez en cuando, no una de las cinco cosas que
// haces en el gimnasio; ahora se entra desde Perfil → Entrenamiento. La ruta
// /ejercicios sigue existiendo igual.
//
// "Menú" desapareció antes: Inicio absorbió aquel índice.
export default function BottomNav({ onStart }) {
  const { pathname } = useLocation()
  const { t } = useLang()
  if (!hasTabBar(pathname)) return null

  return (
    <nav
      aria-label="Entreno"
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
        <TabItem to="/"          label={t('Inicio')}    Icon={BarbellIcon} exact />
        <TabItem to="/progreso"  label={t('Progreso')}  Icon={HistoryIcon} />
        <StartAction onClick={onStart} label={t('Agregar')} />
        <TabItem to="/nutrition" label={t('Nutrición')} Icon={NutricionIcon} />
        <TabItem to="/rutinas"   label={t('Rutinas')}   Icon={ProgramaIcon} />
      </div>
    </nav>
  )
}
