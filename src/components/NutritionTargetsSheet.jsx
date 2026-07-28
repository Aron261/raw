import { useEffect, useMemo, useState } from 'react'
import { Sheet, Field, Button } from './ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { DEFAULT_TARGETS, recommendMacros } from '../hooks/useNutrition'

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)
const LB_TO_KG = 0.4536

// Balances de macros estilo MyFitnessPal (% de las calorías). 'peso' es la
// recomendación propia (2 g/kg), 'custom' es % libre y 'gramos' es exacto.
const BALANCES = [
  { id: 'peso',        label: '2 g/kg proteína' },
  { id: 'equilibrado', label: 'Equilibrado',    p: 20, c: 50, f: 30 },
  { id: 'alta',        label: 'Alta proteína',  p: 30, c: 45, f: 25 },
  { id: 'baja',        label: 'Baja en carbos', p: 25, c: 25, f: 50 },
  { id: 'keto',        label: 'Keto',           p: 25, c: 10, f: 65 },
  { id: 'custom',      label: '% personalizado' },
  { id: 'gramos',      label: 'Gramos exactos' },
]

const KCAL_OF = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9)

// Sheet para fijar los objetivos diarios de calorías y macros. Sin userId
// edita los del propio usuario; un entrenador pasa el userId del cliente
// para planificar su nutrición (el prefill de peso usa el peso del cliente).
export default function NutritionTargetsSheet({ targets, onSave, onClose, userId = null, title = 'Objetivos diarios', subtitle = 'Tu meta de calorías y macros para cada día.' }) {
  const t = targets || DEFAULT_TARGETS
  const { user } = useAuth()
  const ownerId = userId || user?.id
  const [mode, setMode] = useState('peso')
  const [saving, setSaving] = useState(false)

  const [kcal, setKcal] = useState(String(t.kcal))
  const [weight, setWeight] = useState('')

  // % personalizado: carbos siempre es el resto (100 − proteína − grasa).
  const [pctP, setPctP] = useState(String(Math.round((t.protein_g * 4 / t.kcal) * 100) || 30))
  const [pctF, setPctF] = useState(String(Math.round((t.fat_g * 9 / t.kcal) * 100) || 25))

  // Gramos exactos
  const [gP, setGP] = useState(String(t.protein_g))
  const [gC, setGC] = useState(String(t.carbs_g))
  const [gF, setGF] = useState(String(t.fat_g))

  // Prefill del peso ideal con el último peso registrado (solo si no ha escrito).
  useEffect(() => {
    if (!ownerId) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('body_weight_logs')
        .select('weight, unit')
        .eq('user_id', ownerId)
        .order('logged_at', { ascending: false })
        .limit(1)
      if (!alive || !data?.[0]) return
      const kg = data[0].unit === 'lb' ? data[0].weight * LB_TO_KG : data[0].weight
      setWeight(prev => (prev === '' ? String(Math.round(kg)) : prev))
    })()
    return () => { alive = false }
  }, [ownerId])

  // Objetivo calculado según el modo activo.
  const rec = useMemo(() => {
    const k = parseInt(kcal, 10)
    if (!Number.isFinite(k) || k <= 0) return null
    if (mode === 'peso') {
      const w = parseFloat(weight)
      if (!Number.isFinite(w) || w <= 0) return null
      return recommendMacros(k, w)
    }
    if (mode === 'gramos') {
      const p = parseFloat(gP) || 0
      const c = parseFloat(gC) || 0
      const f = parseFloat(gF) || 0
      if (p + c + f <= 0) return null
      return { kcal: k, protein_g: Math.round(p), carbs_g: Math.round(c), fat_g: Math.round(f) }
    }
    let p, c, f
    if (mode === 'custom') {
      p = parseFloat(pctP)
      f = parseFloat(pctF)
      if (!Number.isFinite(p) || !Number.isFinite(f) || p < 0 || f < 0 || p + f > 100) return null
      c = 100 - p - f
    } else {
      const b = BALANCES.find(x => x.id === mode)
      p = b.p; c = b.c; f = b.f
    }
    return {
      kcal: k,
      protein_g: Math.round(k * p / 100 / 4),
      carbs_g:   Math.round(k * c / 100 / 4),
      fat_g:     Math.round(k * f / 100 / 9),
    }
  }, [mode, kcal, weight, pctP, pctF, gP, gC, gF])

  const pct = (g, per, k) => (k > 0 ? Math.round((g * per / k) * 100) : 0)

  // Cambiar de modo hereda el objetivo actual para seguir ajustándolo.
  const switchMode = (id) => {
    if (rec) {
      if (id === 'gramos') {
        setGP(String(rec.protein_g)); setGC(String(rec.carbs_g)); setGF(String(rec.fat_g))
      } else if (id === 'custom') {
        setPctP(String(pct(rec.protein_g, 4, rec.kcal)))
        setPctF(String(pct(rec.fat_g, 9, rec.kcal)))
      }
    }
    setMode(id)
  }

  // Gramos: editar un macro recalcula las calorías (4P + 4C + 9G).
  const onGram = (which, setter) => (e) => {
    const v = e.target.value
    setter(v)
    const p = which === 'p' ? parseFloat(v) || 0 : parseFloat(gP) || 0
    const c = which === 'c' ? parseFloat(v) || 0 : parseFloat(gC) || 0
    const f = which === 'f' ? parseFloat(v) || 0 : parseFloat(gF) || 0
    if (p + c + f > 0) setKcal(String(KCAL_OF(p, c, f)))
  }

  // Calorías: en gramos, proteína y grasa quedan fijas y los carbos
  // absorben la diferencia.
  const onKcal = (e) => {
    const v = e.target.value
    setKcal(v)
    if (mode === 'gramos') {
      const k = parseInt(v, 10)
      if (Number.isFinite(k) && k > 0) {
        const p = parseFloat(gP) || 0
        const f = parseFloat(gF) || 0
        setGC(String(Math.max(0, Math.round((k - p * 4 - f * 9) / 4))))
      }
    }
  }

  const handleSave = async () => {
    if (saving || !rec) return
    setSaving(true)
    try {
      await onSave(rec)
    } finally {
      setSaving(false)
    }
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '9px 4px', borderRadius: '8px',
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
    background: active ? 'var(--c-accent)' : 'var(--c-surface-2)',
    color: active ? 'var(--c-on-action)' : 'var(--c-text-dim)',
    border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
    transition: 'all 150ms',
  })

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      <Field label="Balance de macros">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {BALANCES.map(b => (
            <button key={b.id} onClick={() => switchMode(b.id)} style={{ ...tabStyle(mode === b.id), flex: '1 1 30%' }}>
              {b.label}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field
          label="Calorías (kcal)"
          hint={mode === 'gramos' ? 'Editarla ajusta los carbos' : undefined}
        >
          <input className="input-field tnum" type="number" inputMode="numeric" value={kcal} onChange={onKcal} />
        </Field>
        {mode === 'peso' && (
          <Field label="Peso ideal (kg)">
            <input className="input-field tnum" type="number" inputMode="decimal" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
        )}
      </div>

      {mode === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }}>
          <Field label="Proteína (%)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={pctP} onChange={e => setPctP(e.target.value)} />
          </Field>
          <Field label="Grasa (%)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={pctF} onChange={e => setPctF(e.target.value)} />
          </Field>
          <Field label="Carbos (%)" hint="El resto">
            <input
              className="input-field tnum" type="number" disabled readOnly
              value={Math.max(0, 100 - (parseFloat(pctP) || 0) - (parseFloat(pctF) || 0))}
            />
          </Field>
        </div>
      )}

      {mode === 'gramos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }}>
          <Field label="Proteína (g)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={gP} onChange={onGram('p', setGP)} />
          </Field>
          <Field label="Carbos (g)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={gC} onChange={onGram('c', setGC)} />
          </Field>
          <Field label="Grasa (g)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={gF} onChange={onGram('f', setGF)} />
          </Field>
        </div>
      )}

      {rec ? (
        <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { label: 'Proteína', g: rec.protein_g, per: 4 },
              { label: 'Carbos',   g: rec.carbs_g,   per: 4 },
              { label: 'Grasa',    g: rec.fat_g,     per: 9 },
            ].map(x => (
              <div key={x.label} style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', marginBottom: '4px' }}>
                  {x.label}
                </p>
                <p className="tnum" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                  {x.g}<span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-muted)' }}> g</span>
                </p>
                <p className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)', marginTop: '2px' }}>
                  {pct(x.g, x.per, rec.kcal)}%
                </p>
              </div>
            ))}
          </div>
          {mode === 'peso' && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
              Proteína = 2 g por kg de peso ideal · grasa 25% de las calorías · el resto, carbos.
            </p>
          )}
          {mode === 'gramos' && KCAL_OF(parseFloat(gP) || 0, parseFloat(gC) || 0, parseFloat(gF) || 0) !== rec.kcal && (
            <p style={{ color: 'var(--c-action-text)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
              Los macros suman {fmt(KCAL_OF(parseFloat(gP) || 0, parseFloat(gC) || 0, parseFloat(gF) || 0))} kcal, no {fmt(rec.kcal)}.
            </p>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
          {mode === 'peso'
            ? 'Ingresa la meta de calorías y el peso ideal para calcular los macros.'
            : 'Ingresa la meta de calorías y el reparto de macros.'}
        </p>
      )}

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || !rec}
        onClick={handleSave} style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : 'Guardar objetivos'}
      </Button>
    </Sheet>
  )
}
