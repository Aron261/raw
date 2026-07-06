import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { Sheet, Field, Button, PageHeader } from '../components/ui'
import { ERROR_STYLE } from '../lib/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  useNutritionDay, useNutritionTargets, useRecentFoods,
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

function EntrySheet({ initial, defaultMeal, recents, onSave, onDelete, onClose }) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [meal, setMeal] = useState(initial?.meal || defaultMeal || 'desayuno')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein_g) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs_g) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat_g) : '')
  const [saving, setSaving] = useState(false)

  // Base para porciones: la comida elegida de recientes (o la entrada al editar).
  const [base, setBase] = useState(initial
    ? { kcal: Number(initial.kcal), protein_g: Number(initial.protein_g), carbs_g: Number(initial.carbs_g), fat_g: Number(initial.fat_g) }
    : null)
  const [mult, setMult] = useState(1)
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

  const pickRecent = (f) => {
    const b = { kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g) }
    setName(f.name)
    setBase(b)
    setMult(1)
    setPicked(true)
    applyBase(b, 1)
  }

  const matches = useMemo(() => {
    if (editing || picked) return []
    const q = name.trim().toLowerCase()
    const list = q ? recents.filter(f => f.name.toLowerCase().includes(q)) : recents
    return list.slice(0, 6)
  }, [recents, name, editing, picked])

  const doSave = async (fields) => {
    if (saving) return
    setSaving(true)
    try { await onSave(fields) } finally { setSaving(false) }
  }

  const handleSave = () => {
    if (!canSave) return
    doSave({ name: name.trim(), meal, kcal: kcalFinal, protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat) })
  }

  // Registro instantáneo de una comida reciente, tal cual (porción ×1).
  const quickAdd = (f) => doSave({
    name: f.name, meal,
    kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g),
  })

  // Editar un macro a mano invalida la porción seleccionada, no la base.
  const manual = (setter) => (e) => { setter(e.target.value); setMult(null) }

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
            Recientes · toca para llenar, + para registrar ya
          </p>
          {matches.map(f => (
            <div key={f.name.trim().toLowerCase()} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--c-border-subtle)' }}>
              <button
                onClick={() => pickRecent(f)}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </p>
                <p className="tnum" style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '2px', letterSpacing: '0.03em' }}>
                  {fmt(f.kcal)} kcal · P {Math.round(f.protein_g)} · C {Math.round(f.carbs_g)} · G {Math.round(f.fat_g)}
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
        <Field label="Porción" hint={mult === null ? 'Ajustada a mano' : undefined}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {PORTIONS.map(p => (
              <button
                key={p.m}
                onClick={() => { setMult(p.m); applyBase(base, p.m) }}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 700,
                  background: mult === p.m ? 'var(--c-accent)' : 'var(--c-surface-2)',
                  color: mult === p.m ? 'var(--c-on-action)' : 'var(--c-text-dim)',
                  border: `1px solid ${mult === p.m ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                  transition: 'all 150ms',
                }}
              >
                ×{p.label}
              </button>
            ))}
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

function TargetsSheet({ targets, onSave, onClose }) {
  const t = targets || DEFAULT_TARGETS
  const { user } = useAuth()
  const [mode, setMode] = useState('auto')   // 'auto' | 'manual'
  const [saving, setSaving] = useState(false)

  // Recomendado
  const [goalKcal, setGoalKcal] = useState(String(t.kcal))
  const [weight, setWeight] = useState('')

  // Manual
  const [kcal, setKcal] = useState(String(t.kcal))
  const [protein, setProtein] = useState(String(t.protein_g))
  const [carbs, setCarbs] = useState(String(t.carbs_g))
  const [fat, setFat] = useState(String(t.fat_g))

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

  const rec = useMemo(() => {
    const k = parseInt(goalKcal, 10)
    const w = parseFloat(weight)
    if (!Number.isFinite(k) || k <= 0 || !Number.isFinite(w) || w <= 0) return null
    return recommendMacros(k, w)
  }, [goalKcal, weight])

  const pct = (g, per, k) => (k > 0 ? Math.round((g * per / k) * 100) : 0)

  const num = (v, fallback) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }

  const handleSave = async () => {
    if (saving) return
    if (mode === 'auto' && !rec) return
    setSaving(true)
    try {
      await onSave(mode === 'auto' ? rec : {
        kcal: num(kcal, DEFAULT_TARGETS.kcal),
        protein_g: num(protein, DEFAULT_TARGETS.protein_g),
        carbs_g: num(carbs, DEFAULT_TARGETS.carbs_g),
        fat_g: num(fat, DEFAULT_TARGETS.fat_g),
      })
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
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button onClick={() => setMode('auto')} style={tabStyle(mode === 'auto')}>Recomendado</button>
        <button onClick={() => setMode('manual')} style={tabStyle(mode === 'manual')}>Manual</button>
      </div>

      {mode === 'auto' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Calorías (kcal)">
              <input className="input-field tnum" type="number" inputMode="numeric" value={goalKcal} onChange={e => setGoalKcal(e.target.value)} />
            </Field>
            <Field label="Peso ideal (kg)">
              <input className="input-field tnum" type="number" inputMode="decimal" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
            </Field>
          </div>

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
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
                Proteína = 2 g por kg de peso ideal · grasa 25% de las calorías · el resto, carbos.
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
              Ingresa tu meta de calorías y tu peso ideal para calcular los macros.
            </p>
          )}
        </>
      ) : (
        <>
          <Field label="Calorías (kcal)">
            <input className="input-field tnum" type="number" inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }}>
            {[
              { label: 'Proteína (g)', value: protein, set: setProtein, per: 4 },
              { label: 'Carbos (g)',   value: carbs,   set: setCarbs,   per: 4 },
              { label: 'Grasa (g)',    value: fat,     set: setFat,     per: 9 },
            ].map(x => {
              const k = parseInt(kcal, 10)
              const g = parseInt(x.value, 10)
              const hint = Number.isFinite(k) && k > 0 && Number.isFinite(g) && g >= 0
                ? `${pct(g, x.per, k)}%`
                : undefined
              return (
                <Field key={x.label} label={x.label} hint={hint}>
                  <input className="input-field tnum" type="number" inputMode="numeric" value={x.value} onChange={e => x.set(e.target.value)} />
                </Field>
              )
            })}
          </div>
        </>
      )}

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || (mode === 'auto' && !rec)}
        onClick={handleSave} style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : mode === 'auto' ? 'Usar estos objetivos' : 'Guardar objetivos'}
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
  const { recents } = useRecentFoods()
  const { targets, saveTargets } = useNutritionTargets()
  const t = targets || DEFAULT_TARGETS

  const [sheet, setSheet] = useState(null)   // { entry?, meal? } | 'targets' | null

  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map(m => [m.id, []]))
    for (const e of entries) (map[e.meal] || map.snack).push(e)
    return map
  }, [entries])

  const kcalPct = t.kcal > 0 ? Math.min(100, (totals.kcal / t.kcal) * 100) : 0
  const kcalOver = totals.kcal > t.kcal

  const handleSaveEntry = async (fields) => {
    if (sheet?.entry) await updateEntry(sheet.entry.id, fields)
    else await addEntry(fields)
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
              return (
                <section key={m.id} style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                      {m.label}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexShrink: 0 }}>
                      {mealKcal > 0 && (
                        <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                          {fmt(mealKcal)} kcal
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

                  {list.length === 0 ? (
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
                  )}
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
          recents={recents}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onClose={() => setSheet(null)}
        />
      )}
    </Layout>
  )
}
