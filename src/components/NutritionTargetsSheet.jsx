import { useEffect, useMemo, useState } from 'react'
import { Sheet, Field, Button } from './ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calcAge } from '../hooks/useProfile'
import { DEFAULT_TARGETS } from '../hooks/useNutrition'
import { useLang } from '../hooks/useLang'
import { usePlan } from '../hooks/usePlan'
import PremiumGate from './PremiumGate'
import { NUTRIENTS, CEILINGS, sanitizeMicros } from '../lib/nutrients'
import { recommendPlan, computeMacros, computeMicroTargets, toKg, toCm } from '../lib/nutritionPlan'

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)

// Balances de macros estilo MyFitnessPal (% de las calorías). 'peso' reparte
// con el mismo motor que el asistente —fase, masa magra y piso de grasa—, así
// que se llamaba «2 g/kg proteína» por un cálculo propio que ya no existe:
// tenerlo aparte hacía que la misma persona recibiera dos recomendaciones
// distintas según la pantalla que tocara. 'custom' es % libre y 'gramos' exacto.
const BALANCES = [
  { id: 'peso',        label: 'Según tu cuerpo' },
  { id: 'equilibrado', label: 'Equilibrado',    p: 20, c: 50, f: 30 },
  { id: 'alta',        label: 'Alta proteína',  p: 30, c: 45, f: 25 },
  { id: 'baja',        label: 'Baja en carbos', p: 25, c: 25, f: 50 },
  { id: 'keto',        label: 'Keto',           p: 25, c: 10, f: 65 },
  { id: 'custom',      label: '% personalizado' },
  { id: 'gramos',      label: 'Gramos exactos' },
]

const KCAL_OF = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9)

const CEILING_KEYS = new Set(CEILINGS.map(n => n.key))

// ── Tarjeta de recomendación ─────────────────────────────────────────────
// No es un octavo modo de reparto: los siete de abajo responden «cómo reparto
// las calorías» y esto responde «cuántas calorías». Presentarlos como
// alternativas haría creer que son lo mismo.
//
// «Usar esto» NO guarda. Rellena el editor de gramos y deja al usuario dentro,
// con los números puestos y libertad para tocarlos. Guardar sigue siendo un
// gesto aparte y explícito.
function RecommendationCard({ t, locale, plan, onApply, onOpenProfile }) {
  const [open, setOpen] = useState(false)

  // Algunas variables son a su vez claves del diccionario («Moderado»,
  // «Ganar volumen»). Hay que traducirlas ANTES de interpolarlas o en inglés
  // sale la frase traducida con la palabra en español dentro.
  const frase = (m) => {
    if (!m.tvars) return t(m.key, m.vars)
    const vars = { ...m.vars }
    for (const k of m.tvars) if (vars[k]) vars[k] = t(vars[k])
    return t(m.key, vars)
  }

  const box = {
    background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
    borderRadius: 'var(--r-md)', padding: '14px', marginBottom: '16px',
  }

  if (!plan.ok) {
    const falta = {
      weightKg: t('tu peso'),
      heightCm: t('tu altura'),
      age: t('tu fecha de nacimiento'),
    }
    return (
      <div style={box}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--c-text)', marginBottom: '5px' }}>
          {t('Podemos calcularlo por ti')}
        </p>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', lineHeight: 1.5 }}>
          {t('Nos falta {campos}.', { campos: plan.missing.map(m => falta[m] || m).join(', ') })}
        </p>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            style={{ marginTop: '10px', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-action-text)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {t('Completar en Perfil →')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={box}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '4px' }}>
          {t('Recomendado para ti')} <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms var(--ease-out)' }}>›</span>
        </p>
        <p className="tnum" style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text)' }}>
          {fmt(plan.kcal, locale)}
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-muted)' }}> kcal</span>
          <span className="tnum" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--c-text-dim)', marginLeft: '10px' }}>
            P {plan.protein_g} · C {plan.carbs_g} · G {plan.fat_g}
          </span>
        </p>
      </button>

      {open && (
        <div style={{ marginTop: '12px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {plan.reasons.map(r => (
              <li key={r.id} style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.55, paddingLeft: '11px', position: 'relative' }}>
                <span aria-hidden style={{ position: 'absolute', left: 0 }}>·</span>
                {frase(r)}
              </li>
            ))}
          </ul>
          {plan.warnings.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '9px 0 0' }}>
              {plan.warnings.map(w => (
                <li key={w.id} style={{ color: 'var(--c-action-text)', fontSize: '11px', lineHeight: 1.55, paddingLeft: '11px', position: 'relative' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0 }}>·</span>
                  {frase(w)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Píldora con borde de acento, no un Button primario: la acción
          principal de la hoja sigue siendo Guardar, y dos botones sólidos
          compitiendo dejarían al usuario sin saber cuál cierra el trámite.
          `secondary` tampoco vale — es del mismo color que esta tarjeta. */}
      <button
        onClick={onApply}
        style={{
          marginTop: '12px', width: '100%', padding: '11px 14px',
          fontFamily: 'var(--font-sans)', fontSize: '12.5px', fontWeight: 700,
          letterSpacing: '-0.01em', color: 'var(--c-action-text)',
          background: 'transparent', border: '1px solid var(--c-accent-border)',
          borderRadius: 'var(--r-sm)', cursor: 'pointer',
        }}
      >
        {t('Usar esto')}
      </button>
    </div>
  )
}

// ── Objetivos de micros ──────────────────────────────────────────────────
// Cerrado por defecto: son dieciséis campos que casi nadie va a tocar a mano,
// porque lo normal es traerlos de la recomendación.
function MicroTargetsSection({ t, values, onChange, onReset }) {
  const [open, setOpen] = useState(false)
  const puestos = NUTRIENTS.filter(n => Number(values[n.key]) > 0).length

  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer' }}
      >
        <span aria-hidden style={{ color: 'var(--c-text-dim)', fontSize: '10px', display: 'inline-block', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms var(--ease-out)' }}>▾</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
          {t('Micros')}
        </span>
        <span className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-muted)' }}>
          {puestos}/{NUTRIENTS.length}
        </span>
      </button>

      {open && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', margin: '8px 0 10px' }}>
            {NUTRIENTS.map(n => (
              <label key={n.key} style={{ display: 'block' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '-0.01em', color: CEILING_KEYS.has(n.key) ? 'var(--c-action-text)' : 'var(--c-text-dim)', marginBottom: '3px' }}>
                  {t(n.label)} <span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}>
                    {n.unit}{CEILING_KEYS.has(n.key) ? ` · ${t('techo')}` : ''}
                  </span>
                </span>
                <input
                  aria-label={`${t(n.label)} (${n.unit})`}
                  className="input-field tnum" type="number" inputMode="decimal" placeholder="0"
                  value={values[n.key] ?? ''}
                  onChange={e => onChange(n.key, e.target.value)}
                  style={{ height: '38px' }}
                />
              </label>
            ))}
          </div>
          <button
            onClick={onReset}
            style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-action-text)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {t('Recalcular con estas calorías')}
          </button>
        </div>
      )}
    </div>
  )
}

// Sheet para fijar los objetivos diarios de calorías y macros. Sin userId
// edita los del propio usuario; un entrenador pasa el userId del cliente
// para planificar su nutrición (el prefill de peso usa el peso del cliente).
export default function NutritionTargetsSheet({ targets, onSave, onClose, userId = null, profile = null, onOpenProfile = null, title = 'Objetivos diarios', subtitle = 'Tu meta de calorías y macros para cada día.' }) {
  const { t, locale } = useLang()
  const { isPro } = usePlan()
  const tgt = targets || DEFAULT_TARGETS
  const { user } = useAuth()
  const ownerId = userId || user?.id
  const [mode, setMode] = useState('peso')
  const [saving, setSaving] = useState(false)

  const [kcal, setKcal] = useState(String(tgt.kcal))
  const [weight, setWeight] = useState('')

  // % personalizado: carbos siempre es el resto (100 − proteína − grasa).
  const [pctP, setPctP] = useState(String(Math.round((tgt.protein_g * 4 / tgt.kcal) * 100) || 30))
  const [pctF, setPctF] = useState(String(Math.round((tgt.fat_g * 9 / tgt.kcal) * 100) || 25))

  // Gramos exactos
  const [gP, setGP] = useState(String(tgt.protein_g))
  const [gC, setGC] = useState(String(tgt.carbs_g))
  const [gF, setGF] = useState(String(tgt.fat_g))

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
      const kg = toKg(data[0].weight, data[0].unit)
      setWeight(prev => (prev === '' ? String(Math.round(kg)) : prev))
    })()
    return () => { alive = false }
  }, [ownerId])

  // Objetivos de micros. Viven FUERA del useMemo de `rec`: ese se recalcula en
  // cada tecla y cada cambio de modo, y se llevaría por delante lo que el
  // usuario acabara de poner aquí.
  const [microTargets, setMicroTargets] = useState(() => targets?.micros || {})
  const setMicro = (key, v) => setMicroTargets(prev => ({ ...prev, [key]: v }))

  // Candado de proteína. El número no se guarda aparte: es el protein_g que ya
  // hay, y esto solo dice «no lo recalcules». Se fija al valor GUARDADO y no al
  // que haya en el editor: así el candado significa siempre lo mismo, aunque
  // se esté toqueteando el reparto.
  const [proteinLocked, setProteinLocked] = useState(() => !!targets?.protein_locked)
  const lockedProtein = targets?.protein_g ?? null
  const canLock = Number(lockedProtein) > 0

  // La recomendación se calcula del perfil de QUIEN va a comer. Por eso llega
  // por props y no de useProfile(): ese hook siempre devuelve el del usuario
  // conectado, así que un entrenador habría planificado a su cliente con su
  // propio cuerpo.
  const plan = useMemo(() => recommendPlan({
    weightKg: parseFloat(weight) || toKg(profile?.weight, profile?.weight_unit) || null,
    heightCm: toCm(profile?.height, profile?.height_unit),
    age: profile?.birth_date ? calcAge(profile.birth_date) : null,
    sex: profile?.sex,
    bodyFatPct: profile?.body_fat_pct,
    bodyFatSource: profile?.body_fat_source,
    activityId: profile?.activity_level,
    phaseId: profile?.nutrition_phase,
    daysPerWeek: profile?.days_per_week,
    goal: profile?.goal,
    fixedProteinG: proteinLocked && canLock ? lockedProtein : null,
  }), [weight, profile, proteinLocked, canLock, lockedProtein])

  const applyRecommendation = () => {
    if (!plan.ok) return
    setKcal(String(plan.kcal))
    setGP(String(plan.protein_g))
    setGC(String(plan.carbs_g))
    setGF(String(plan.fat_g))
    setMicroTargets(plan.micros)
    setMode('gramos')
  }

  // Recalcula los micros con las calorías que hay AHORA en el campo, no con
  // las de la recomendación: fibra, azúcar y grasa saturada dependen de ellas,
  // así que tocar las kcal deja esos tres desfasados.
  const resetMicros = () => {
    const k = parseInt(kcal, 10)
    if (!Number.isFinite(k) || k <= 0) return
    setMicroTargets(computeMicroTargets({
      kcal: k,
      sex: profile?.sex,
      age: profile?.birth_date ? calcAge(profile.birth_date) : null,
    }))
  }

  // Objetivo calculado según el modo activo.
  const rec = useMemo(() => {
    const k = parseInt(kcal, 10)
    if (!Number.isFinite(k) || k <= 0) return null
    if (mode === 'peso') {
      const w = parseFloat(weight) || toKg(profile?.weight, profile?.weight_unit)
      if (!Number.isFinite(w) || w <= 0) return null
      // El mismo motor que el asistente. Antes este modo tenía el suyo propio
      // (2 g/kg de peso y 25% de grasa), así que la misma persona recibía dos
      // recomendaciones distintas según la pantalla que tocara — y esta era la
      // que se saltaba el candado de proteína, proponiendo recalcular una
      // cifra que quien la fijó había dicho explícitamente que no se tocara.
      const m = computeMacros({
        kcal: k,
        weightKg: w,
        bodyFatPct: profile?.body_fat_pct,
        phaseId: profile?.nutrition_phase,
        fixedProteinG: proteinLocked && canLock ? lockedProtein : null,
      })
      return { kcal: k, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g }
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
  }, [mode, kcal, weight, pctP, pctF, gP, gC, gF, profile, proteinLocked, canLock, lockedProtein])

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
      await onSave({ ...rec, micros: sanitizeMicros(microTargets), protein_locked: proteinLocked })
    } finally {
      setSaving(false)
    }
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '9px 4px', borderRadius: 'var(--r-xs)',
    fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em',
    background: active ? 'var(--c-accent)' : 'var(--c-surface-2)',
    color: active ? 'var(--c-on-action)' : 'var(--c-text-dim)',
    border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
    transition: 'all 150ms',
  })

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      {/* El motor que explica su recomendación (BMR, fase, micros por RDA) es
          Pro; fijar objetivos a mano queda libre — es el hábito diario. */}
      {isPro ? (
        <RecommendationCard
          t={t} locale={locale} plan={plan}
          onApply={applyRecommendation}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <div style={{ marginBottom: '16px' }}>
          <PremiumGate need="pro" compact title={t('Recomendación calculada con tu cuerpo y tu fase')} />
        </div>
      )}

      {/* El candado vive pegado a la tarjeta porque es de ahí de donde
          protege: sin él, «Usar esto» sustituye la proteína por la calculada
          cada vez que se pulsa. Solo aparece si hay una proteína guardada que
          fijar — ofrecer candar la nada no significa nada. */}
      {canLock && (
        <button
          onClick={() => setProteinLocked(v => !v)}
          aria-pressed={proteinLocked}
          style={{
            display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
            textAlign: 'left', padding: '10px 12px', marginBottom: '16px',
            background: 'transparent',
            border: `1px solid ${proteinLocked ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
            borderRadius: 'var(--r-sm)', cursor: 'pointer',
            transition: 'border-color 150ms var(--ease-out)',
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0, width: '16px', height: '16px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', lineHeight: 1, fontWeight: 800,
              background: proteinLocked ? 'var(--c-accent)' : 'transparent',
              color: 'var(--c-on-action)',
              border: `1px solid ${proteinLocked ? 'var(--c-accent)' : 'var(--c-border)'}`,
            }}
          >
            {proteinLocked ? '✓' : ''}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
              {t('Mantener mi proteína en {g} g', { g: lockedProtein })}
            </span>
            <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.45, marginTop: '2px' }}>
              {t('La recomendación no la recalcula; los carbos absorben la diferencia.')}
            </span>
          </span>
        </button>
      )}

      <Field label={t('Balance de macros')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {BALANCES.map(b => (
            <button key={b.id} onClick={() => switchMode(b.id)} style={{ ...tabStyle(mode === b.id), flex: '1 1 30%' }}>
              {t(b.label)}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field
          label={t('Calorías (kcal)')}
          hint={mode === 'gramos' ? 'Editarla ajusta los carbos' : undefined}
        >
          <input className="input-field tnum" type="number" inputMode="numeric" value={kcal} onChange={onKcal} />
        </Field>
        {mode === 'peso' && (
          <Field label={t('Peso ideal (kg)')}>
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
        <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-md)', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { label: 'Proteína', g: rec.protein_g, per: 4 },
              { label: 'Carbos',   g: rec.carbs_g,   per: 4 },
              { label: 'Grasa',    g: rec.fat_g,     per: 9 },
            ].map(x => (
              <div key={x.label} style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '4px' }}>
                  {t(x.label)}
                </p>
                <p className="tnum" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                  {x.g}<span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-muted)' }}> g</span>
                </p>
                <p className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)', marginTop: '2px' }}>
                  {pct(x.g, x.per, rec.kcal)}%
                </p>
              </div>
            ))}
          </div>
          {mode === 'peso' && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '12px' }}>
              {/* El mismo motor que el asistente (computeMacros): la fórmula
                  vieja de 2 g/kg + 25% siguió escrita aquí después de morir y
                  el número de arriba desmentía a su propia explicación. */}
              {t('Proteína según tu fase (sobre masa magra si hay % de grasa) · grasa: mínimo 0,6 g/kg o 22% de las kcal · el resto, carbos.')}
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

      <MicroTargetsSection
        t={t} values={microTargets}
        onChange={setMicro} onReset={resetMicros}
      />

      <Button
        variant="primary" full size="lg"
        loading={saving} disabled={saving || !rec}
        onClick={handleSave} style={{ marginTop: '8px' }}
      >
        {t(saving ? 'Guardando...' : 'Guardar objetivos')}
      </Button>
    </Sheet>
  )
}
