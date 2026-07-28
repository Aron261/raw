// Wizard de rutinas recomendadas (ciclo y un día) sobre el motor curado
// (src/lib/engine). Pide lo mínimo, prefiere el perfil como prefill y muestra
// un PREVIEW con el razonamiento del plan antes de guardar, con "Regenerar".

import { useEffect, useMemo, useState } from 'react'
import { Sheet, Button } from './ui'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { useProfile } from '../hooks/useProfile'
import { useGenerationContext } from '../hooks/useGenerationContext'
import {
  generatePlan, getSwapAlternatives, swapExercise, hashInputs,
  GOALS, LEVELS, TIME_OPTIONS, FOCUS_OPTIONS, SPLIT_5D_OPTIONS,
} from '../lib/engine'
import { MUSCLE_GROUPS } from '../lib/muscleGroups'
import { useExerciseLang } from '../hooks/useExerciseLang'
import { useLang } from '../hooks/useLang'

const DAYS_OPTIONS = [2, 3, 4, 5, 6]

const SPLIT_BY_DAYS = {
  2: 'Full Body ×2',
  3: 'Full Body ×3',
  4: 'Upper / Lower (A/B)',
  6: 'Push / Pull / Legs ×2 (A/B)',
}

const EQUIPMENT_TOKENS = [
  ['barra', 'Barra'],
  ['mancuerna', 'Mancuernas'],
  ['polea', 'Poleas'],
  ['maquina', 'Máquinas'],
  ['smith', 'Smith'],
  ['banco', 'Banco'],
  ['peso_corporal', 'Peso corporal'],
  ['barra_dominadas', 'Barra dominadas'],
  ['rueda_abs', 'Rueda abdominal'],
]

// profiles.goal usa otro vocabulario que el motor; solo Fuerza mapea directo.
const mapProfileGoal = (g) => (g === 'Fuerza' ? 'Fuerza' : 'Hipertrofia')
const clampDays = (d) => (d ? Math.min(6, Math.max(2, d)) : null)

// ── UI helpers (mismo lenguaje visual que Rutinas.jsx) ──────────────────────

const MONO_LABEL = {
  fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px',
  fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px',
}

function OptionButton({ selected, onClick, children, sub }) {
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 16px', textAlign: 'left',
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface)',
        border: `1px solid ${selected ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
        borderRadius: 'var(--r-md)',
        color: selected ? 'var(--c-action-text)' : 'var(--c-text)',
        fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
      }}
      {...pressProps(0.98)}
    >
      {children}
      {sub && (
        <span style={{ display: 'block', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginTop: '3px' }}>
          {sub}
        </span>
      )}
    </button>
  )
}

function Pill({ selected, onClick, children, hint }) {
  const { t } = useLang()
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        padding: '8px 12px', borderRadius: '999px',
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface)',
        border: `1px solid ${selected ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
        color: selected ? 'var(--c-action-text)' : 'var(--c-text)',
        fontSize: '11px', fontWeight: 700,
      }}
      {...pressProps(0.96)}
    >
      {children}{hint && <span style={{ color: 'var(--c-text-dim)', fontWeight: 500 }}> · {hint}</span>}
    </button>
  )
}

function BackLink({ onClick }) {
  const { t } = useLang()
  return (
    <button onClick={onClick} style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', marginTop: '12px', textAlign: 'center', width: '100%', display: 'block' }}>
      {t('Atrás')}
    </button>
  )
}

// ── Preview ─────────────────────────────────────────────────────────────────

function PlanPreview({ plan, notesVisible = true, getAlternatives, onSwap }) {
  const { t } = useLang()
  // Fila con el selector de alternativas abierto: 'dayIdx-exIdx' | null
  const [swapOpen, setSwapOpen] = useState(null)

  return (
    <div>
      <div style={{ padding: '14px 16px', background: 'var(--c-surface)', borderRadius: 'var(--r-md)', marginBottom: '14px' }}>
        <p style={MONO_LABEL}>{t('Por qué este plan')}</p>
        <p style={{ color: 'var(--c-text)', fontSize: '12px', lineHeight: 1.55 }}>{plan.summary}</p>
        {notesVisible && plan.notes.length > 0 && (
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginTop: '8px' }}>{plan.notes.join(' ')}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {Object.entries(plan.weeklyVolume).map(([group, sets]) => (
          <span key={group} style={{ padding: '4px 10px', borderRadius: '999px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700 }}>
            {group} {sets}
          </span>
        ))}
        <span style={{ padding: '4px 10px', borderRadius: '999px', color: 'var(--c-text-dim)', fontSize: '10px' }}>series/semana</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {plan.days.map((day, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'var(--c-surface)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em' }}>{day.dayName}</p>
              <span style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontFamily: 'var(--font-sans)' }}>~{day.estMinutes} min</span>
            </div>
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10.5px', lineHeight: 1.5, marginBottom: '10px' }}>{day.rationale}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {day.exercises.map((ex, j) => {
                const rowKey = `${i}-${j}`
                const isOpen = swapOpen === rowKey
                const alternatives = isOpen && getAlternatives ? getAlternatives(i, ex) : []
                return (
                  <div key={j}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 600 }}>
                          {ex.name}
                          {ex.isFamiliar && <span style={{ color: 'var(--c-action-text)', fontSize: '9px', fontWeight: 800, marginLeft: '6px' }}>{t('Habitual')}</span>}
                        </p>
                        <p style={{ color: 'var(--c-text-dim)', fontSize: '9.5px' }}>
                          RIR {ex.rir} · descanso {ex.restSeconds >= 60 ? `${Math.round(ex.restSeconds / 60 * 10) / 10} min` : `${ex.restSeconds} s`}
                          {ex.suggestedWeight != null && ` · ~${ex.suggestedWeight} ${ex.unit}${ex.weightIsEstimate ? ' (est.)' : ''}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexShrink: 0 }}>
                        <span style={{ color: 'var(--c-text)', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                          {ex.sets}×{ex.repsMin}-{ex.repsMax}{ex.repsUnit === 'seg' ? '"' : ''}
                        </span>
                        {onSwap && (
                          <button
                            onClick={() => setSwapOpen(isOpen ? null : rowKey)}
                            aria-label={`Cambiar ${ex.name} por uno similar`}
                            aria-expanded={isOpen}
                            style={{
                              color: isOpen ? 'var(--c-action-text)' : 'var(--c-text-dim)',
                              fontSize: '13px', padding: '2px 4px', lineHeight: 1,
                            }}
                            {...pressProps(0.9)}
                          >
                            ⇄
                          </button>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ margin: '8px 0 4px', padding: '10px 12px', background: 'var(--c-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--c-border-subtle)' }}>
                        <p style={{ ...MONO_LABEL, marginBottom: '8px' }}>{t('Cambiar por')}</p>
                        {alternatives.length === 0 ? (
                          <p style={{ color: 'var(--c-text-dim)', fontSize: '10.5px' }}>{t('No hay alternativas con tu equipo y nivel.')}</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {alternatives.map(alt => (
                              <button
                                key={alt.id}
                                onClick={() => { onSwap(i, j, alt); setSwapOpen(null) }}
                                style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--r-xs)', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)', color: 'var(--c-text)', fontSize: '11.5px', fontWeight: 600 }}
                                {...pressProps(0.98)}
                              >
                                {alt.name}
                                <span style={{ color: 'var(--c-text-dim)', fontWeight: 500, fontSize: '9.5px' }}>
                                  {' '}· {alt.is_compound ? 'compuesto' : 'aislamiento'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Wizard principal ────────────────────────────────────────────────────────

export default function RecommendedPlanWizard({ mode = 'cycle', onClose, onCreate }) {
  const { term } = useExerciseLang()
  const { t } = useLang()
  const { profile } = useProfile()

  const [goal, setGoal]           = useState(null)
  const [level, setLevel]         = useState(null)
  const [daysPerWeek, setDays]    = useState(null)
  const [sessionMinutes, setTime] = useState(null)
  const [focus, setFocus]         = useState(null)
  const [splitChoice, setSplit]   = useState('ppl_ul')
  const [fullGym, setFullGym]     = useState(true)
  const [equipmentSel, setEquipmentSel] = useState(['barra', 'mancuerna', 'polea', 'maquina', 'banco', 'peso_corporal'])
  const [priorityGroups, setPriority]   = useState(null) // null = aún sin tocar (permite preselección)
  const [useHistory, setUseHistory]     = useState(true)
  const [step, setStep]           = useState(0)
  const [seed, setSeed]           = useState(null)
  const [saving, setSaving]       = useState(false)
  const [localError, setLocalError] = useState(null)

  // Prefill desde perfil (solo si el usuario no ha elegido aún)
  const effGoal  = goal  ?? (profile?.goal ? mapProfileGoal(profile.goal) : null)
  const effLevel = level ?? profile?.level ?? null
  const effDays  = daysPerWeek ?? clampDays(profile?.days_per_week)
  const sex      = profile?.sex ?? null

  const { library, history, hasHistory, loading: ctxLoading, error: ctxError } =
    useGenerationContext(effLevel ?? 'Intermedio')

  // Preselección de prioridad sugerida por sexo (editable, nunca forzada)
  const effPriority = priorityGroups ?? (sex === 'Femenino' ? ['Glúteo'] : [])

  const isCycle = mode === 'cycle'

  // Pasos: para ciclo → objetivo, nivel, agenda, [split 5d], equipo, prioridades, preview
  //        para un día → enfoque, tiempo, objetivo, equipo(+historial), preview
  const steps = useMemo(() => {
    if (isCycle) {
      const s = ['goal', 'level', 'schedule']
      if (effDays === 5) s.push('split')
      s.push('equipment', 'priorities', 'preview')
      return s
    }
    return ['focus', 'time', 'goal', 'equipment', 'preview']
  }, [isCycle, effDays])

  const stepKey = steps[Math.min(step, steps.length - 1)]

  const STEP_TITLES = {
    goal: 'Objetivo', level: 'Nivel', schedule: 'Agenda', split: 'Tipo de split',
    equipment: 'Equipo disponible', priorities: 'Prioridades', focus: '¿Qué quieres entrenar?',
    time: '¿Cuánto tiempo tienes?', preview: 'Tu plan',
  }

  const equipment = fullGym ? 'full' : equipmentSel

  const input = useMemo(() => ({
    mode,
    goal: effGoal ?? 'Hipertrofia',
    level: effLevel ?? 'Intermedio',
    daysPerWeek: effDays ?? 4,
    sessionMinutes: sessionMinutes ?? 60,
    sex,
    splitChoice,
    priorityGroups: isCycle ? effPriority : [],
    equipment,
    useHistory: useHistory && hasHistory,
    focus: focus ?? 'Full Body',
    library,
    history,
  }), [mode, effGoal, effLevel, effDays, sessionMinutes, sex, splitChoice, effPriority, equipment, useHistory, hasHistory, focus, library, history, isCycle])

  // Semilla estable al entrar al preview; Regenerar la incrementa
  useEffect(() => {
    if (stepKey === 'preview' && seed == null) setSeed(hashInputs(input))
  }, [stepKey, seed, input])

  const [genError, setGenError] = useState(null)
  const generatedPlan = useMemo(() => {
    if (stepKey !== 'preview' || seed == null || library.length === 0) return null
    try {
      return generatePlan({ ...input, seed })
    } catch (e) {
      console.error('Error generating plan:', e)
      setGenError(e.message || 'Error inesperado')
      return null
    }
  }, [stepKey, seed, input, library])

  // Cambios manuales del usuario sobre el plan generado (swaps). Se descartan
  // al regenerar (nueva semilla).
  const [editedPlan, setEditedPlan] = useState(null)
  useEffect(() => { setEditedPlan(null) }, [seed])
  const plan = editedPlan ?? generatedPlan

  const handleSwap = (dayIndex, exIndex, libEx) => {
    if (!plan) return
    setEditedPlan(swapExercise(plan, dayIndex, exIndex, libEx, {
      goal: input.goal, level: input.level,
      history: input.useHistory ? history : null, library,
    }))
  }

  const getAlternatives = (dayIndex, ex) => getSwapAlternatives(ex, {
    library,
    level: input.level,
    equipment: input.equipment,
    excludeNames: plan ? plan.days[dayIndex].exercises.map(e => e.name) : [],
  })

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1))
  const back = () => { setLocalError(null); setStep(s => Math.max(s - 1, 0)) }

  const handleSave = async () => {
    if (!plan) return
    setSaving(true)
    setLocalError(null)
    try {
      const description = [plan.summary, '', ...plan.days.map(d => `${d.dayName}: ${d.rationale}`)].join('\n')
      await onCreate({
        name: plan.title,
        description,
        type: isCycle ? 'cycle' : 'single_day',
        source: 'recommended',
        goal: input.goal,
        level: input.level,
        days_per_week: isCycle ? input.daysPerWeek : null,
        days: plan.days.map((day, i) => ({
          day_name: day.dayName,
          day_order: i,
          focus: day.focus,
          exercises: day.exercises.map((ex, j) => ({
            exercise_name: ex.name,
            exercise_order: j,
            sets: ex.sets,
            reps: ex.repsUnit === 'seg' ? `${ex.repsMin}-${ex.repsMax} seg` : `${ex.repsMin}-${ex.repsMax}`,
            rest_seconds: ex.restSeconds,
            notes: ex.note,
          })),
        })),
      })
      onClose()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const stepIndexLabel = stepKey !== 'preview'
    ? `Paso ${step + 1} de ${steps.length - 1} — ${STEP_TITLES[stepKey]}`
    : undefined

  return (
    <Sheet
      title={isCycle ? 'Ciclo recomendado' : 'Rutina recomendada'}
      subtitle={stepIndexLabel}
      onClose={onClose}
      maxHeight="90dvh"
    >
      {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}
      {ctxError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{t('No se pudo cargar la librería de ejercicios.')}</div>}

      {stepKey === 'goal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {GOALS.map(g => (
            <OptionButton
              key={g}
              selected={effGoal === g}
              onClick={() => { setGoal(g); next() }}
              sub={g === 'Fuerza' ? 'Series de 3-5 reps pesadas, descansos largos' : 'Series de 8-12 reps cerca del fallo'}
            >
              {term(g)}
            </OptionButton>
          ))}
          {step > 0 && <BackLink onClick={back} />}
        </div>
      )}

      {stepKey === 'level' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {LEVELS.map(l => (
            <OptionButton key={l} selected={effLevel === l} onClick={() => { setLevel(l); next() }}>
              {l}
            </OptionButton>
          ))}
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'focus' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {FOCUS_OPTIONS.map(f => (
            <Pill key={f} selected={focus === f} onClick={() => { setFocus(f); next() }}>{f}</Pill>
          ))}
        </div>
      )}

      {stepKey === 'time' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TIME_OPTIONS.map(t => (
            <OptionButton key={t} selected={sessionMinutes === t} onClick={() => { setTime(t); next() }}>
              {t} min
            </OptionButton>
          ))}
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'schedule' && (
        <div>
          <p style={MONO_LABEL}>{t('Días por semana')}</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            {DAYS_OPTIONS.map(d => (
              <Pill key={d} selected={effDays === d} onClick={() => setDays(d)}>{d}</Pill>
            ))}
          </div>
          {effDays && effDays !== 5 && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '14px' }}>
              Split: {SPLIT_BY_DAYS[effDays]} — los días repetidos usan variantes A/B, nunca son iguales.
            </p>
          )}
          {effDays === 5 && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '14px' }}>
              {t('Con 5 días eliges el tipo de split en el siguiente paso.')}
            </p>
          )}
          <p style={MONO_LABEL}>{t('Tiempo por sesión')}</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {TIME_OPTIONS.map(t => (
              <Pill key={t} selected={sessionMinutes === t} onClick={() => setTime(t)}>{t} min</Pill>
            ))}
          </div>
          <Button variant="primary" full size="lg" disabled={!effDays || !sessionMinutes} onClick={next}>
            {t('Continuar')}
          </Button>
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SPLIT_5D_OPTIONS.map(opt => (
            <OptionButton
              key={opt.value}
              selected={splitChoice === opt.value}
              onClick={() => { setSplit(opt.value); next() }}
              sub={opt.description}
            >
              {opt.label}
            </OptionButton>
          ))}
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'equipment' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <OptionButton selected={fullGym} onClick={() => setFullGym(true)} sub="Acceso a todo: barras, mancuernas, poleas y máquinas">
              {t('Gym completo')}
            </OptionButton>
            <OptionButton selected={!fullGym} onClick={() => setFullGym(false)} sub="Elige exactamente con qué cuentas">
              {t('Equipo limitado')}
            </OptionButton>
          </div>
          {!fullGym && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {EQUIPMENT_TOKENS.map(([tok, label]) => (
                <Pill
                  key={tok}
                  selected={equipmentSel.includes(tok)}
                  onClick={() => setEquipmentSel(sel => sel.includes(tok) ? sel.filter(t => t !== tok) : [...sel, tok])}
                >
                  {term(label)}
                </Pill>
              ))}
            </div>
          )}
          {!isCycle && hasHistory && (
            <div style={{ marginBottom: '16px' }}>
              <Pill selected={useHistory} onClick={() => setUseHistory(v => !v)}>
                Usar mi historial{useHistory ? ' ✓' : ''}
              </Pill>
            </div>
          )}
          <Button variant="primary" full size="lg" disabled={!fullGym && equipmentSel.length === 0} onClick={next}>
            {t('Continuar')}
          </Button>
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'priorities' && (
        <div>
          <p style={MONO_LABEL}>{t('Grupos a priorizar (máx. 2, opcional)')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {MUSCLE_GROUPS.map(g => {
              const selected = effPriority.includes(g)
              const suggested = history?.undertrainedGroups?.includes(g)
              return (
                <Pill
                  key={g}
                  selected={selected}
                  hint={suggested ? 'poco volumen últimamente' : undefined}
                  onClick={() => {
                    const cur = effPriority
                    if (selected) setPriority(cur.filter(x => x !== g))
                    else if (cur.length < 2) setPriority([...cur, g])
                  }}
                >
                  {g}
                </Pill>
              )
            })}
          </div>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginBottom: '16px' }}>
            {t('Los grupos priorizados reciben más series semanales y mejor posición en la sesión.')}
          </p>
          {hasHistory && (
            <div style={{ marginBottom: '16px' }}>
              <Pill selected={useHistory} onClick={() => setUseHistory(v => !v)}>
                Usar mi historial{useHistory ? ' ✓' : ''}
              </Pill>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', marginTop: '6px' }}>
                {t('Prioriza ejercicios que ya haces y sugiere pesos de arranque desde tus marcas.')}
              </p>
            </div>
          )}
          <Button variant="primary" full size="lg" onClick={next}>
            {t('Generar plan')}
          </Button>
          <BackLink onClick={back} />
        </div>
      )}

      {stepKey === 'preview' && (
        <div>
          {plan ? (
            <>
              <PlanPreview plan={plan} getAlternatives={getAlternatives} onSwap={handleSwap} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <Button variant="secondary" full onClick={() => setSeed(s => (s ?? 0) + 1)}>
                  {t('Regenerar')}
                </Button>
                <Button variant="primary" full loading={saving} disabled={saving} onClick={handleSave}>
                  {saving ? 'Guardando…' : isCycle ? 'Guardar ciclo' : 'Guardar rutina'}
                </Button>
              </div>
            </>
          ) : (ctxLoading || seed == null) ? (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', padding: '20px 0', textAlign: 'center' }}>
              {t('Generando plan…')}
            </p>
          ) : (
            <div style={{ padding: '10px 0' }}>
              <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>
                No se pudo generar el plan{genError ? `: ${genError}` : ''}. Inténtalo de nuevo.
              </div>
              <Button variant="secondary" full onClick={() => { setGenError(null); setSeed(s => (s ?? 0) + 1) }}>
                {t('Reintentar')}
              </Button>
            </div>
          )}
          <BackLink onClick={back} />
        </div>
      )}
    </Sheet>
  )
}
