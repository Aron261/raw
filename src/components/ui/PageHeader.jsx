import { useNavigate } from 'react-router-dom'

// Cabecera de sección (Nutrición, Longevidad, Social…): volver al menú en
// mobile (el sidebar cubre desktop), título display y un slot de control.
export default function PageHeader({ title, sub, right, backTo = '/' }) {
  const navigate = useNavigate()
  return (
    <div className="fade-in" style={{ paddingTop: '40px', paddingBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minHeight: '32px', marginBottom: '10px' }}>
        <button
          onClick={() => navigate(backTo)}
          className="md:hidden"
          style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, padding: '6px 10px 6px 0' }}
          aria-label="Volver al menú"
        >
          ←
        </button>
        <span className="hidden md:block" aria-hidden="true" />
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      <h1 className="font-display" style={{ color: 'var(--c-text)', fontSize: '34px', lineHeight: 0.95 }}>
        {title}
      </h1>
      {sub && (
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
