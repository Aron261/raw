import { useState } from 'react'
import { Sheet, Field, Button } from '../ui'
import { KINDS } from '../../lib/calendar'
import { useLang } from '../../hooks/useLang'

// ── SessionLogSheet ──────────────────────────────────────────────────────
// Lo que pasó en una sesión que no es de fuerza. Tres cifras y ninguna
// obligatoria: media hora de bici sin mirar el cuentakilómetros sigue siendo
// media hora de bici, y forzar un 0 en distancia sería mentir en el historial.
//
// No hay campo de series ni de peso a propósito. El motor de Raw es reps ×
// peso; el cardio no cabe ahí sin inventarse números, y esos números
// contaminarían el volumen y los PR. Se mide por sesión.
export default function SessionLogSheet({ session, onSave, onClose }) {
  const { t } = useLang()
  const meta = KINDS[session.kind] || KINDS.note

  const [duration, setDuration] = useState(session.duration_min ?? '')
  const [distance, setDistance] = useState(session.distance_km ?? '')
  const [rpe, setRpe] = useState(session.rpe ?? null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  // Solo tiene sentido si te desplazas. En movilidad no se pregunta.
  const showsDistance = session.kind === 'cardio'

  // Vacío → null ("no lo sé"), nunca 0.
  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        status: 'done',
        duration_min: duration === '' ? null : Math.round(num(duration) ?? 0) || null,
        distance_km: showsDistance ? num(distance) : null,
        rpe: rpe ?? null,
      })
      onClose()
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={session.title || t(meta.label)}
      subtitle={t('¿Qué hiciste?')}
      onClose={onClose}
    >
      {err && <p style={{ color: 'var(--c-action-text)', fontSize: '11px', marginBottom: '10px' }}>{err}</p>}

      <Field label="Duración" hint="Minutos">
        <input
          className="input-field"
          type="number"
          inputMode="numeric"
          min="1"
          placeholder="—"
          value={duration}
          onChange={e => setDuration(e.target.value)}
        />
      </Field>

      {showsDistance && (
        <Field label="Distancia" hint="Kilómetros — opcional">
          <input
            className="input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="—"
            value={distance}
            onChange={e => setDistance(e.target.value)}
          />
        </Field>
      )}

      {/* El esfuerzo se toca, no se teclea: es la cifra que se registra con el
          pulso todavía alto. Volver a tocar el mismo número lo deja en blanco,
          que es como se dice "no lo sé" sin un botón de borrar. */}
      <Field label="Esfuerzo" hint="RPE 1–10 — opcional">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
            const on = rpe === n
            return (
              <button
                key={n}
                onClick={() => setRpe(on ? null : n)}
                aria-pressed={on}
                aria-label={`RPE ${n}`}
                style={{
                  minWidth: '44px', minHeight: '44px', flex: '1 0 auto',
                  borderRadius: 'var(--r-xs)',
                  fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  background: on ? 'var(--c-accent)' : 'var(--c-surface-2)',
                  color: on ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                  border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </Field>

      <Button variant="primary" full size="lg" loading={saving} disabled={saving} onClick={save}>
        {saving ? t('Guardando...') : t('Registrar')}
      </Button>
    </Sheet>
  )
}
