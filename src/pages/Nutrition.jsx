import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Sheet, Field, Button, PageHeader, LiveRegion, UndoSnackbar } from '../components/ui'
import MacroBar from '../components/MacroBar'
import NutritionTargetsSheet from '../components/NutritionTargetsSheet'
import NutritionMicrosSheet from '../components/NutritionMicrosSheet'
import { NUTRIENTS, MICRO_KEYS, NUTRIENT_BY_KEY, nonZeroKeys, sanitizeMicros, scaleFood } from '../lib/nutrients'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { ERROR_STYLE } from '../lib/ui'
import { searchFoods, normalizeFood, parseServing } from '../lib/foodLibrary'
import { useClientDetail } from '../hooks/useClientDetail'
import { useProfile } from '../hooks/useProfile'
import { useLang } from '../hooks/useLang'
import {
  useNutritionDay, useNutritionTargets, useMyFoods, totalsOf,
  toLocalISODate, MEALS, DEFAULT_TARGETS,
} from '../hooks/useNutrition'

// ── Fecha helpers ────────────────────────────────────────────────────────
function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

function labelForISO(iso, t = (x) => x, locale = 'es-CO') {
  const today = toLocalISODate()
  if (iso === today) return t('Hoy')
  if (iso === shiftISO(today, -1)) return t('Ayer')
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)

// Los botones de día: fantasma dentro de la tarjeta del resumen, no dos
// superficies elevadas propias compitiendo con ella.
const dayNavBtn = (disabled) => ({
  width: '36px', height: '36px', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: disabled ? 'var(--c-text-ghost)' : 'var(--c-text-dim)',
  fontSize: '17px', background: 'transparent', border: 'none',
  borderRadius: '999px', opacity: disabled ? 0.5 : 1,
  cursor: disabled ? 'default' : 'pointer',
})

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
  const { t } = useLang()
  const editing = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [meal, setMeal] = useState(initial?.meal || defaultMeal || 'desayuno')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein_g) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs_g) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat_g) : '')
  // Los micros van en un solo objeto y no en dieciséis estados de texto: son
  // demasiados para editarlos uno a uno y casi siempre llegan ya puestos,
  // desde una sugerencia o desde lo que registró Claude.
  const [micros, setMicros] = useState(initial?.micros || {})
  const [saving, setSaving] = useState(false)

  // Base para porciones: la comida elegida (o la entrada al editar), con su
  // porción de referencia. `amount` es la cantidad editable en esa unidad.
  const [base, setBase] = useState(initial
    ? { qty: 1, unit: 'porción', kcal: Number(initial.kcal), protein_g: Number(initial.protein_g), carbs_g: Number(initial.carbs_g), fat_g: Number(initial.fat_g), micros: initial.micros || {} }
    : null)
  const [amount, setAmount] = useState('1')
  const [picked, setPicked] = useState(editing)

  const num = (v) => (v === '' ? 0 : Math.max(0, parseFloat(v) || 0))
  // kcal vacío = calculado de los macros (4P + 4C + 9G)
  const kcalComputed = Math.round(num(protein) * 4 + num(carbs) * 4 + num(fat) * 9)
  const kcalFinal = kcal === '' ? kcalComputed : num(kcal)
  const canSave = name.trim() && (kcalFinal > 0 || num(protein) > 0 || num(carbs) > 0 || num(fat) > 0)

  const applyBase = (b, m) => {
    const s = scaleFood(b, m)
    setProtein(s.protein_g ? String(s.protein_g) : '')
    setCarbs(s.carbs_g ? String(s.carbs_g) : '')
    setFat(s.fat_g ? String(s.fat_g) : '')
    setKcal(s.kcal ? String(s.kcal) : '')
    setMicros(s.micros)
  }

  // Porción de referencia de una sugerencia: de la biblioteca personal
  // (serving_qty/unit) o parseada del texto de la biblioteca incorporada.
  const baseFromSuggestion = (f) => {
    const { qty, unit } = f.serving_qty != null
      ? { qty: Number(f.serving_qty), unit: f.serving_unit }
      : parseServing(f.serving)
    return { qty, unit, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), micros: f.micros || {} }
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
    micros: b.micros || {},
  })

  const doSave = async (fields, food) => {
    if (saving) return
    setSaving(true)
    try { await onSave(fields, food) } finally { setSaving(false) }
  }

  const handleSave = () => {
    if (!canSave) return
    const limpios = sanitizeMicros(micros)
    const entry = { name: name.trim(), meal, kcal: kcalFinal, protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat), micros: limpios }
    // Toda comida nueva queda en la biblioteca personal: con su porción de
    // referencia si vino de una sugerencia, o tal cual (1 porción) si es nueva.
    const food = editing ? null : (base
      ? foodFields(base, name)
      : { name: name.trim(), serving_qty: 1, serving_unit: 'porción', kcal: kcalFinal, protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat), micros: limpios })
    doSave(entry, food)
  }

  // Registro instantáneo de una sugerencia, tal cual (porción base).
  const quickAdd = (f) => doSave(
    { name: f.name, meal, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), micros: sanitizeMicros(f.micros) },
    foodFields(baseFromSuggestion(f), f.name)
  )

  // Editar un macro a mano desengancha la cantidad: los campos mandan.
  const manual = (setter) => (e) => { setter(e.target.value); setAmount('') }

  // Micros a mano. Solo se enseñan los que tienen valor más los que el usuario
  // haya pedido añadir: dieciséis campos vacíos serían un muro que nadie
  // rellena, y casi siempre llegan ya puestos desde una sugerencia o del MCP.
  const [microsOpen, setMicrosOpen] = useState(false)
  const [extraKeys, setExtraKeys] = useState([])
  const shownMicros = MICRO_KEYS.filter(k => Number(micros[k]) > 0 || extraKeys.includes(k))
  const setMicro = (key, v) => { setMicros(prev => ({ ...prev, [key]: v })); setAmount('') }

  return (
    <Sheet title={t(editing ? 'Editar comida' : 'Agregar comida')} onClose={onClose}>
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
        <div style={{ margin: '-4px 0 14px', border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--c-surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-muted)', padding: '8px 12px 4px' }}>
            {t('Sugerencias · toca para llenar, + para registrar ya')}
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
                <p className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '2px', letterSpacing: '-0.01em' }}>
                  {servingLabel(f) ? `${servingLabel(f)} · ` : ''}{fmt(f.kcal)} kcal · P {Math.round(f.protein_g)} · C {Math.round(f.carbs_g)} · G {Math.round(f.fat_g)}
                </p>
              </button>
              <button
                onClick={() => quickAdd(f)}
                disabled={saving}
                aria-label={`Registrar ${f.name} ahora`}
                style={{
                  flexShrink: 0, width: '44px', height: '44px', margin: '0 6px 0 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--c-on-action)', background: 'var(--c-accent)',
                  borderRadius: '999px', fontSize: '20px', fontWeight: 400, lineHeight: 1,
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
                flex: 1, padding: '9px 4px', borderRadius: 'var(--r-xs)',
                fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em',
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
                    flex: 1, padding: '9px 4px', borderRadius: 'var(--r-xs)',
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

      <div style={{ marginBottom: '14px' }}>
        <button
          onClick={() => setMicrosOpen(o => !o)}
          aria-expanded={microsOpen}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer' }}
        >
          <span aria-hidden style={{ color: 'var(--c-text-dim)', fontSize: '10px', display: 'inline-block', transform: microsOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms var(--ease-out)' }}>▾</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
            {t('Micronutrientes')}
          </span>
          {nonZeroKeys(micros).length > 0 && (
            <span className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-muted)' }}>
              {nonZeroKeys(micros).length}
            </span>
          )}
        </button>

        {microsOpen && (
          <div style={{ marginTop: '8px' }}>
            {shownMicros.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: '10px' }}>
                {shownMicros.map(key => (
                  <label key={key} style={{ display: 'block' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '3px' }}>
                      {t(NUTRIENT_BY_KEY[key].label)}
                      <span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}> {NUTRIENT_BY_KEY[key].unit}</span>
                    </span>
                    <input
                      className="input-field tnum" type="number" inputMode="decimal" placeholder="0"
                      value={micros[key] ?? ''}
                      onChange={e => setMicro(key, e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {NUTRIENTS.filter(n => !shownMicros.includes(n.key)).map(n => (
                <button
                  key={n.key}
                  onClick={() => setExtraKeys(prev => [...prev, n.key])}
                  style={{
                    padding: '6px 10px', borderRadius: '999px',
                    fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '-0.01em',
                    background: 'var(--c-surface-2)', color: 'var(--c-text-dim)',
                    border: '1px solid var(--c-border-subtle)', cursor: 'pointer',
                  }}
                >
                  + {t(n.label)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || !canSave}
        onClick={handleSave}
        style={{ marginTop: '8px' }}
      >
        {t(saving ? 'Guardando...' : 'Guardar')}
      </Button>

      {editing && (
        <Button
          variant="danger" full size="md"
          onClick={() => onDelete(initial.id)}
          style={{ marginTop: '10px' }}
        >
          {t('Eliminar')}
        </Button>
      )}
    </Sheet>
  )
}

// ── Nutrition ────────────────────────────────────────────────────────────
// Vista propia por defecto; un entrenador pasa userId + readOnly para ver el
// registro de ese cliente (solo lectura) y planificar sus objetivos.
export default function Nutrition({ userId = null, readOnly = false }) {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const today = toLocalISODate()
  const [dateISO, setDateISO] = useState(today)
  const isToday = dateISO === today

  const { entries, loading, error, refetch, addEntry, updateEntry, deleteEntry } = useNutritionDay(dateISO, userId)
  const { foods, saveFood } = useMyFoods()
  const { targets, saveTargets, hasCustomTargets } = useNutritionTargets(userId)
  const { profile: clientProfile } = useClientDetail(readOnly ? userId : null)
  const { profile: myProfile } = useProfile()
  // El perfil de quien come, no el de quien mira: un entrenador planificando a
  // un cliente tiene que ver el cálculo hecho con el cuerpo del cliente.
  const planProfile = readOnly ? clientProfile : myProfile
  const tgt = targets || DEFAULT_TARGETS

  const [sheet, setSheet] = useState(null)   // { entry?, meal? } | 'targets' | null

  // Undoable entry delete (shared primitive) — hide optimistically, commit
  // after a grace window, announce to screen readers.
  const entryDelete = useUndoableDelete(entry => deleteEntry(entry.id))
  const pendingId = entryDelete.pending?.id

  // Colapso por comida, recordado en el dispositivo.
  const [collapsedMeals, setCollapsedMeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nutrition-meals-collapsed')) || {} } catch { return {} }
  })
  const toggleMeal = (id) => setCollapsedMeals(prev => {
    const next = { ...prev, [id]: !prev[id] }
    try { localStorage.setItem('nutrition-meals-collapsed', JSON.stringify(next)) } catch { /* sin storage */ }
    return next
  })

  // Oculta la entrada pendiente de borrado (ventana de deshacer). El héroe,
  // las barras y las secciones parten todos de la misma lista filtrada: antes
  // los totales se recalculaban restando campo a campo, y cada dato nuevo
  // (ahora los micros) había que acordarse de restarlo también.
  const visibleEntries = useMemo(
    () => entries.filter(e => e.id !== pendingId),
    [entries, pendingId]
  )
  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map(m => [m.id, []]))
    for (const e of visibleEntries) (map[e.meal] || map.snack).push(e)
    return map
  }, [visibleEntries])

  const shownTotals = useMemo(() => totalsOf(visibleEntries), [visibleEntries])
  const visibleCount = visibleEntries.length

  const kcalPct = tgt.kcal > 0 ? Math.min(100, (shownTotals.kcal / tgt.kcal) * 100) : 0
  const kcalOver = shownTotals.kcal > tgt.kcal

  // Cuántos micros están donde deben. Un techo se cumple por debajo y un piso
  // por encima, así que no se puede contar con una sola comparación.
  const microStats = useMemo(() => {
    const tm = tgt.micros || {}
    const conObjetivo = MICRO_KEYS.filter(k => Number(tm[k]) > 0)
    const ok = conObjetivo.filter(k => {
      const cur = Number(shownTotals.micros?.[k]) || 0
      const obj = Number(tm[k])
      return NUTRIENT_BY_KEY[k].dir === 'ceiling' ? cur <= obj : cur >= obj
    }).length
    return { total: conObjetivo.length, ok }
  }, [tgt, shownTotals])

  const handleSaveEntry = async (fields, food) => {
    if (sheet?.entry) {
      await updateEntry(sheet.entry.id, fields)
      entryDelete.setLiveMsg(`«${fields.name}» actualizada.`)
    } else {
      await addEntry(fields)
      // Actualiza la biblioteca personal en segundo plano; si falla, la
      // entrada del día ya quedó guardada.
      if (food) saveFood(food).catch(err => console.error('Error guardando comida en biblioteca:', err))
      entryDelete.setLiveMsg(`«${fields.name}» registrada.`)
    }
    setSheet(null)
  }

  // Borrado deshacible: cierra la hoja y arranca la ventana de deshacer.
  const handleDeleteEntry = () => {
    const entry = sheet?.entry
    setSheet(null)
    if (entry) entryDelete.request(entry, {
      deletedMsg: `«${entry.name}» eliminada. Toca deshacer para recuperarla.`,
      restoredMsg: `«${entry.name}» restaurada.`,
    })
  }

  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[720px] md:px-8">

        {readOnly ? (
          /* Cabecera de coach: volver al cliente + nombre, mismo patrón que Stats */
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '20px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
              aria-label="Volver"
            >
              ←
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em' }}>
                {t('Nutrición')}
              </h1>
              {clientProfile?.name && (
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginTop: '2px' }}>
                  {clientProfile.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setSheet('targets')}
              style={{
                flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--c-action-text)', border: '1px solid var(--c-accent-border)',
                borderRadius: '999px', padding: '7px 14px', background: 'transparent',
              }}
            >
              {t('Plan')}
            </button>
          </div>
        ) : (
          <PageHeader
            title="Nutrición"
            right={
              <button
                onClick={() => setSheet('targets')}
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--c-action-text)', border: '1px solid var(--c-accent-border)',
                  borderRadius: '999px', padding: '7px 14px', background: 'transparent',
                }}
              >
                {t('Objetivos')}
              </button>
            }
          />
        )}

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{readOnly ? t('No pudimos cargar sus comidas.') : t('No pudimos cargar tus comidas.')}</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-accent-border)', borderRadius: 'var(--r-xs)', padding: '6px 12px', background: 'transparent' }}
            >
              {t('Reintentar')}
            </button>
          </div>
        )}

        {/* ── El día ──
            El resumen —calorías, progreso y macros— es lo que se viene a ver
            y estaba suelto sobre el fondo, mientras las comidas de abajo sí
            tenían estructura. Ahora es una superficie del sistema, y la
            navegación de día entra en su cabecera: eran 90px de cromo (dos
            botones de 44px con elevación propia) para un control que se toca
            mucho menos que «+». */}
        <div className="fade-in material" style={{ padding: '18px', marginBottom: '22px', animationDelay: '40ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setDateISO(shiftISO(dateISO, -1))}
              aria-label={t('Día anterior')}
              style={dayNavBtn(false)}
            >
              ‹
            </button>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                {labelForISO(dateISO, t, locale)}
              </p>
              {!isToday && (
                <button
                  onClick={() => setDateISO(today)}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, color: 'var(--c-action-text)', marginTop: '2px', letterSpacing: '-0.01em' }}
                >
                  {t('Volver a hoy')}
                </button>
              )}
            </div>
            <button
              onClick={() => !isToday && setDateISO(shiftISO(dateISO, 1))}
              aria-label={t('Día siguiente')}
              disabled={isToday}
              style={dayNavBtn(isToday)}
            >
              ›
            </button>
          </div>

          <p className="tnum" style={{ lineHeight: 0.9, marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '52px', fontWeight: 900, letterSpacing: '-0.05em', color: kcalOver ? 'var(--c-action-text)' : 'var(--c-text)' }}>
              {fmt(shownTotals.kcal)}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--c-text-muted)', marginLeft: '10px' }}>
              / {fmt(tgt.kcal)} kcal
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

          <p className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: kcalOver ? 'var(--c-action-text)' : 'var(--c-text-dim)', margin: '-10px 0 18px' }}>
            {kcalOver
              ? `${fmt(shownTotals.kcal - tgt.kcal)} kcal por encima`
              : `Quedan ${fmt(tgt.kcal - shownTotals.kcal)} kcal`}
          </p>

          {/* Meta por defecto: invita a fijar objetivos propios (solo si no los tiene) */}
          {!readOnly && !hasCustomTargets && (
            <button
              onClick={() => setSheet('targets')}
              style={{ display: 'inline-block', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-action-text)', background: 'transparent', border: 'none', padding: 0, margin: '-8px 0 18px', cursor: 'pointer' }}
            >
              {t('Meta por defecto · fija la tuya →')}
            </button>
          )}

          <div style={{ display: 'flex', gap: '18px' }}>
            <MacroBar label="Proteína" current={shownTotals.protein} target={tgt.protein_g} />
            <MacroBar label="Carbos"   current={shownTotals.carbs}   target={tgt.carbs_g} />
            <MacroBar label="Grasa"    current={shownTotals.fat}     target={tgt.fat_g} />
          </div>

          {/* Los micros son dieciséis barras y esta tarjeta ya pelea por cada
              píxel de alto. Aquí va solo el titular —y la cobertura, que es lo
              que dice cuánto vale el titular—; el detalle vive en su hoja. */}
          <button
            onClick={() => setSheet('micros')}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              marginTop: '16px', paddingTop: '14px',
              background: 'transparent',
              border: 'none', borderTop: '1px solid var(--c-border-subtle)',
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '-0.01em', color: 'var(--c-action-text)',
              cursor: 'pointer',
            }}
          >
            {/* Sin comidas, «4 de 16 en objetivo» sería cierto —no te has
                pasado de ningún techo— pero se lee como si llevaras algo
                hecho. Con el día en blanco no se cuenta nada. */}
            {microStats.total === 0
              ? t('Micros · sin objetivos todavía ›')
              : visibleCount === 0
                ? t('Micros · nada registrado hoy ›')
                : t('Micros · {ok} de {total} en objetivo · {cov} de {n} comidas con datos ›', {
                    ok: microStats.ok, total: microStats.total,
                    cov: shownTotals.covered, n: visibleCount,
                  })}
          </button>
        </div>

        {/* ── Comidas del día ── */}
        {loading && entries.length === 0 ? (
          <div aria-hidden="true">
            {MEALS.map((m, i) => (
              <div key={m.id} style={{ marginBottom: '22px' }}>
                <div className="skeleton" style={{ height: '15px', width: '108px', borderRadius: 'var(--r-xs)', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '42px', borderRadius: 'var(--r-sm)', opacity: 1 - i * 0.12 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="fade-in" style={{ animationDelay: '80ms' }}>
            {/* El bloque de «Registra tu primera comida» ocupaba 250px para
                decir lo mismo que ya dicen las cuatro filas de abajo, cada una
                con su «Toca + para añadir». Se queda una línea. */}
            {!readOnly && visibleCount === 0 && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '18px' }}>
                {t('Toca + en cualquier comida, busca un alimento y regístralo en segundos.')}
              </p>
            )}
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
                        <span className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                          {isCollapsed && list.length > 0 ? `${list.length} · ` : ''}{fmt(mealKcal)} kcal
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => setSheet({ meal: m.id })}
                          aria-label={`Agregar a ${m.label}`}
                          style={{ color: 'var(--c-action-text)', fontSize: '22px', fontWeight: 300, lineHeight: 1, minWidth: '44px', minHeight: '44px', margin: '-12px -12px -12px 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (list.length === 0 ? (
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '8px 0 2px', borderTop: '1px solid var(--c-border-subtle)' }}>
                      {t('Nada anotado')}
                    </p>
                  ) : (
                    <div>
                      {list.map(e => (
                        <button
                          key={e.id}
                          onClick={readOnly ? undefined : () => setSheet({ entry: e })}
                          disabled={readOnly}
                          className={readOnly ? undefined : 'pressable'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                            width: '100%', textAlign: 'left', padding: '11px 0',
                            background: 'transparent', border: 'none',
                            borderTop: '1px solid var(--c-border-subtle)',
                            cursor: readOnly ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.name}
                            </p>
                            <p className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '3px', letterSpacing: '-0.01em' }}>
                              P {Math.round(e.protein_g)} · C {Math.round(e.carbs_g)} · G {Math.round(e.fat_g)}
                            </p>
                          </div>
                          <span className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
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
        <NutritionTargetsSheet
          targets={targets}
          userId={userId}
          profile={planProfile}
          onOpenProfile={readOnly ? null : () => navigate('/profile?s=caracteristicas')}
          title={t(readOnly ? 'Plan de nutrición' : 'Objetivos diarios')}
          subtitle={readOnly
            ? `Calorías y macros diarios para ${clientProfile?.name || 'tu cliente'}.`
            : t('Tu meta de calorías y macros para cada día.')}
          onSave={async (fields) => { await saveTargets(fields); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'micros' && (
        <NutritionMicrosSheet
          totals={shownTotals}
          targets={tgt}
          entryCount={visibleCount}
          coveredCount={shownTotals.covered}
          onOpenTargets={() => setSheet('targets')}
          onClose={() => setSheet(null)}
        />
      )}
      {!readOnly && sheet && sheet !== 'targets' && sheet !== 'micros' && (
        <EntrySheet
          initial={sheet.entry}
          defaultMeal={sheet.meal}
          foods={foods}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onClose={() => setSheet(null)}
        />
      )}

      {/* ── Feedback compartido: región viva + snackbar de deshacer ── */}
      <LiveRegion>{entryDelete.liveMsg}</LiveRegion>
      <UndoSnackbar show={!!entryDelete.pending} message="Comida eliminada" onUndo={entryDelete.undo} />
    </Layout>
  )
}
