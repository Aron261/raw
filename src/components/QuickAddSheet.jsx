import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, Button, UnitToggle } from './ui'
import { useBodyWeight } from '../hooks/useBodyWeight'
import { useLang } from '../hooks/useLang'

/*
 * The universal "+" — one sheet to add anything, reachable from the tab bar
 * on every training screen. Options either hand off to an existing flow
 * (workout picker, nutrition, routine creation) or resolve inline (body
 * weight, the most requested "just let me log it" number).
 */
function OptionRow({ title, sub, onClick }) {
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        width: '100%', textAlign: 'left', padding: '16px 4px',
        background: 'transparent', borderTop: '1px solid var(--c-border-subtle)',
        cursor: 'pointer', minHeight: '44px',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
          {title}
        </span>
        {sub && (
          <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '3px' }}>
            {sub}
          </span>
        )}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--c-text-ghost)', fontSize: '16px', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>→</span>
    </button>
  )
}

export default function QuickAddSheet({ onClose, onStartWorkout }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { latestLog, addLog } = useBodyWeight()
  const [mode, setMode] = useState('menu') // 'menu' | 'peso'
  const [weight, setWeight] = useState('')
  // The lifter's own choice wins; until they make one we follow their last
  // entry, which only arrives once the logs load — so derive, don't seed state.
  const [unitChoice, setUnitChoice] = useState(null)
  const unit = unitChoice ?? latestLog?.unit ?? 'kg'
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const go = (path, state) => { onClose(); navigate(path, state ? { state } : undefined) }

  const saveWeight = async () => {
    const w = parseFloat(weight)
    if (!(w > 0) || saving) return
    setSaving(true)
    setSaveError(null)
    // addLog resolves to null on failure rather than throwing.
    const saved = await addLog(w, unit)
    if (saved) { onClose(); return }
    setSaveError('No se pudo guardar.')
    setSaving(false)
  }

  if (mode === 'peso') {
    return (
      <Sheet title="Registrar peso" subtitle="Tu peso corporal de hoy" onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={weight}
            onChange={e => setWeight(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveWeight() }}
            className="input-field"
            placeholder={latestLog ? String(latestLog.weight) : 'peso'}
            min="0"
            step="0.1"
            aria-label="Peso corporal"
            style={{ flex: 1, height: '48px', textAlign: 'center', fontSize: '18px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          />
          <UnitToggle value={unit} units={['kg', 'lb']} onChange={setUnitChoice} />
        </div>

        {saveError && (
          <p role="alert" style={{ color: 'var(--c-action-text)', fontSize: '11px', marginBottom: '12px' }}>
            {saveError} <button onClick={saveWeight} style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 700 }}>{t('Reintentar')}</button>
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button variant="primary" full size="lg" loading={saving} disabled={saving || !(parseFloat(weight) > 0)} onClick={saveWeight}>
            {t('Guardar')}
          </Button>
          <Button variant="ghost" full onClick={() => setMode('menu')}>← {t('Atrás')}</Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('Agregar')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <OptionRow
          title={t('Empezar entreno')}
          sub={t('Desde tu rutina o en blanco')}
          onClick={() => onStartWorkout()}
        />
        <OptionRow
          title={t('Registrar peso')}
          sub={latestLog ? `${t('Último')}: ${latestLog.weight} ${latestLog.unit}` : t('Tu peso corporal de hoy')}
          onClick={() => setMode('peso')}
        />
        <OptionRow
          title={t('Añadir comida')}
          sub={t('Macros y calorías de hoy')}
          onClick={() => go('/nutrition')}
        />
        <OptionRow
          title={t('Crear rutina')}
          sub={t('Recomendada, desde cero o desde un entreno')}
          onClick={() => go('/rutinas', { create: true })}
        />
      </div>
    </Sheet>
  )
}
