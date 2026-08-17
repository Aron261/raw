import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Sheet } from '../components/ui'
import StatSection from '../components/stats/StatSection'
import { useStats } from '../hooks/useStats'
import { useStatPrefs } from '../hooks/useStatPrefs'
import { STAT_MODULES } from '../lib/statModules'
import { useLang } from '../hooks/useLang'

const BY_ID = Object.fromEntries(STAT_MODULES.map(m => [m.id, m]))

// ── Drag-to-reorder list of modules (drag handle) + on/off toggle ─────────
function ReorderList({ order, enabled, onToggle, onReorder }) {
  const { t } = useLang()
  const [items, setItems] = useState(order)
  const [draggingId, setDraggingId] = useState(null)
  const dragId = useRef(null)
  const rowEls = useRef({})

  // Order can change externally (new module reconciled in); resync when not dragging.
  useEffect(() => { if (!dragId.current) setItems(order) }, [order])

  const onMove = (e) => {
    if (!dragId.current) return
    const y = e.clientY
    const cur = items.indexOf(dragId.current)
    let target = 0
    for (let i = 0; i < items.length; i++) {
      const el = rowEls.current[items[i]]
      if (el && y > el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) target = i
    }
    if (target !== cur && cur !== -1) {
      const next = [...items]
      next.splice(cur, 1)
      next.splice(target, 0, dragId.current)
      setItems(next)
    }
  }

  const onStart = (e, id) => {
    dragId.current = id
    setDraggingId(id)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }
  const onEnd = (e) => {
    if (!dragId.current) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    dragId.current = null
    setDraggingId(null)
    onReorder(items)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(id => {
        const m = BY_ID[id]
        if (!m) return null
        const on = enabled.has(id)
        const dragging = draggingId === id
        return (
          <div
            key={id}
            ref={el => { rowEls.current[id] = el }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
              background: 'var(--c-surface-2)',
              border: `1px solid ${on ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
              borderRadius: 'var(--r-md)',
              boxShadow: dragging ? '0 6px 16px rgba(0,0,0,0.14)' : 'none',
              transform: dragging ? 'scale(1.02)' : 'none',
              transition: dragging ? 'none' : 'transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
            }}
          >
            <span
              onPointerDown={e => onStart(e, id)}
              onPointerMove={onMove}
              onPointerUp={onEnd}
              aria-label="Arrastrar para reordenar"
              style={{ flexShrink: 0, touchAction: 'none', cursor: 'grab', color: 'var(--c-text-ghost)', fontSize: '16px', lineHeight: 1, padding: '2px 4px' }}
            >
              ⠿
            </span>
            <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {t(m.label)}
            </span>
            <button
              onClick={() => onToggle(id)}
              aria-label={on ? 'Ocultar' : 'Mostrar'}
              aria-pressed={on}
              style={{
                position: 'relative', flexShrink: 0,
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
      })}
    </div>
  )
}

// Stats window. Own view by default; a coach passes a client's userId + readOnly
// to see the same window for that client (read-only, no customize/classify).
// `embedded` renders just the modules (no Layout, no title) inside Progreso.
export default function Stats({ userId = null, readOnly = false, embedded = false }) {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useStats(userId)
  const { enabled, order, toggle, setOrder } = useStatPrefs()
  const [customizing, setCustomizing] = useState(false)

  // Qué módulos están desplegados. Arrancan abiertos los que el registro marca
  // con `open`: los dos que contestan «¿cómo voy ahora?». El resto se abre a
  // demanda — con seis abiertos a la vez la página no se pod\u00eda ojear.
  const [openIds, setOpenIds] = useState(
    () => new Set(STAT_MODULES.filter(m => m.open).map(m => m.id))
  )
  const toggleOpen = (id) => setOpenIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Own view: user's chosen order, filtered to enabled. Coach view: all modules,
  // registry order, read-only.
  const visible = useMemo(() => {
    if (readOnly) return STAT_MODULES
    return order.map(id => BY_ID[id]).filter(m => m && enabled.has(m.id))
  }, [readOnly, order, enabled])

  const content = (
    <>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: embedded ? 0 : '40px', paddingBottom: '8px' }}>
          {!embedded && (
            <button
              onClick={() => navigate(-1)}
              style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
              aria-label="Volver"
            >
              ←
            </button>
          )}
          {!embedded && (
            <h1 style={{ flex: 1, fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em' }}>
              {t('Estadísticas')}
            </h1>
          )}
          {embedded && <span style={{ flex: 1 }} />}
          {!readOnly && (
            <button
              onClick={() => setCustomizing(true)}
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--c-action-text)', padding: '4px 6px',
              }}
            >
              {t('Personalizar')}
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
                border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
                borderRadius: 'var(--r-lg)',
              }} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--c-action-dim)', border: '1px solid var(--c-action-border)', color: 'var(--c-action-text)', fontSize: '13px', padding: '12px 14px', borderRadius: 'var(--r-md)', marginTop: '24px' }}>
            <span>{t('No pudimos cargar las estadísticas.')}</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-action-border)', borderRadius: 'var(--r-xs)', padding: '6px 12px', background: 'transparent' }}
            >
              {t('Reintentar')}
            </button>
          </div>
        )}

        {/* Empty — no workouts at all */}
        {!loading && !error && data && data.totals.workouts === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--c-border)', borderRadius: 'var(--r-lg)', marginTop: '24px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              {t('Aún no hay nada que medir')}
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
              <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: 'var(--r-lg)' }}>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '13px', fontWeight: 600, lineHeight: 1.5, marginBottom: '12px' }}>
                  {t('No tienes ningún módulo activo. Elige cuáles quieres ver y aparecerán aquí.')}
                </p>
                <button
                  onClick={() => setCustomizing(true)}
                  style={{ background: 'transparent', color: 'var(--c-action-text)', border: '1px solid var(--c-action-border)', borderRadius: 'var(--r-xs)', padding: '8px 14px', fontSize: '11px', fontWeight: 700 }}
                >
                  {t('Elegir qué ver')}
                </button>
              </div>
            ) : (
              visible.map((m, i) => (
                <div key={m.id} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <StatSection
                    label={m.label}
                    summary={m.summary?.(data, { t, locale })}
                    open={openIds.has(m.id)}
                    onToggle={() => toggleOpen(m.id)}
                  >
                    <m.Component data={data} refetch={refetch} readOnly={readOnly} />
                  </StatSection>
                </div>
              ))
            )}
          </div>
        )}

      {/* Customize sheet — own view only */}
      {!readOnly && customizing && (
        <Sheet
          title={t('Personalizar')}
          subtitle={t('Arrastra para ordenar; toca el interruptor para mostrar u ocultar.')}
          onClose={() => setCustomizing(false)}
        >
          <ReorderList order={order} enabled={enabled} onToggle={toggle} onReorder={setOrder} />
        </Sheet>
      )}
    </>
  )

  if (embedded) return content

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        {content}
      </div>
    </Layout>
  )
}
