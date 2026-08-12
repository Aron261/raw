import { usePlan } from '../hooks/usePlan'
import { useLang } from '../hooks/useLang'

// Candado de plan. Envuelve una función premium: si el plan de la cuenta la
// cubre, pinta los hijos tal cual; si no, una tarjeta que dice QUÉ es esto y
// EN QUÉ plan viene — sin difuminados ni teasers a medias, que en esta app
// leerían como un error de carga. Un candado honesto dice su precio.
//
// `need`: 'pro' | 'coach'. `title`: nombre de la función, en el idioma de la
// pantalla que la aloja. `compact`: versión de una línea para espacios chicos.
export default function PremiumGate({ need = 'pro', title, compact = false, children }) {
  const { isPro, isCoach } = usePlan()
  const { t } = useLang()
  const covered = need === 'coach' ? isCoach : isPro
  if (covered) return children

  const planName = need === 'coach' ? 'Raw Coach' : 'Raw Pro'

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px dashed var(--c-border)', borderRadius: 'var(--r-md)',
        padding: '10px 12px', background: 'var(--c-surface-2)',
      }}>
        <Chip>{planName}</Chip>
        <span style={{ color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      border: '1px dashed var(--c-border)', borderRadius: 'var(--r-lg)',
      padding: '20px 16px', background: 'var(--c-surface-2)', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <Chip>{planName}</Chip>
      </div>
      {title && (
        <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '6px' }}>
          {title}
        </p>
      )}
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.5, maxWidth: '300px', margin: '0 auto' }}>
        {t(need === 'coach'
          ? 'Parte del plan para entrenadores. Se activa por cuenta durante la beta.'
          : 'Parte del plan Pro. Se activa por cuenta durante la beta.')}
      </p>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span style={{
      background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
      fontSize: '9px', fontWeight: 800, letterSpacing: '0.02em',
      padding: '3px 8px', borderRadius: 'var(--r-xl)', border: '1px solid var(--c-accent-border)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
