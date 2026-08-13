import { useMemo, useState } from 'react'
import { Sheet, Field, Button } from '../ui'
import MicroGrid from '../MicroGrid'
import NutritionMicrosSheet from '../NutritionMicrosSheet'
import {
  NUTRIENTS, MICRO_KEYS, NUTRIENT_BY_KEY, nonZeroKeys, sanitizeMicros, scaleFood,
} from '../../lib/nutrients'
import { searchFoods, normalizeFood, parseServing } from '../../lib/foodLibrary'
import { MEALS } from '../../hooks/useNutrition'
import { useLang } from '../../hooks/useLang'

// El editor de una comida.
//
// Vivía dentro de pages/Nutrition. Sale aquí porque la pantalla de un día
// (/dia/:fecha) necesita el MISMO editor: micronutrientes, biblioteca de
// alimentos y escalado por porción incluidos. Escribir un segundo editor más
// simple para el día habría sido garantizar que los dos se separan solos —
// alguien arregla un redondeo en uno y no en el otro, y la misma comida sale
// distinta según por dónde la registres.

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)

// Los múltiplos de porción de un toque. Media, una, una y media, dos: cubren
// casi todo lo que se come sin teclear un número.
const PORTIONS = [
  { m: 0.5, label: '½' },
  { m: 1,   label: '1' },
  { m: 1.5, label: '1½' },
  { m: 2,   label: '2' },
]

function servingLabel(f) {
  if (f.serving) return f.serving                     // biblioteca incorporada
  if (f.serving_qty == null) return null
  const q = Number(f.serving_qty)
  if (q === 1 && f.serving_unit === 'porción') return null
  return `${q % 1 ? q : Math.round(q)} ${f.serving_unit}`
}

export default function EntrySheet({ initial, defaultMeal, foods, onSave, onDelete, onClose }) {
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

  // Guardar sin señal fallaba en silencio: el spinner paraba, la hoja seguía
  // abierta y nadie sabía si la comida quedó registrada. El error se muestra
  // aquí mismo y la hoja no se cierra (cerrar lo hace onSave solo si guardó).
  const [saveError, setSaveError] = useState(null)
  const doSave = async (fields, food) => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try { await onSave(fields, food) }
    catch (err) { setSaveError(err?.message || t('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')) }
    finally { setSaving(false) }
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
      <Field label={t('Nombre')}>
        <input
          className="input-field"
          placeholder={t('Busca o escribe: Pollo con arroz')}
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

      <Field label={t('Comida')}>
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
              {t(m.label)}
            </button>
          ))}
        </div>
      </Field>

      {base && (
        <Field
          label={base.unit && base.unit !== 'porción' ? `${t('Porción')} (${base.unit})` : t('Porción')}
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
        <Field label={t('Proteína (g)')}>
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={protein} onChange={manual(setProtein)} />
        </Field>
        <Field label={t('Carbos (g)')}>
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={manual(setCarbs)} />
        </Field>
        <Field label={t('Grasa (g)')}>
          <input className="input-field tnum" type="number" inputMode="decimal" placeholder="0" value={fat} onChange={manual(setFat)} />
        </Field>
        <Field label={t('Calorías')} hint={kcal === '' && kcalComputed > 0 ? `${t('Auto:')} ${kcalComputed} kcal` : undefined}>
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
                      aria-label={`${t(NUTRIENT_BY_KEY[key].label)} (${NUTRIENT_BY_KEY[key].unit})`}
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

      {saveError && (
        <div className="fade-in" role="alert" style={{
          color: 'var(--c-text)', background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)',
          padding: '10px 12px', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em',
          marginTop: '8px',
        }}>
          {saveError}
        </div>
      )}

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
