import { useMemo, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import Layout from '../components/Layout'
import Segmented from '../components/stats/Segmented'
import { Sheet, Field, Button, PageHeader } from '../components/ui'
import { ERROR_STYLE } from '../lib/ui'
import { useTheme } from '../hooks/useTheme'
import { useSupplements, TIMING_OPTIONS } from '../hooks/useSupplements'
import { useBloodwork, COMMON_MARKERS, inRange } from '../hooks/useBloodwork'
import { toLocalISODate } from '../hooks/useNutrition'

// Chart colors must be literal hex — CSS vars don't resolve in recharts SVG attrs.
const SPARK_COLORS = {
  'slate-light': '#3E5C76',
  'slate-dark':  '#7FA0BE',
  'riso-light':  '#2438FF',
  'riso-dark':   '#6E7BFF',
}

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtValue = (v) => {
  const n = Number(v)
  return Number.isInteger(n) ? n.toLocaleString('es-CO') : n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

// ── Sheet: agregar / editar suplemento ───────────────────────────────────
function SupplementSheet({ initial, onSave, onDelete, onClose }) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [dose, setDose] = useState(initial?.dose || '')
  const [timing, setTiming] = useState(initial?.timing || [])
  const [isActive, setIsActive] = useState(initial ? initial.is_active : true)
  const [saving, setSaving] = useState(false)

  const toggleTiming = (t) =>
    setTiming(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), dose: dose.trim() || null, timing, is_active: isActive })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={editing ? 'Editar suplemento' : 'Agregar suplemento'} onClose={onClose}>
      <Field label="Nombre">
        <input
          className="input-field"
          placeholder="Ej: Creatina"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus={!editing}
        />
      </Field>

      <Field label="Dosis" hint="Opcional — ej: 5 g, 2 cápsulas, 4000 UI">
        <input
          className="input-field"
          placeholder="Ej: 5 g"
          value={dose}
          onChange={e => setDose(e.target.value)}
        />
      </Field>

      <Field label="Momento">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TIMING_OPTIONS.map(t => {
            const on = timing.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleTiming(t)}
                aria-pressed={on}
                style={{
                  padding: '9px 14px', borderRadius: '999px',
                  fontSize: '11px', fontWeight: 700,
                  background: on ? 'var(--c-accent)' : 'var(--c-surface-2)',
                  color: on ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                  border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                  transition: 'all 150ms',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </Field>

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || !name.trim()}
        onClick={handleSave}
        style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>

      {editing && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <Button
            variant="secondary" size="md" style={{ flex: 1 }}
            onClick={async () => {
              setIsActive(!isActive)
              await onSave({ name: name.trim() || initial.name, dose: dose.trim() || null, timing, is_active: !isActive })
            }}
          >
            {isActive ? 'Pausar' : 'Reactivar'}
          </Button>
          <Button variant="danger" size="md" style={{ flex: 1 }} onClick={() => onDelete(initial.id)}>
            Eliminar
          </Button>
        </div>
      )}
    </Sheet>
  )
}

// ── Vista: Stack ─────────────────────────────────────────────────────────
function StackView({ supplements, onOpenSheet }) {
  const { active, paused, takenIds, takenCount, toggleTaken, loading } = supplements

  if (loading && active.length === 0 && paused.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: '64px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    )
  }

  if (active.length === 0 && paused.length === 0) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px', marginBottom: '16px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Arma tu stack
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '36ch', margin: '0 auto' }}>
            Registra los suplementos que tomas — dosis y momento del día — y marca cada día lo que ya tomaste.
          </p>
        </div>
        <Button variant="primary" full size="lg" onClick={() => onOpenSheet({})}>
          Agregar suplemento
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Adherencia de hoy — el número es el héroe */}
      <div style={{ marginBottom: '22px' }}>
        <p className="tnum" style={{ lineHeight: 0.9 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '46px', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--c-text)' }}>
            {takenCount}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text-ghost)' }}>
            /{active.length}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)', marginLeft: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            tomados hoy
          </span>
        </p>
      </div>

      {/* Lista activa — check de 44px por fila */}
      <div style={{ marginBottom: '18px' }}>
        {active.map((s, i) => {
          const taken = takenIds.has(s.id)
          const subParts = [s.dose, ...(s.timing || [])].filter(Boolean)
          return (
            <div
              key={s.id}
              className="stagger-item"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '13px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
                animationDelay: `${i * 30}ms`,
              }}
            >
              <button
                onClick={() => toggleTaken(s.id).catch(() => {})}
                role="checkbox"
                aria-checked={taken}
                aria-label={`${s.name}: ${taken ? 'tomado' : 'pendiente'}`}
                style={{
                  width: '44px', height: '44px', borderRadius: '14px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: taken ? 'var(--c-success)' : 'var(--c-surface)',
                  border: taken ? '1px solid transparent' : '1px solid var(--c-border)',
                  color: 'var(--c-bg)',
                  transition: 'background 180ms var(--ease-out), border-color 180ms var(--ease-out)',
                  cursor: 'pointer',
                }}
              >
                {taken && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => onOpenSheet({ supplement: s })}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <p style={{
                  color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: taken ? 'none' : 'none',
                }}>
                  {s.name}
                </p>
                {subParts.length > 0 && (
                  <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '3px', letterSpacing: '0.03em' }}>
                    {subParts.join(' · ')}
                  </p>
                )}
              </button>

              <button
                onClick={() => onOpenSheet({ supplement: s })}
                aria-label={`Editar ${s.name}`}
                style={{ color: 'var(--c-text-ghost)', fontSize: '16px', padding: '8px 2px', flexShrink: 0 }}
              >
                ›
              </button>
            </div>
          )
        })}
      </div>

      <Button variant="secondary" full size="md" onClick={() => onOpenSheet({})}>
        + Agregar suplemento
      </Button>

      {/* Pausados */}
      {paused.length > 0 && (
        <div style={{ marginTop: '26px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-ghost)', marginBottom: '6px' }}>
            Pausados
          </p>
          {paused.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onOpenSheet({ supplement: s })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                width: '100%', textAlign: 'left', padding: '11px 0',
                background: 'transparent', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
                cursor: 'pointer',
              }}
            >
              <p style={{ color: 'var(--c-text-ghost)', fontSize: '13px', fontWeight: 700 }}>
                {s.name}
              </p>
              <span style={{ color: 'var(--c-text-ghost)', fontSize: '16px' }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sheet: registrar resultado de bloodwork ──────────────────────────────
function BloodworkSheet({ onSave, onClose }) {
  const today = toLocalISODate()
  const [panelDate, setPanelDate] = useState(today)
  const [marker, setMarker] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [refLow, setRefLow] = useState('')
  const [refHigh, setRefHigh] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const canSave = marker.trim() && value !== '' && Number.isFinite(parseFloat(value))

  const buildFields = () => ({
    panel_date: panelDate,
    marker: marker.trim(),
    value: parseFloat(value),
    unit: unit.trim() || null,
    ref_low: refLow !== '' ? parseFloat(refLow) : null,
    ref_high: refHigh !== '' ? parseFloat(refHigh) : null,
  })

  const save = async (keepOpen) => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave(buildFields(), keepOpen)
      if (keepOpen) {
        setMarker(''); setValue(''); setUnit(''); setRefLow(''); setRefHigh('')
        setSavedCount(c => c + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Registrar resultado"
      subtitle="Un marcador por registro — misma fecha para todo el panel."
      onClose={onClose}
    >
      <Field label="Fecha del panel">
        <input
          className="input-field"
          type="date"
          value={panelDate}
          max={today}
          onChange={e => setPanelDate(e.target.value)}
        />
      </Field>

      <Field label="Marcador">
        <input
          className="input-field"
          list="raw-markers"
          placeholder="Ej: Testosterona total"
          value={marker}
          onChange={e => setMarker(e.target.value)}
        />
        <datalist id="raw-markers">
          {COMMON_MARKERS.map(m => <option key={m} value={m} />)}
        </datalist>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field label="Valor">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={value} onChange={e => setValue(e.target.value)} />
        </Field>
        <Field label="Unidad" hint="Opcional">
          <input className="input-field" placeholder="ng/dL" value={unit} onChange={e => setUnit(e.target.value)} />
        </Field>
        <Field label="Rango mín." hint="Opcional">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="—" value={refLow} onChange={e => setRefLow(e.target.value)} />
        </Field>
        <Field label="Rango máx." hint="Opcional">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="—" value={refHigh} onChange={e => setRefHigh(e.target.value)} />
        </Field>
      </div>

      {savedCount > 0 && (
        <p style={{ color: 'var(--c-success)', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
          {savedCount} {savedCount === 1 ? 'resultado guardado' : 'resultados guardados'} en este panel
        </p>
      )}

      <Button variant="primary" full size="lg" loading={saving} disabled={saving || !canSave} onClick={() => save(false)} style={{ marginTop: '4px' }}>
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
      <Button variant="secondary" full size="md" disabled={saving || !canSave} onClick={() => save(true)} style={{ marginTop: '10px' }}>
        Guardar y agregar otro
      </Button>
    </Sheet>
  )
}

// ── Vista: Bloodwork ─────────────────────────────────────────────────────
function BloodworkView({ bloodwork, sparkColor, onOpenSheet }) {
  const { byMarker, lastPanelDate, loading, deleteResult } = bloodwork
  const [expanded, setExpanded] = useState(null)

  if (loading && byMarker.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: '64px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    )
  }

  if (byMarker.length === 0) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px', marginBottom: '16px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Registra tu primer panel
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, maxWidth: '38ch', margin: '0 auto' }}>
            Pasa los resultados de tu laboratorio — marcador, valor y rango de referencia — y Raw te muestra la tendencia de cada uno con el tiempo.
          </p>
        </div>
        <Button variant="primary" full size="lg" onClick={onOpenSheet}>
          Registrar resultado
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)' }}>
          Último panel: {fmtDate(lastPanelDate)}
        </p>
        <button
          onClick={onOpenSheet}
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--c-accent)', border: '1px solid var(--c-accent-border)',
            borderRadius: '999px', padding: '7px 14px', background: 'transparent',
          }}
        >
          + Registrar
        </button>
      </div>

      {byMarker.map(({ marker, history, latest }, i) => {
        const open = expanded === marker
        const status = inRange(latest)
        const chartData = history.map(r => ({ v: Number(r.value) }))
        return (
          <div key={marker} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)' }}>
            <button
              onClick={() => setExpanded(open ? null : marker)}
              aria-expanded={open}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                width: '100%', textAlign: 'left', padding: '14px 0',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '4px' }}>
                  {marker}
                </p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--c-text-muted)' }}>
                  {status !== null && (
                    <>
                      <span aria-hidden="true" style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: status ? 'var(--c-success)' : 'var(--c-action)',
                      }} />
                      <span style={{ color: status ? 'var(--c-success)' : 'var(--c-action-text)' }}>
                        {status ? 'En rango' : 'Fuera de rango'}
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  {fmtDate(latest.panel_date)}
                </p>
              </div>

              {chartData.length >= 2 && (
                <div style={{ width: '72px', height: '30px', flexShrink: 0 }} aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                  {fmtValue(latest.value)}
                </p>
                {latest.unit && (
                  <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>
                    {latest.unit}
                  </p>
                )}
              </div>

              <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true" style={{ color: 'var(--c-text-ghost)', fontSize: '11px', flexShrink: 0 }}>
                ▼
              </span>
            </button>

            {open && (
              <div style={{ paddingBottom: '14px' }}>
                {(latest.ref_low != null || latest.ref_high != null) && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: '8px', letterSpacing: '0.03em' }}>
                    Rango de referencia: {latest.ref_low ?? '—'} – {latest.ref_high ?? '—'} {latest.unit || ''}
                  </p>
                )}
                {[...history].reverse().map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    padding: '8px 0', borderTop: '1px solid var(--c-border-subtle)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                      {fmtDate(r.panel_date)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="tnum" style={{ fontSize: '13px', fontWeight: 800, color: inRange(r) === false ? 'var(--c-action-text)' : 'var(--c-text)' }}>
                        {fmtValue(r.value)} {r.unit || ''}
                      </span>
                      <button
                        onClick={() => deleteResult(r.id).catch(() => {})}
                        aria-label={`Eliminar registro de ${marker} del ${fmtDate(r.panel_date)}`}
                        style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '4px' }}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Longevity ────────────────────────────────────────────────────────────
export default function Longevity() {
  const [view, setView] = useState('stack')
  const [sheet, setSheet] = useState(null)   // { supplement? } | 'bloodwork' | null

  const supplements = useSupplements()
  const bloodwork = useBloodwork()
  const { resolved, palette } = useTheme()
  const sparkColor = SPARK_COLORS[`${palette}-${resolved}`] || SPARK_COLORS['slate-light']

  const error = view === 'stack' ? supplements.error : bloodwork.error
  const refetch = view === 'stack' ? supplements.refetch : bloodwork.refetch

  const handleSaveSupplement = async (fields) => {
    if (sheet?.supplement) await supplements.updateSupplement(sheet.supplement.id, fields)
    else await supplements.addSupplement(fields)
    setSheet(null)
  }

  const handleDeleteSupplement = async (id) => {
    await supplements.deleteSupplement(id)
    setSheet(null)
  }

  const handleSaveResult = async (fields, keepOpen) => {
    await bloodwork.addResult(fields)
    if (!keepOpen) setSheet(null)
  }

  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[720px] md:px-8">

        <PageHeader
          title="Longevidad"
          right={
            <Segmented
              ariaLabel="Vista de longevidad"
              options={[{ id: 'stack', label: 'STACK' }, { id: 'blood', label: 'SANGRE' }]}
              value={view}
              onChange={setView}
            />
          }
        />

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>No pudimos cargar tus datos.</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-accent)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-accent-border)', borderRadius: '8px', padding: '6px 12px', background: 'transparent' }}
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="fade-in" style={{ animationDelay: '40ms' }}>
          {view === 'stack' ? (
            <StackView supplements={supplements} onOpenSheet={setSheet} />
          ) : (
            <BloodworkView bloodwork={bloodwork} sparkColor={sparkColor} onOpenSheet={() => setSheet('bloodwork')} />
          )}
        </div>

      </div>

      {/* ── Sheets ── */}
      {sheet === 'bloodwork' && (
        <BloodworkSheet onSave={handleSaveResult} onClose={() => setSheet(null)} />
      )}
      {sheet && sheet !== 'bloodwork' && (
        <SupplementSheet
          initial={sheet.supplement}
          onSave={handleSaveSupplement}
          onDelete={handleDeleteSupplement}
          onClose={() => setSheet(null)}
        />
      )}
    </Layout>
  )
}
