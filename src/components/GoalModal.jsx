import { useState, useMemo } from 'react'
import { Sheet, Field, Button, UnitToggle } from './ui'
import { useLang } from '../hooks/useLang'
import { currentValue, GOAL_KIND, GOAL_HOME } from '../lib/goals'

// El modal de crear una meta, compartido por Entreno y Nutrición.
//
// Vivía dentro de Training.jsx, que era su único sitio. Desde que cada familia
// de meta se mide donde se actúa sobre ella —la fuerza y la constancia en
// Entreno, la báscula en Nutrición— las dos pantallas necesitan crear metas, y
// cada una solo debe ofrecer las que sabe medir: `home` recorta los tipos.

// Cuatro clases de meta. Las dos de peso (fuerza y báscula) tienen plazo y
// punto de partida; las dos de constancia no, porque su ventana ES el plazo:
// una meta de "4 días por semana" se gana o se pierde cada lunes.
const GOAL_KINDS = [
  { id: 'exercise_weight',   label: 'Fuerza',        hint: 'Peso en un ejercicio' },
  { id: 'body_weight',       label: 'Peso corporal', hint: 'Subir o bajar' },
  { id: 'sessions_per_week', label: 'Días/semana',   hint: 'Constancia' },
  { id: 'days_trained',      label: 'Días/mes',      hint: 'Constancia' },
]

const IS_WEIGHT_GOAL = (type) => type === 'exercise_weight' || type === 'body_weight'

export default function GoalModal({ onClose, onSave, exercises = [], progressCtx = {}, currentWeightUnit = 'kg', home = null }) {
  const { t } = useLang()
  const kinds = home ? GOAL_KINDS.filter(k => GOAL_HOME[GOAL_KIND[k.id]] === home) : GOAL_KINDS
  const [type, setType] = useState(kinds[0].id)
  const [label, setLabel] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [targetReps, setTargetReps] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [unit, setUnit] = useState(currentWeightUnit)
  const [saving, setSaving] = useState(false)

  // De dónde partes hoy. Se mide ANTES de guardar y se sella en la fila: es lo
  // que hace que la barra cuente el tramo propuesto y no la fuerza que ya
  // tenías. Para las metas de constancia no se guarda (siempre parten de cero
  // al abrirse la ventana).
  const start = useMemo(() => {
    if (!IS_WEIGHT_GOAL(type)) return null
    return currentValue({ type, exercise_name: exerciseName, target_reps: targetReps ? parseInt(targetReps, 10) : null, unit }, progressCtx)
  }, [type, exerciseName, targetReps, unit, progressCtx])

  // El nombre deja de ser una tarea: la meta ya sabe cómo se llama. Si escribes
  // uno propio manda el tuyo.
  const suggestedLabel = useMemo(() => {
    const n = parseFloat(targetValue)
    if (!n) return ''
    if (type === 'exercise_weight') {
      return exerciseName ? `${exerciseName} ${n} ${unit}${targetReps ? ` × ${targetReps}` : ''}` : ''
    }
    if (type === 'body_weight') return `Peso corporal ${n} ${unit}`
    if (type === 'sessions_per_week') return `${n} días por semana`
    return `${n} días al mes`
  }, [type, targetValue, unit, exerciseName, targetReps])

  const targetNum = parseFloat(targetValue)
  const maxDays = type === 'sessions_per_week' ? 7 : 31

  // Motivos por los que la meta no se puede guardar, dichos en voz alta. Antes
  // se podía crear una meta de ejercicio sin elegir ejercicio: se quedaba
  // clavada en 0 % para siempre y nada explicaba por qué.
  const problem = (() => {
    if (!targetNum || targetNum <= 0) return null   // aún no ha escrito nada: sin regaño
    if (type === 'exercise_weight' && !exerciseName) return ['Elige el ejercicio o la meta no podrá medirse.']
    if (type === 'body_weight' && start == null) return ['Registra tu peso primero: sin un punto de partida no se puede medir el avance.']
    if (type === 'body_weight' && targetNum === start) return ['El objetivo es tu peso de hoy.']
    if (!IS_WEIGHT_GOAL(type) && targetNum > maxDays) return ['Como mucho {n} días.', { n: maxDays }]
    if (type === 'exercise_weight' && start > 0 && targetNum <= start) {
      return ['Ya llegas a {v} {u}. Ponte un objetivo más alto.', { v: Math.round(start * 10) / 10, u: unit }]
    }
    return null
  })()

  const canSave = targetNum > 0 && !problem

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        type,
        label: (label.trim() || suggestedLabel || 'Meta'),
        exercise_name: type === 'exercise_weight' ? exerciseName || null : null,
        target_value: targetNum,
        target_reps: type === 'exercise_weight' && targetReps ? parseInt(targetReps, 10) : null,
        start_value: IS_WEIGHT_GOAL(type) ? start : null,
        target_date: IS_WEIGHT_GOAL(type) && targetDate ? targetDate : null,
        unit: IS_WEIGHT_GOAL(type) ? unit : 'días',
        is_monthly: type === 'days_trained',
      })
    } finally {
      setSaving(false)
    }
  }

  const valueLabel = t(
    type === 'exercise_weight' || type === 'body_weight' ? 'Peso objetivo'
    : type === 'sessions_per_week' ? 'Días por semana'
    : 'Días este mes'
  )

  return (
    <Sheet title={t('Nueva meta')} onClose={onClose}>
      {kinds.length > 1 && (
      <Field label={t('Tipo de meta')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {kinds.map(opt => {
            const on = type === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                aria-pressed={on}
                style={{
                  padding: '10px 8px', borderRadius: 'var(--r-xs)', textAlign: 'left',
                  background: on ? 'var(--c-accent)' : 'var(--c-surface-2)',
                  border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
                  transition: 'all 150ms',
                }}
              >
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '-0.01em', color: on ? 'var(--c-on-action)' : 'var(--c-text)' }}>
                  {t(opt.label)}
                </span>
                <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 500, marginTop: '2px', color: on ? 'var(--c-on-action)' : 'var(--c-text-muted)', opacity: on ? 0.8 : 1 }}>
                  {t(opt.hint)}
                </span>
              </button>
            )
          })}
        </div>
      </Field>
      )}

      {type === 'exercise_weight' && (
        <Field label={t('Ejercicio')}>
          <select
            className="input-field"
            value={exerciseName}
            onChange={e => setExerciseName(e.target.value)}
          >
            <option value="">— Selecciona un ejercicio —</option>
            {exercises.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label={valueLabel}
        hint={IS_WEIGHT_GOAL(type) && start != null && start > 0
          ? `Hoy: ${Math.round(start * 10) / 10} ${unit}`
          : undefined}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input-field"
            type="number"
            inputMode="decimal"
            placeholder={type === 'sessions_per_week' ? '4' : type === 'days_trained' ? '20' : '100'}
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
            style={{ flex: 1 }}
          />
          {IS_WEIGHT_GOAL(type) && (
            <UnitToggle value={unit} units={['kg', 'lb']} onChange={setUnit} />
          )}
        </div>
      </Field>

      {type === 'exercise_weight' && (
        <Field label={t('Reps objetivo')} hint={t('Opcional — vacío = comparar 1RM')}>
          <input
            className="input-field"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 5"
            value={targetReps}
            onChange={e => setTargetReps(e.target.value)}
          />
        </Field>
      )}

      {IS_WEIGHT_GOAL(type) && (
        <Field label={t('Fecha límite')} hint={t('Opcional — con fecha la app te dice si vas a tiempo')}>
          <input
            className="input-field"
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
          />
        </Field>
      )}

      <Field label={t('Nombre de la meta')} hint={t('Opcional')}>
        <input
          className="input-field"
          placeholder={suggestedLabel || 'Ej: Sentadilla 100 kg'}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </Field>

      {problem && (
        <p style={{ color: 'var(--c-action-text)', fontSize: '11.5px', fontWeight: 600, lineHeight: 1.4, marginBottom: '10px' }}>
          {t(problem[0], problem[1])}
        </p>
      )}

      <Button
        variant="primary"
        full
        size="lg"
        loading={saving}
        disabled={saving || !canSave}
        onClick={handleSave}
        style={{ marginTop: '8px' }}
      >
        {saving ? 'Guardando...' : 'Guardar meta'}
      </Button>
    </Sheet>
  )
}
