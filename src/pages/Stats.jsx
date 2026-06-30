import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Sheet } from '../components/ui'
import { useStats } from '../hooks/useStats'
import { useStatPrefs } from '../hooks/useStatPrefs'
import { STAT_MODULES } from '../lib/statModules'

// ── Toggle row in the customize sheet ─────────────────────────────────────
function ModuleToggle({ module, on, onToggle }) {
  return (
    <button
      onClick={() => onToggle(module.id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', padding: '14px 16px', textAlign: 'left',
        background: 'var(--c-surface-2)',
        border: `1px solid ${on ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
        borderRadius: '12px',
      }}
    >
      <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
        {module.label}
      </span>
      {/* Switch */}
      <span style={{
        position: 'relative', flexShrink: 0,
        width: '40px', height: '24px', borderRadius: '999px',
        background: on ? 'var(--c-action)' : 'var(--c-border)',
        transition: 'background 160ms var(--ease-out)',
      }}>
        <span style={{
          position: 'absolute', top: '3px', left: on ? '19px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: 'var(--c-surface)',
          transition: 'left 160ms var(--ease-out)',
        }} />
      </span>
    </button>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const { data, loading, error } = useStats()
  const { enabled, toggle } = useStatPrefs()
  const [customizing, setCustomizing] = useState(false)

  const visible = STAT_MODULES.filter(m => enabled.has(m.id))

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }} className="fade-in">

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
          <button
            onClick={() => setCustomizing(true)}
            style={{
              flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--c-accent)', padding: '4px 6px',
            }}
          >
            Editar
          </button>
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
            <span>No pudimos cargar tus estadísticas.</span>
          </div>
        )}

        {/* Empty — no workouts at all */}
        {!loading && !error && data && data.totals.workouts === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px', marginTop: '24px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              Aún no hay nada que medir
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '32ch', margin: '0 auto' }}>
              Registra entrenos y aquí verás tus totales y tu progreso en el tiempo.
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
              visible.map(m => <m.Component key={m.id} data={data} />)
            )}
          </div>
        )}
      </div>

      {/* Customize sheet */}
      {customizing && (
        <Sheet
          title="Personalizar"
          subtitle="Elige qué estadísticas quieres ver."
          onClose={() => setCustomizing(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STAT_MODULES.map(m => (
              <ModuleToggle key={m.id} module={m} on={enabled.has(m.id)} onToggle={toggle} />
            ))}
          </div>
        </Sheet>
      )}
    </Layout>
  )
}
