import { useState } from 'react'
import { Button, UnitToggle } from '../ui'
import { useBodyWeight } from '../../hooks/useBodyWeight'
import { toLocalISODate } from '../../lib/calendar'
import { useLang } from '../../hooks/useLang'

// ── DayWeight ────────────────────────────────────────────────────────────
// El peso corporal de un día, dentro de la hoja del calendario.
//
// Se puede anotar aunque el día ya haya pasado: la báscula se mira por la
// mañana y la app se abre por la noche, o dos días después. Antes solo se
// podía registrar "ahora", así que el peso del martes entraba fechado el
// jueves y la curva contaba dos jueves y ningún martes.
//
// El futuro no se pesa: ahí no se ofrece el campo. No es una restricción
// técnica, es que un peso "del viernes que viene" no es un dato.
export default function DayWeight({ dateISO, isFuture }) {
  const { t, locale } = useLang()
  const { logs, latestLog, addLog, adding } = useBodyWeight()

  const [value, setValue] = useState('')
  const [unitChoice, setUnitChoice] = useState(null)
  const [err, setErr] = useState(null)

  // La misma regla que el «+» de la barra: la unidad en la que te pesaste la
  // última vez. Elegirla de nuevo cada día sería preguntar lo ya contestado.
  const unit = unitChoice ?? latestLog?.unit ?? 'kg'

  // El registro de ESE día. logged_at es un timestamp, así que se compara por
  // fecha local — el peso de las 11pm es del martes, no del miércoles UTC.
  const log = logs.find(l => toLocalISODate(new Date(l.logged_at)) === dateISO) || null

  const save = async () => {
    const n = parseFloat(String(value).replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) { setErr(t('Escribe un peso válido.')); return }
    setErr(null)
    // Mediodía del día elegido: cualquier hora vale, pero el mediodía no se
    // corre de día con un cambio de horario ni al leerlo desde otro huso.
    const row = await addLog(n, unit, null, `${dateISO}T12:00:00`)
    if (!row) { setErr(t('No se pudo guardar.')); return }
    setValue('')
  }

  if (isFuture && !log) return null

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{
        fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px',
        fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px',
      }}>
        {t('Peso corporal')}
      </p>

      {err && (
        <p style={{ color: 'var(--c-action-text)', fontSize: '11px', marginBottom: '8px' }}>{err}</p>
      )}

      {log ? (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '8px',
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
          borderRadius: 'var(--r-sm)', padding: '12px',
        }}>
          <span className="tnum" style={{
            fontFamily: 'var(--font-sans)', fontSize: '19px', fontWeight: 900,
            letterSpacing: '-0.03em', color: 'var(--c-text)',
          }}>
            {Number(log.weight).toLocaleString(locale, { maximumFractionDigits: 2 })}
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
            color: 'var(--c-text-muted)',
          }}>
            {log.unit}
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch', marginBottom: '8px' }}>
            <input
              className="input-field"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              aria-label={t('Peso corporal')}
              placeholder={unit}
              value={value}
              onChange={e => setValue(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button
              variant="secondary"
              size="md"
              disabled={adding || !value}
              onClick={save}
            >
              {adding ? t('Guardando...') : t('Guardar')}
            </Button>
          </div>
          <UnitToggle value={unit} units={['kg', 'lb']} onChange={setUnitChoice} />
        </>
      )}
    </div>
  )
}
