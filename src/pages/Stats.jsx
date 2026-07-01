import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Sheet } from '../components/ui'
import { useStats } from '../hooks/useStats'
import { useStatPrefs } from '../hooks/useStatPrefs'
import { STAT_MODULES } from '../lib/statModules'

const BY_ID = Object.fromEntries(STAT_MODULES.map(m => [m.id, m]))

// ── Row in the customize sheet: reorder (up/down) + on/off toggle ──────────
function ModuleRow({ module, on, isFirst, isLast, onToggle, onMove }) {
  const arrow = (dir, disabled) => (
    <button
      onClick={() => !disabled && onMove(module.id, dir)}
      disabled={disabled}
      aria-label={dir === 'up' ? 'Subir' : 'Bajar'}
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '8px', background: 'transparent', border: '1px solid var(--c-border-subtle)',
        color: disabled ? 'var(--c-text-ghost)' : 'var(--c-text-dim)',
        opacity: disabled ? 0.4 : 1, fontSize: '12px', lineHeight: 1,
      }}
    >
      {dir === 'up' ? '↑' : '↓'}
    </button>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
      background: 'var(--c-surface-2)',
      border: `1px solid ${on ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
      borderRadius: '12px',
    }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
        {module.label}
      </span>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {arrow('up', isFirst)}
        {arrow('down', isLast)}
      </div>
      {/* Switch */}
      <button
        onClick={() => onToggle(module.id)}
        aria-label={on ? 'Ocultar' : 'Mostrar'}
        aria-pressed={on}
        style={{
          position: 'relative', flexShrink: 0, marginLeft: '4px',
          width: '40px', height: '24px', borderRadius: '999px', border: 'none',
          background: on ? 'var(--c-action)' : 'var(--c-border)',
          transition: 'background 160ms var(--ease-out)', cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute', top: '3px', left: on ? '19px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%', background: 'var(--c-surface)',
          transition: 'left 160ms var(--ease-out)',
        }} />
      </button>
    </div>
  )
}

// Stats window. Own view by default; a coach passes a client's userId + readOnly
// to see the same window for that client (read-only, no customize/classify).
export default function Stats({ userId = null, readOnly = false }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useStats(userId)
  const { enabled, order, toggle, move } = useStatPrefs()
  const [customizing, setCustomizing] = useState(false)

  // Own view: user's chosen order, filtered to enabled. Coach view: all modules,
  // registry order, read-only.
  const visible = useMemo(() => {
    if (readOnly) return STAT_MODULES
    return order.map(id => BY_ID[id]).filter(m => m && enabled.has(m.id))
  }, [readOnly, order, enabled])

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '8px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
            aria-label="Volver"
          >
            ←
          </button>
          <h1 style={{ flex: 1, fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            Estadísticas
          </h1>
          {!readOnly && (
            <button
              onClick={() => setCustomizing(true)}
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--c-accent)', padding: '4px 6px',
              }}
            >
              Personalizar
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{
                height: i === 0 ? '90px' : '210px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-subtle)',
                borderRadius: '16px',
              }} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)', color: 'var(--c-action-text)', fontSize: '13px', padding: '12px 14px', borderRadius: '12px', marginTop: '24px' }}>
            <span>No pudimos cargar las estadísticas.</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-action-border)', borderRadius: '8px', padding: '6px 12px', background: 'transparent' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty — no workouts at all */}
        {!loading && !error && data && data.totals.workouts === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px', marginTop: '24px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              Aún no hay nada que medir
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '32ch', margin: '0 auto' }}>
              {readOnly
                ? 'Cuando registre entrenos, aquí verás sus totales y progreso.'
                : 'Registra entrenos y aquí verás tus totales y tu progreso en el tiempo.'}
            </p>
          </div>
        )}

        {/* Modules */}
        {!loading && !error && data && data.totals.workouts > 0 && (
          <div style={{ marginTop: '24px', paddingBottom: '32px' }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                  No tienes estadísticas activas.
                </p>
                <button
                  onClick={() => setCustomizing(true)}
                  style={{ background: 'transparent', color: 'var(--c-accent)', border: '1px solid var(--c-action-border)', borderRadius: '8px', padding: '8px 14px', fontSize: '11px', fontWeight: 700 }}
                >
                  Elegir qué ver
                </button>
              </div>
            ) : (
              visible.map((m, i) => (
                <div key={m.id} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <m.Component data={data} refetch={refetch} readOnly={readOnly} />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Customize sheet — own view only */}
      {!readOnly && customizing && (
        <Sheet
          title="Personalizar"
          subtitle="Elige qué ver y en qué orden."
          onClose={() => setCustomizing(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {order.map((id, i) => {
              const m = BY_ID[id]
              if (!m) return null
              return (
                <ModuleRow
                  key={id}
                  module={m}
                  on={enabled.has(id)}
                  isFirst={i === 0}
                  isLast={i === order.length - 1}
                  onToggle={toggle}
                  onMove={move}
                />
              )
            })}
          </div>
        </Sheet>
      )}
    </Layout>
  )
}
