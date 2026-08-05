import { useState } from 'react'
import Layout from '../components/Layout'
import { PageHeader, Sheet, Field, Button, ErrorRetry } from '../components/ui'
import { useSupplements } from '../hooks/useSupplements'
import { useLang } from '../hooks/useLang'
import { pressable } from '../lib/ui'

/*
 * Longevidad — el checklist de suplementos del día.
 *
 * Las tablas llevaban meses en la base sin una sola pantalla que las usara.
 * Esto es lo mínimo que las hace valer, y lo mínimo es a propósito: lo que se
 * usa a diario es «¿me lo tomé?», no un panel de analítica.
 *
 * La pantalla se parece al registro de series porque el gesto es el mismo:
 * una lista corta, una casilla grande, y el estado se ve de un vistazo desde
 * lejos. Marcar es optimista — la mañana no espera al servidor.
 */

const MOMENTOS = ['AM', 'PM', 'Pre-entreno', 'Con comida', 'Antes de dormir']

function AddSheet({ onClose, onSave }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [timing, setTiming] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const toggle = (m) => setTiming(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const guardar = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ name, dose, timing })
      onClose()
    } catch (err) {
      setError(err.message || t('No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={t('Nuevo suplemento')} onClose={onClose}>
      <Field label={t('Nombre')}>
        <input
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('Creatina')}
          autoFocus
        />
      </Field>

      <Field label={t('Dosis')} hint={t('Opcional')}>
        <input
          className="input-field"
          value={dose}
          onChange={e => setDose(e.target.value)}
          placeholder="5 g"
        />
      </Field>

      <Field label={t('Cuándo')} hint={t('Opcional')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {MOMENTOS.map(m => {
            const on = timing.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                aria-pressed={on}
                style={{
                  minHeight: '44px', padding: '10px 14px', borderRadius: '999px',
                  fontSize: '12px', fontWeight: 700,
                  border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: on ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
                  color: on ? 'var(--c-action-text)' : 'var(--c-text-dim)',
                }}
              >
                {t(m)}
              </button>
            )
          })}
        </div>
      </Field>

      {error && <p style={{ color: 'var(--c-action-text)', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}

      <Button onClick={guardar} disabled={!name.trim() || saving} full>
        {saving ? t('Guardando…') : t('Añadir')}
      </Button>
    </Sheet>
  )
}

export default function Longevidad() {
  const { t } = useLang()
  const { supplements, loading, error, refetch, setTaken, addSupplement, removeSupplement } = useSupplements()
  const [adding, setAdding] = useState(false)

  const tomados = supplements.filter(s => s.taken).length
  const total = supplements.length

  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[640px] md:px-8">
        <PageHeader
          title={t('Longevidad')}
          right={
            <button
              onClick={() => setAdding(true)}
              aria-label={t('Añadir suplemento')}
              style={{
                minHeight: '44px', minWidth: '44px', padding: '0 14px',
                color: 'var(--c-action-text)', fontSize: '13px', fontWeight: 800,
                background: 'transparent',
              }}
            >
              + {t('Añadir')}
            </button>
          }
        />

        {/* El total del día, arriba y en una línea: es lo que se viene a mirar. */}
        {total > 0 && (
          <p style={{
            color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 600,
            marginBottom: '16px',
          }}>
            {t('{tomados} de {total} hoy', { tomados, total })}
          </p>
        )}

        {error && (
          <ErrorRetry
            message={t('No pudimos cargar tus suplementos.')}
            onRetry={refetch}
            style={{ marginBottom: '16px' }}
          />
        )}

        {loading && !supplements.length && (
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: '62px', borderRadius: 'var(--r-md)' }} />
            ))}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            border: '1px dashed var(--c-border)', borderRadius: 'var(--r-lg)',
          }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {t('Sin suplementos todavía')}
            </p>
            <p style={{
              color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px',
              lineHeight: 1.5, maxWidth: '32ch', marginInline: 'auto',
            }}>
              {t('Añade lo que tomas y tendrás el checklist del día. Marcarlos lleva un toque.')}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {supplements.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px',
                background: 'var(--c-surface)',
                border: `1px solid ${s.taken ? 'var(--c-success)' : 'var(--c-border-subtle)'}`,
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--e-1)',
                transition: 'border-color 160ms var(--ease-out)',
              }}
            >
              {/* La casilla es el elemento grande: es el único gesto diario. */}
              <button
                onClick={() => setTaken(s.id, !s.taken)}
                role="switch"
                aria-checked={s.taken}
                aria-label={t('Marcar {nombre} como tomado', { nombre: s.name })}
                {...pressable(0.94)}
                style={{
                  flexShrink: 0, width: '44px', height: '44px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--r-sm)',
                  background: s.taken ? 'var(--c-success)' : 'transparent',
                  border: `1.5px solid ${s.taken ? 'var(--c-success)' : 'var(--c-border)'}`,
                  color: s.taken ? '#fff' : 'var(--c-text-ghost)',
                  fontSize: '17px', fontWeight: 800,
                }}
              >
                <span aria-hidden="true">✓</span>
              </button>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}>
                  {s.name}
                </span>
                {(s.dose || s.timing?.length > 0) && (
                  <span style={{
                    display: 'block', color: 'var(--c-text-muted)', fontSize: '11.5px',
                    marginTop: '2px',
                  }}>
                    {[s.dose, s.timing?.map(x => t(x)).join(' · ')].filter(Boolean).join(' — ')}
                  </span>
                )}
              </span>

              <button
                onClick={() => removeSupplement(s.id).catch(() => {})}
                aria-label={t('Quitar {nombre} del stack', { nombre: s.name })}
                style={{
                  flexShrink: 0, minWidth: '44px', minHeight: '44px',
                  color: 'var(--c-text-ghost)', fontSize: '15px', background: 'transparent',
                }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ))}
        </div>

        {adding && <AddSheet onClose={() => setAdding(false)} onSave={addSupplement} />}
      </div>
    </Layout>
  )
}
