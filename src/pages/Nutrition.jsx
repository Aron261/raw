import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { Sheet, Field, Button, PageHeader } from '../components/ui'
import { ERROR_STYLE } from '../lib/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { searchFoods, normalizeFood, parseServing } from '../lib/foodLibrary'
import {
  useNutritionDay, useNutritionTargets, useMyFoods,
  toLocalISODate, MEALS, DEFAULT_TARGETS, recommendMacros,
} from '../hooks/useNutrition'

// ── Fecha helpers ────────────────────────────────────────────────────────
function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

function labelForISO(iso) {
  const today = toLocalISODate()
  if (iso === today) return 'Hoy'
  if (iso === shiftISO(today, -1)) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const fmt = (n) => Math.round(n).toLocaleString('es-CO')

// ── Barra de progreso de macro ───────────────────────────────────────────
function MacroBar({ label, current, target, unit = 'g' }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const over = target > 0 && current > target
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', marginBottom: '5px' }}>
        {label}
      </p>
      <p className="tnum" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: over ? 'var(--c-action-text)' : 'var(--c-text)', marginBottom: '6px' }}>
        {fmt(current)}<span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}> / {fmt(target)} {unit}</span>
      </p>
      <div
        style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      >
        <div style={{
          height: '100%', width: '100%',
          transformOrigin: 'left center',
          transform: `scaleX(${pct / 100})`,
          background: over ? 'var(--c-action)' : 'var(--c-data)',
          borderRadius: '999px',
          transition: 'transform 500ms var(--ease-out)',
        }} />
      </div>
    </div>
  )
}

// ── Sheet: agregar / editar comida ───────────────────────────────────────
const PORTIONS = [
  { m: 0.5, label: '½' },
  { m: 1,   label: '1' },
  { m: 1.5, label: '1½' },
  { m: 2,   label: '2' },
]

// Etiqueta de porción para una sugerencia: "100 g", "1 unidad", nada si es genérica.
function servingLabel(f) {
  if (f.serving) return f.serving                     // biblioteca incorporada
  if (f.serving_qty == null) return null
  const q = Number(f.serving_qty)
  if (q === 1 && f.serving_unit === 'porción') return null
  return `${q % 1 ? q : Math.round(q)} ${f.serving_unit}`
}

function EntrySheet({ initial, defaultMeal, foods, onSave, onDelete, onClose }) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [meal, setMeal] = useState(initial?.meal || defaultMeal || 'desayuno')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein_g) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs_g) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat_g) : '')
  const [saving, setSaving] = useState(false)

  // Base para porciones: la comida elegida (o la entrada al editar), con su
  // porción de referencia. `amount` es la cantidad editable en esa unidad.
  const [base, setBase] = useState(initial
    ? { qty: 1, unit: 'porción', kcal: Number(initial.kcal), protein_g: Number(initial.protein_g), carbs_g: Number(initial.carbs_g), fat_g: Number(initial.fat_g) }
    : null)
  const [amount, setAmount] = useState('1')
  const [picked, setPicked] = useState(editing)

  const num = (v) => (v === '' ? 0 : Math.max(0, parseFloat(v) || 0))
  // kcal vacío = calculado de los macros (4P + 4C + 9G)
  const kcalComputed = Math.round(num(protein) * 4 + num(carbs) * 4 + num(fat) * 9)
  const kcalFinal = kcal === '' ? kcalComputed : num(kcal)
  const canSave = name.trim() && (kcalFinal > 0 || num(protein) > 0 || num(carbs) > 0 || num(fat) > 0)

  const scale1 = (v, m) => Math.round(Number(v) * m * 10) / 10

  const applyBase = (b, m) => {
    setProtein(b.protein_g ? String(scale1(b.protein_g, m)) : '')
    setCarbs(b.carbs_g ? String(scale1(b.carbs_g, m)) : '')
    setFat(b.fat_g ? String(scale1(b.fat_g, m)) : '')
    setKcal(b.kcal ? String(Math.round(b.kcal * m)) : '')
  }

  // Porción de referencia de una sugerencia: de la biblioteca personal
  // (serving_qty/unit) o parseada del texto de la biblioteca incorporada.
  const baseFromSuggestion = (f) => {
    const { qty, unit } = f.serving_qty != null
      ? { qty: Number(f.serving_qty), unit: f.serving_unit }
      : parseServing(f.serving)
    return { qty, unit, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g) }
  }

  const pickSuggestion = (f) => {
    const b = baseFromSuggestion(f)
    setName(f.name)
    setBase(b)
    setAmount(String(b.qty))
    setPicked(true)
    applyBase(b, 1)
  }

  // Sugerencias: biblioteca personal primero, luego comidas típicas
  // (con la porción visible). Sin duplicados por nombre.
  const matches = useMemo(() => {
    if (editing || picked) return []
    const q = normalizeFood(name)
    const mine = (q ? foods.filter(f => normalizeFood(f.name).includes(q)) : foods)
      .slice(0, q ? 4 : 6)
    const seen = new Set(mine.map(f => normalizeFood(f.name)))
    const libList = searchFoods(name, 7 - mine.length)
      .filter(f => !seen.has(normalizeFood(f.name)))
    return [...mine, ...libList]
  }, [foods, name, editing, picked])

  const foodFields = (b, foodName) => ({
    name: foodName.trim(), serving_qty: b.qty, serving_unit: b.unit,
    kcal: b.kcal, protein_g: b.protein_g, carbs_g: b.carbs_g, fat_g: b.fat_g,
  })

  const doSave = async (fields, food) => {
    if (saving) return
    setSaving(true)
    try { await onSave(fields, food) } finally { setSaving(false) }
  }

  const handleSave = () => {
    if (!canSave) return
    const entry = { name: name.trim(), meal, kcal: kcalFinal, protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat) }
    // Toda comida nueva queda en la biblioteca personal: con su porción de
    // referencia si vino de una sugerencia, o tal cual (1 porción) si es nueva.
    const food = editing ? null : (base
      ? foodFields(base, name)
      : { name: name.trim(), serving_qty: 1, serving_unit: 'porción', kcal: kcalFinal, protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat) })
    doSave(entry, food)
  }

  // Registro instantáneo de una sugerencia, tal cual (porción base).
  const quickAdd = (f) => doSave(
    { name: f.name, meal, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g) },
    foodFields(baseFromSuggestion(f), f.name)
  )

  // Editar un macro a mano desengancha la cantidad: los campos mandan.
  const manual = (setter) => (e) => { setter(e.target.value); setAmount('') }

  return (
    <Sheet title={editing ? 'Editar comida' : 'Agregar comida'} onClose={onClose}>
      <Field label="Nombre">
        <input
          className="input-field"
          placeholder="Busca o escribe: Pollo con arroz"
          value={name}
          onChange={e => { setName(e.target.value); setPicked(false) }}
          autoFocus={!editing}
        />
      </Field>

      {matches.length > 0 && (
        <div style={{ margin: '-4px 0 14px', border: '1px solid var(--c-border-subtle)', borderRadius: '12px', overflow: 'hidden', background: 'var(--c-surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)', padding: '8px 12px 4px' }}>
            Sugerencias · toca para llenar, + para registrar ya
          </p>
          {matches.map(f => (
            <div key={f.name.trim().toLowerCase()} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--c-border-subtle)' }}>
              <button
                onClick={() => pickSuggestion(f)}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </p>
                <p className="tnum" style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '2px', letterSpacing: '0.03em' }}>
                  {servingLabel(f) ? `${servingLabel(f)} · ` : ''}{fmt(f.kcal)} kcal · P {Math.round(f.protein_g)} · C {Math.round(f.carbs_g)} · G {Math.round(f.fat_g)}
                </p>
              </button>
              <button
                onClick={() => quickAdd(f)}
                disabled={saving}
                aria-label={`Registrar ${f.name} ahora`}
                style={{
                  flexShrink: 0, width: '34px', height: '34px', margin: '0 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--c-on-action)', background: 'var(--c-accent)',
                  borderRadius: '999px', fontSize: '17px', fontWeight: 400, lineHeight: 1,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      <Field label="Comida">
        <div style={{ display: 'flex', gap: '6px' }}>
          {MEALS.map(m => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: '8px',
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
                background: meal === m.id ? 'var(--c-accent)' : 'var(--c-surface-2)',
                color: meal === m.id ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                border: `1px solid ${meal === m.id ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                transition: 'all 150ms',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Field>

      {base && (
        <Field
          label={base.unit && base.unit !== 'porción' ? `Porción (${base.unit})` : 'Porción'}
          hint={amount === '' ? 'Macros ajustados a mano' : undefined}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              className="input-field tnum" type="number" inputMode="decimal"
              placeholder={String(base.qty)}
              value={amount}
              onChange={e => {
                const v = e.target.value
                setAmount(v)
                const a = parseFloat(v)
                if (Number.isFinite(a) && a > 0) applyBase(base, a / base.qty)
              }}
              style={{ flex: '0 0 88px', width: '88px' }}
              aria-label="Cantidad"
            />
            {PORTIONS.map(p => {
              const val = Math.round(base.qty * p.m * 10) / 10
              const active = parseFloat(amount) === val
              return (
                <button
                  key={p.m}
                  onClick={() => { setAmount(String(val)); applyBase(base, p.m) }}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 700,
                    background: active ? 'var(--c-accent)' : 'var(--c-surface-2)',
                    color: active ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                    border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                    transition: 'all 150ms',
                  }}
                >
                  ×{p.label}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field label="Proteína (g)">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={protein} onChange={manual(setProtein)} />
        </Field>
        <Field label="Carbos (g)">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={manual(setCarbs)} />
        </Field>
        <Field label="Grasa (g)">
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={fat} onChange={manual(setFat)} />
        </Field>
        <Field label="Calorías" hint={kcal === '' && kcalComputed > 0 ? `Auto: ${kcalComputed} kcal` : undefined}>
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder={kcalComputed > 0 ? String(kcalComputed) : '0'} value={kcal} onChange={manual(setKcal)} />
        </Field>
      </div>

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || !canSave}
        onClick={handleSave}
        style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>

      {editing && (
        <Button
          variant="danger" full size="md"
          onClick={() => onDelete(initial.id)}
          style={{ marginTop: '10px' }}
        >
          Eliminar
        </Button>
      )}
    </Sheet>
  )
}

// ── Sheet: objetivos diarios ─────────────────────────────────────────────
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

function TargetsSheet({ targets, onSave, onClose }) {
  const t = targets || DEFAULT_TARGETS
  const { user } = useAuth()
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
    if (!user?.id) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('body_weight_logs')
        .select('weight, unit')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(1)
      if (!alive || !data?.[0]) return
      const kg = data[0].unit === 'lb' ? data[0].weight * LB_TO_KG : data[0].weight
      setWeight(prev => (prev === '' ? String(Math.round(kg)) : prev))
    })()
    return () => { alive = false }
  }, [user?.id])

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
    <Sheet
      title="Objetivos diarios"
      subtitle="Tu meta de calorías y macros para cada día."
      onClose={onClose}
    >
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
            ? 'Ingresa tu meta de calorías y tu peso ideal para calcular los macros.'
            : 'Ingresa tu meta de calorías y el reparto de macros.'}
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

// ── Nutrition ────────────────────────────────────────────────────────────
export default function Nutrition() {
  const today = toLocalISODate()
  const [dateISO, setDateISO] = useState(today)
  const isToday = dateISO === today

  const { entries, totals, loading, error, refetch, addEntry, updateEntry, deleteEntry } = useNutritionDay(dateISO)
  const { foods, saveFood } = useMyFoods()
  const { targets, saveTargets } = useNutritionTargets()
  const t = targets || DEFAULT_TARGETS

  const [sheet, setSheet] = useState(null)   // { entry?, meal? } | 'targets' | null

  // Colapso por comida, recordado en el dispositivo.
  const [collapsedMeals, setCollapsedMeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nutrition-meals-collapsed')) || {} } catch { return {} }
  })
  const toggleMeal = (id) => setCollapsedMeals(prev => {
    const next = { ...prev, [id]: !prev[id] }
    try { localStorage.setItem('nutrition-meals-collapsed', JSON.stringify(next)) } catch { /* sin storage */ }
    return next
  })

  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map(m => [m.id, []]))
    for (const e of entries) (map[e.meal] || map.snack).push(e)
    return map
  }, [entries])

  const kcalPct = t.kcal > 0 ? Math.min(100, (totals.kcal / t.kcal) * 100) : 0
  const kcalOver = totals.kcal > t.kcal

  const handleSaveEntry = async (fields, food) => {
    if (sheet?.entry) {
      await updateEntry(sheet.entry.id, fields)
    } else {
      await addEntry(fields)
      // Actualiza la biblioteca personal en segundo plano; si falla, la
      // entrada del día ya quedó guardada.
      if (food) saveFood(food).catch(err => console.error('Error guardando comida en biblioteca:', err))
    }
    setSheet(null)
  }

  const handleDeleteEntry = async (id) => {
    await deleteEntry(id)
    setSheet(null)
  }

  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[720px] md:px-8">

        <PageHeader
          title="Nutrición"
          right={
            <button
              onClick={() => setSheet('targets')}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--c-accent)', border: '1px solid var(--c-accent-border)',
                borderRadius: '999px', padding: '7px 14px', background: 'transparent',
              }}
            >
              Objetivos
            </button>
          }
        />

        {/* ── Navegación de día ── */}
        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <button
            onClick={() => setDateISO(shiftISO(dateISO, -1))}
            aria-label="Día anterior"
            style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-dim)', fontSize: '18px', border: '1px solid var(--c-border-subtle)', borderRadius: '12px', background: 'var(--c-surface)' }}
          >
            ‹
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text)' }}>
              {labelForISO(dateISO)}
            </p>
            {!isToday && (
              <button
                onClick={() => setDateISO(today)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-accent)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Volver a hoy
              </button>
            )}
          </div>
          <button
            onClick={() => !isToday && setDateISO(shiftISO(dateISO, 1))}
            aria-label="Día siguiente"
            disabled={isToday}
            style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isToday ? 'var(--c-text-ghost)' : 'var(--c-text-dim)', fontSize: '18px', border: '1px solid var(--c-border-subtle)', borderRadius: '12px', background: 'var(--c-surface)', opacity: isToday ? 0.5 : 1 }}
          >
            ›
          </button>
        </div>

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>No pudimos cargar tus comidas.</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-accent)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-accent-border)', borderRadius: '8px', padding: '6px 12px', background: 'transparent' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Hero: kcal del día ── */}
        <div className="fade-in" style={{ marginBottom: '26px', animationDelay: '40ms' }}>
          <p className="tnum" style={{ lineHeight: 0.9, marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '52px', fontWeight: 900, letterSpacing: '-0.05em', color: kcalOver ? 'var(--c-action-text)' : 'var(--c-text)' }}>
              {fmt(totals.kcal)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--c-text-muted)', marginLeft: '10px' }}>
              / {fmt(t.kcal)} kcal
            </span>
          </p>
          <div
            style={{ background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden', marginBottom: '18px' }}
            role="progressbar" aria-valuenow={Math.round(kcalPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Calorías del día"
          >
            <div style={{
              height: '100%', width: '100%',
              transformOrigin: 'left center',
              transform: `scaleX(${kcalPct / 100})`,
              background: kcalOver ? 'var(--c-action)' : 'var(--c-data)',
              borderRadius: '999px',
              transition: 'transform 500ms var(--ease-out)',
            }} />
          </div>

          <p className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', color: kcalOver ? 'var(--c-action-text)' : 'var(--c-text-dim)', margin: '-10px 0 18px' }}>
            {kcalOver
              ? `${fmt(totals.kcal - t.kcal)} kcal por encima`
              : `Quedan ${fmt(t.kcal - totals.kcal)} kcal`}
          </p>

          <div style={{ display: 'flex', gap: '18px' }}>
            <MacroBar label="Proteína" current={totals.protein} target={t.protein_g} />
            <MacroBar label="Carbos"   current={totals.carbs}   target={t.carbs_g} />
            <MacroBar label="Grasa"    current={totals.fat}     target={t.fat_g} />
          </div>
        </div>

        {/* ── Comidas del día ── */}
        {loading && entries.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: '58px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        ) : (
          <div className="fade-in" style={{ animationDelay: '80ms' }}>
            {MEALS.map(m => {
              const list = byMeal[m.id]
              const mealKcal = list.reduce((s, e) => s + Number(e.kcal || 0), 0)
              const isCollapsed = !!collapsedMeals[m.id]
              return (
                <section key={m.id} style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <button
                      onClick={() => toggleMeal(m.id)}
                      aria-expanded={!isCollapsed}
                      style={{ display: 'flex', alignItems: 'baseline', gap: '7px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0 }}
                    >
                      <span aria-hidden style={{ color: 'var(--c-text-dim)', fontSize: '10px', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms var(--ease-out)' }}>
                        ▾
                      </span>
                      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                        {m.label}
                      </h2>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexShrink: 0 }}>
                      {(mealKcal > 0 || (isCollapsed && list.length > 0)) && (
                        <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                          {isCollapsed && list.length > 0 ? `${list.length} · ` : ''}{fmt(mealKcal)} kcal
                        </span>
                      )}
                      <button
                        onClick={() => setSheet({ meal: m.id })}
                        aria-label={`Agregar a ${m.label}`}
                        style={{ color: 'var(--c-accent)', fontSize: '18px', fontWeight: 300, lineHeight: 1, padding: '4px 2px' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (list.length === 0 ? (
                    <p style={{ color: 'var(--c-text-ghost)', fontSize: '12px', padding: '8px 0 2px', borderTop: '1px solid var(--c-border-subtle)' }}>
                      Sin registros
                    </p>
                  ) : (
                    <div>
                      {list.map(e => (
                        <button
                          key={e.id}
                          onClick={() => setSheet({ entry: e })}
                          className="pressable"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                            width: '100%', textAlign: 'left', padding: '11px 0',
                            background: 'transparent', border: 'none',
                            borderTop: '1px solid var(--c-border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.name}
                            </p>
                            <p className="tnum" style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '3px', letterSpacing: '0.03em' }}>
                              P {Math.round(e.protein_g)} · C {Math.round(e.carbs_g)} · G {Math.round(e.fat_g)}
                            </p>
                          </div>
                          <span className="tnum" style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                            {fmt(e.kcal)} kcal
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </section>
              )
            })}
          </div>
        )}

      </div>

      {/* ── Sheets ── */}
      {sheet === 'targets' && (
        <TargetsSheet
          targets={targets}
          onSave={async (fields) => { await saveTargets(fields); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet !== 'targets' && (
        <EntrySheet
          initial={sheet.entry}
          defaultMeal={sheet.meal}
          foods={foods}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onClose={() => setSheet(null)}
        />
      )}
    </Layout>
  )
}
