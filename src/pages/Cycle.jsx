import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { useCycle } from '../hooks/useCycle'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  GOALS,
  LEVELS,
  GOAL_PARAMS,
  SETS_PER_DAY,
  VOLUME_TARGETS,
  generateCyclePlan,
  getRecommendedPriority,
} from '../lib/cycleGenerator'

// ─── Shared style helpers ────────────────────────────────────────────────────

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  color: 'var(--c-text-dim)',
  display: 'block',
  marginBottom: '8px',
}

const SECTION_TITLE_STYLE = {
  fontSize: '10px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--c-text-dim)',
  marginBottom: '16px',
  paddingBottom: '10px',
  borderBottom: '1px solid var(--c-border-subtle)',
}

const ALL_MUSCLE_GROUPS = Object.keys(VOLUME_TARGETS)

// ─── Small reusable sub-components ──────────────────────────────────────────

// Pill button (single selection)
function Pill({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
        color: selected ? 'var(--c-accent)' : 'var(--c-text-dim)',
        transition: 'all 150ms var(--ease-out)',
        cursor: 'pointer',
        minHeight: '44px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// Circle day-picker button (2-6)
function DayCircle({ day, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        fontSize: '14px',
        fontWeight: 800,
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'var(--c-accent)' : 'var(--c-surface-2)',
        color: selected ? '#fff' : 'var(--c-text-dim)',
        transition: 'all 150ms var(--ease-out)',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {day}
    </button>
  )
}

// Muscle group chip (multi-select)
function MuscleChip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
        color: selected ? 'var(--c-accent)' : 'var(--c-text-dim)',
        transition: 'all 150ms var(--ease-out)',
        cursor: 'pointer',
        minHeight: '36px',
      }}
    >
      {label}
    </button>
  )
}

// Step progress dots
function StepDots({ total, current }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? '20px' : '8px',
            height: '8px',
            borderRadius: '999px',
            background: i === current
              ? 'var(--c-accent)'
              : i < current
                ? 'var(--c-text-muted)'
                : 'var(--c-border)',
            transition: 'all 300ms var(--ease-out)',
          }}
        />
      ))}
    </div>
  )
}

// Goal option card with icon + description
function GoalCard({ icon, label, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '18px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 150ms var(--ease-out)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '100px',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 800,
          color: selected ? 'var(--c-accent)' : 'var(--c-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: selected ? 'var(--c-accent)' : 'var(--c-text-muted)',
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        {description}
      </span>
    </button>
  )
}

// Level card
function LevelCard({ label, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '20px 18px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 150ms var(--ease-out)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minHeight: '80px',
      }}
    >
      <span
        style={{
          fontSize: '14px',
          fontWeight: 800,
          color: selected ? 'var(--c-accent)' : 'var(--c-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: selected ? 'var(--c-accent)' : 'var(--c-text-muted)',
          lineHeight: 1.45,
          fontWeight: 500,
        }}
      >
        {description}
      </span>
    </button>
  )
}

// Mode card (Automático / Manual)
function ModeCard({ icon, label, description, badge, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border-subtle)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '22px 20px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 150ms var(--ease-out)',
        position: 'relative',
        minHeight: '110px',
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'var(--c-accent)',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '3px 8px',
            borderRadius: '999px',
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ fontSize: '24px', marginBottom: '10px', lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          color: selected ? 'var(--c-accent)' : 'var(--c-text)',
          letterSpacing: '-0.025em',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '11px',
          color: selected ? 'var(--c-accent)' : 'var(--c-text-muted)',
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        {description}
      </div>
    </button>
  )
}

// ─── Wizard step components ──────────────────────────────────────────────────

const GOAL_META = {
  Hipertrofia: {
    icon: '💪',
    description: 'Maximizar el crecimiento muscular con volumen moderado-alto.',
  },
  Fuerza: {
    icon: '🏋️',
    description: 'Aumentar tu 1RM en los movimientos principales.',
  },
  'Fuerza-Hipertrofia': {
    icon: '⚡',
    description: 'Combina fuerza y masa. Ideal para atletas intermedios.',
  },
  Recomposición: {
    icon: '🔄',
    description: 'Perder grasa y ganar músculo simultáneamente.',
  },
}

const LEVEL_META = {
  Principiante: 'Menos de 1 año de entrenamiento consistente.',
  Intermedio:   '1-3 años de entrenamiento con técnica sólida.',
  Avanzado:     'Más de 3 años y estancamiento en ganancias básicas.',
}

const TIME_LABELS = { 45: '45 min', 60: '1 hora', 90: '1.5 horas' }
const DURATION_OPTIONS = [6, 8, 10, 12]

// Step 1 — Meta
function StepGoal({ value, onChange }) {
  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '24px',
          lineHeight: 1.2,
        }}
      >
        ¿Cuál es tu meta?
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}
      >
        {GOALS.map(goal => (
          <GoalCard
            key={goal}
            icon={GOAL_META[goal]?.icon ?? '🎯'}
            label={goal}
            description={GOAL_META[goal]?.description ?? ''}
            selected={value === goal}
            onClick={() => onChange(goal)}
          />
        ))}
      </div>
    </div>
  )
}

// Step 2 — Nivel
function StepLevel({ value, onChange }) {
  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '24px',
          lineHeight: 1.2,
        }}
      >
        ¿Cuál es tu nivel?
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {LEVELS.map(level => (
          <LevelCard
            key={level}
            label={level}
            description={LEVEL_META[level] ?? ''}
            selected={value === level}
            onClick={() => onChange(level)}
          />
        ))}
      </div>
    </div>
  )
}

// Step 3 — Disponibilidad
function StepAvailability({ daysPerWeek, dailyTimeMinutes, durationWeeks, onChange }) {
  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '28px',
          lineHeight: 1.2,
        }}
      >
        ¿Cuánto tiempo tienes?
      </h2>

      {/* Days per week */}
      <div style={{ marginBottom: '28px' }}>
        <p style={LABEL_STYLE}>Días por semana</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[2, 3, 4, 5, 6].map(d => (
            <DayCircle
              key={d}
              day={d}
              selected={daysPerWeek === d}
              onClick={() => onChange('daysPerWeek', d)}
            />
          ))}
        </div>
      </div>

      {/* Time per session */}
      <div style={{ marginBottom: '28px' }}>
        <p style={LABEL_STYLE}>Duración por sesión</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[45, 60, 90].map(t => (
            <Pill
              key={t}
              label={TIME_LABELS[t]}
              selected={dailyTimeMinutes === t}
              onClick={() => onChange('dailyTimeMinutes', t)}
            />
          ))}
        </div>
      </div>

      {/* Cycle duration */}
      <div>
        <p style={LABEL_STYLE}>Duración del ciclo</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DURATION_OPTIONS.map(w => (
            <Pill
              key={w}
              label={`${w} sem`}
              selected={durationWeeks === w}
              onClick={() => onChange('durationWeeks', w)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Step 4 — Modo de creación
function StepMode({ value, onChange }) {
  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '24px',
          lineHeight: 1.2,
        }}
      >
        ¿Cómo quieres crear tu ciclo?
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ModeCard
          icon="🤖"
          label="Automático"
          description="La app genera el plan basado en tu nivel, meta y disponibilidad."
          badge="Recomendado"
          selected={value === 'auto'}
          onClick={() => onChange('auto')}
        />
        <ModeCard
          icon="✏️"
          label="Manual"
          description="Construyes el plan tú mismo ejercicio por ejercicio. También puedes pegar un plan generado por una IA externa."
          badge={null}
          selected={value === 'manual'}
          onClick={() => onChange('manual')}
        />
      </div>
    </div>
  )
}

// Step 5 — Prioridades (only when cycleMemory.length > 0)
function StepPriorities({ cycleMemory, value, onChange }) {
  const [customizing, setCustomizing] = useState(false)

  // Compute what was prioritized last cycle
  const lastCycle = cycleMemory[0] ?? null
  const lastPrioritized = lastCycle?.prioritized_groups ?? []
  const recommended = getRecommendedPriority(cycleMemory)

  const toggleGroup = (group) => {
    const next = value.includes(group)
      ? value.filter(g => g !== group)
      : value.length < 3
        ? [...value, group]
        : value

    onChange(next)
  }

  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '16px',
          lineHeight: 1.2,
        }}
      >
        Prioridades del ciclo
      </h2>

      {/* Previous cycle summary */}
      {lastPrioritized.length > 0 && (
        <div
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border-subtle)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: 'var(--c-text-muted)',
              lineHeight: 1.6,
              marginBottom: '4px',
            }}
          >
            En tu ciclo anterior priorizaste:{' '}
            <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>
              {lastPrioritized.join(', ')}
            </span>
          </p>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--c-text-muted)',
              lineHeight: 1.6,
            }}
          >
            Para este ciclo se recomienda priorizar:{' '}
            <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>
              {recommended.join(', ')}
            </span>
          </p>
        </div>
      )}

      {!customizing ? (
        // Confirm / Customize buttons
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '16px', fontSize: '12px' }}
            onClick={() => {
              onChange(recommended)
            }}
          >
            Confirmar recomendación
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '14px', fontSize: '12px' }}
            onClick={() => setCustomizing(true)}
          >
            Personalizar
          </button>
        </div>
      ) : (
        // Group chip grid
        <div>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--c-text-muted)',
              marginBottom: '14px',
              lineHeight: 1.5,
            }}
          >
            Selecciona 2-3 grupos musculares a priorizar en este ciclo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {ALL_MUSCLE_GROUPS.map(group => (
              <MuscleChip
                key={group}
                label={group}
                selected={value.includes(group)}
                onClick={() => toggleGroup(group)}
              />
            ))}
          </div>
          {value.length > 0 && (
            <p
              style={{
                fontSize: '10px',
                color: 'var(--c-text-ghost)',
                marginTop: '8px',
              }}
            >
              {value.length} de 3 seleccionados
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Plan preview after generation
function PlanPreview({ plan, wizardData, onCreate, generating }) {
  if (generating) {
    return (
      <div
        className="fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '18px',
          padding: '60px 20px',
        }}
      >
        <span className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px', borderTopColor: 'var(--c-accent)', borderColor: 'var(--c-border)' }} />
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--c-text-secondary)',
            letterSpacing: '-0.02em',
          }}
        >
          Generando plan...
        </p>
      </div>
    )
  }

  if (!plan || plan.length === 0) return null

  // Derive split badge label
  const splitLabel = plan.length <= 3
    ? 'Full Body'
    : plan.length === 4
      ? 'Upper / Lower'
      : plan.every(d => ['Push', 'Pull', 'Legs'].includes(d.dayName))
        ? 'PPL'
        : 'PPL / Upper-Lower'

  return (
    <div className="fade-in">
      <h2
        style={{
          fontSize: '22px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--c-text)',
          marginBottom: '6px',
          lineHeight: 1.2,
        }}
      >
        Vista previa del ciclo
      </h2>
      <p
        style={{
          fontSize: '12px',
          color: 'var(--c-text-muted)',
          marginBottom: '20px',
        }}
      >
        ¿Todo bien? Puedes ajustar ejercicios una vez creado el ciclo.
      </p>

      {/* Split badge */}
      <div style={{ marginBottom: '16px' }}>
        <span
          style={{
            display: 'inline-block',
            background: 'var(--c-accent-dim)',
            border: '1px solid var(--c-accent-border)',
            color: 'var(--c-accent)',
            fontSize: '10px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '4px 12px',
            borderRadius: '999px',
          }}
        >
          {splitLabel} · {wizardData.daysPerWeek}d/sem · {wizardData.durationWeeks} sem
        </span>
      </div>

      {/* Day list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '28px',
        }}
      >
        {plan.map((day, i) => (
          <div
            key={i}
            className="stagger-item"
            style={{
              animationDelay: `${i * 50}ms`,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border-subtle)',
              borderRadius: 'var(--r-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: 'var(--c-text)',
                  letterSpacing: '-0.025em',
                }}
              >
                Día {day.dayNumber} — {day.dayName}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--c-text-ghost)',
                  fontWeight: 600,
                }}
              >
                {day.exercises.length} ejercicios
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {day.muscleGroups.map(mg => (
                <span
                  key={mg}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--c-text-muted)',
                    background: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border-subtle)',
                    borderRadius: '999px',
                    padding: '2px 9px',
                  }}
                >
                  {mg}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={onCreate}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Crear ciclo
      </button>
    </div>
  )
}

// ─── Active cycle view ───────────────────────────────────────────────────────

function ActiveCycleView({ activeCycle, cycleData, currentWeek, onClose }) {
  const [expandedDayId, setExpandedDayId] = useState(null)
  const [closingConfirm, setClosingConfirm] = useState(false)

  const days = cycleData?.days ?? []

  const weekProgress = currentWeek
    ? Math.min(((currentWeek.weekNumber - 1) / activeCycle.duration_weeks) * 100, 100)
    : 0

  const goalLabel  = activeCycle.goal  ?? '—'
  const levelLabel = activeCycle.level ?? '—'

  const toggleDay = (dayId) => {
    setExpandedDayId(prev => prev === dayId ? null : dayId)
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            color: 'var(--c-text)',
            lineHeight: 1.1,
            marginBottom: '10px',
          }}
        >
          {activeCycle.name}
        </h1>

        {/* Semana badge */}
        {currentWeek && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--c-accent-dim)',
              border: '1px solid var(--c-accent-border)',
              borderRadius: '999px',
              padding: '4px 12px',
              marginBottom: '14px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--c-accent)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--c-accent)',
                letterSpacing: '-0.01em',
              }}
            >
              Semana {currentWeek.weekNumber} de {activeCycle.duration_weeks}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div
          style={{
            height: '4px',
            background: 'var(--c-border-subtle)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${weekProgress}%`,
              background: 'var(--c-accent)',
              borderRadius: '999px',
              transition: 'width 600ms var(--ease-out)',
            }}
          />
        </div>

        {/* Goal + Level chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--c-text-dim)',
              background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border-subtle)',
              borderRadius: '999px',
              padding: '3px 10px',
            }}
          >
            {goalLabel}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--c-text-dim)',
              background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border-subtle)',
              borderRadius: '999px',
              padding: '3px 10px',
            }}
          >
            {levelLabel}
          </span>
        </div>
      </div>

      {/* ── Day cards ── */}
      <p style={SECTION_TITLE_STYLE}>Días del ciclo</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
        {days.map((day, idx) => {
          const isExpanded = expandedDayId === day.id

          return (
            <div
              key={day.id}
              className="stagger-item"
              style={{
                animationDelay: `${idx * 60}ms`,
                background: 'var(--c-surface)',
                border: `1px solid ${isExpanded ? 'var(--c-border)' : 'var(--c-border-subtle)'}`,
                borderRadius: 'var(--r-lg)',
                overflow: 'hidden',
                transition: 'border-color 150ms var(--ease-out)',
              }}
            >
              {/* Day header — tap to expand */}
              <button
                type="button"
                onClick={() => toggleDay(day.id)}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: 'transparent',
                  minHeight: '60px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--c-text)',
                      letterSpacing: '-0.025em',
                      marginBottom: '6px',
                    }}
                  >
                    Día {day.day_number} — {day.day_name}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(day.muscle_groups ?? []).map(mg => (
                      <span
                        key={mg}
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: 'var(--c-text-muted)',
                          background: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border-subtle)',
                          borderRadius: '999px',
                          padding: '2px 7px',
                        }}
                      >
                        {mg}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--c-text-ghost)',
                      fontWeight: 600,
                    }}
                  >
                    {day.exercises?.length ?? 0} ej.
                  </span>
                  <span
                    className={`chevron${isExpanded ? ' open' : ''}`}
                    style={{
                      color: 'var(--c-text-ghost)',
                      fontSize: '12px',
                    }}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {/* Expandable exercise list */}
              <div
                className={`exercise-sets-wrapper${isExpanded ? '' : ' collapsed'}`}
              >
                <div className="exercise-sets-inner">
                  <div
                    style={{
                      borderTop: '1px solid var(--c-border-subtle)',
                      padding: '4px 0 8px',
                    }}
                  >
                    {(day.exercises ?? []).map((ex, exIdx) => (
                      <ExerciseRowPreview
                        key={ex.id ?? exIdx}
                        exercise={ex}
                        index={exIdx}
                      />
                    ))}
                    {(day.exercises ?? []).length === 0 && (
                      <p
                        style={{
                          fontSize: '11px',
                          color: 'var(--c-text-ghost)',
                          textAlign: 'center',
                          padding: '16px',
                        }}
                      >
                        Sin ejercicios asignados.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Close cycle footer ── */}
      {!closingConfirm ? (
        <button
          type="button"
          onClick={() => setClosingConfirm(true)}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--r-sm)',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            border: '1px solid var(--c-border)',
            background: 'transparent',
            color: 'var(--c-text-muted)',
            cursor: 'pointer',
            transition: 'all 150ms var(--ease-out)',
            minHeight: '44px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--c-accent)'
            e.currentTarget.style.color = 'var(--c-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--c-border)'
            e.currentTarget.style.color = 'var(--c-text-muted)'
          }}
        >
          Cerrar ciclo
        </button>
      ) : (
        <div
          className="fade-in"
          style={{
            background: 'var(--c-accent-dim)',
            border: '1px solid var(--c-accent-border)',
            borderRadius: 'var(--r-md)',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--c-accent)',
              letterSpacing: '-0.02em',
            }}
          >
            ¿Seguro que quieres cerrar este ciclo?
          </p>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--c-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Se guardará en el historial y podrás crear uno nuevo.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onClose(activeCycle.id)}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '11px',
              }}
            >
              Sí, cerrar ciclo
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setClosingConfirm(false)}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '11px',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Single exercise row inside the expanded day
function ExerciseRowPreview({ exercise, index }) {
  const hasWeight  = exercise.suggested_weight !== null && exercise.suggested_weight !== undefined
  const unit       = exercise.unit ?? 'kg'
  const intensity  = exercise.intensity_percent ?? null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '10px 18px',
        borderBottom: '1px solid var(--c-border-subtle)',
        gap: '12px',
      }}
    >
      {/* Index circle */}
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 800,
          color: 'var(--c-text-muted)',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {index + 1}
      </div>

      {/* Exercise info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--c-text)',
            letterSpacing: '-0.02em',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {exercise.exercise_name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sets × reps */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--c-text-secondary)',
            }}
          >
            {exercise.sets} × {exercise.reps_min}–{exercise.reps_max}
          </span>

          {/* Suggested weight */}
          {hasWeight ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--c-text-dim)',
              }}
            >
              ~{exercise.suggested_weight} {unit}
            </span>
          ) : (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--c-text-ghost)',
              }}
            >
              Por definir
            </span>
          )}

          {/* Intensity badge */}
          {intensity !== null && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--c-accent)',
                background: 'var(--c-accent-dim)',
                border: '1px solid var(--c-accent-border)',
                borderRadius: '999px',
                padding: '2px 7px',
              }}
            >
              {intensity}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Wizard state machine ────────────────────────────────────────────────────

const TOTAL_STEPS_WITHOUT_PRIORITY = 4 // Goal, Nivel, Disponibilidad, Modo
const TOTAL_STEPS_WITH_PRIORITY    = 5

function getInitialWizardData() {
  return {
    name:              'Mi ciclo',
    goal:              null,
    level:             null,
    daysPerWeek:       4,
    dailyTimeMinutes:  60,
    durationWeeks:     8,
    splitChoice:       null,
    prioritizedGroups: [],
    mode:              'auto',
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Cycle() {
  const { user } = useAuth()
  const {
    activeCycle,
    cycleData,
    cycleMemory,
    currentWeek,
    loading,
    error,
    createCycle,
    closeCycle,
    refetch,
  } = useCycle()

  // Wizard state
  const [wizardStep, setWizardStep]   = useState(0)  // 0-based
  const [wizardData, setWizardData]   = useState(getInitialWizardData)
  const [generatedPlan, setGeneratedPlan] = useState(null)
  const [generating, setGenerating]   = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState(null)

  // Whether the "Prioridades" step should be shown
  const hasCycleMemory = cycleMemory.length > 0
  const totalSteps     = hasCycleMemory ? TOTAL_STEPS_WITH_PRIORITY : TOTAL_STEPS_WITHOUT_PRIORITY
  // Step indices: 0=Goal, 1=Nivel, 2=Disponibilidad, 3=Modo, 4=Prioridades(optional)
  // After last step → show preview

  const setWizard = (key, value) => {
    setWizardData(prev => ({ ...prev, [key]: value }))
  }

  // Check if current step is valid to proceed
  const canProceed = useCallback(() => {
    if (wizardStep === 0) return !!wizardData.goal
    if (wizardStep === 1) return !!wizardData.level
    if (wizardStep === 2) return !!wizardData.daysPerWeek && !!wizardData.dailyTimeMinutes && !!wizardData.durationWeeks
    if (wizardStep === 3) return !!wizardData.mode
    if (wizardStep === 4) return true // Priorities step always passable
    return true
  }, [wizardStep, wizardData])

  // Fetch exercise history from the sets table to compute best 1RMs
  const fetchExerciseHistory = async () => {
    if (!user) return {}
    try {
      const { data, error: histErr } = await supabase
        .from('sets')
        .select('exercise_name, weight, reps, unit')
        .eq('user_id', user.id)
        .not('weight', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(2000)

      if (histErr) throw histErr

      // Build exercise history: for each exercise, compute estimated 1RM
      // using Epley formula: 1RM = weight × (1 + reps / 30)
      const historyMap = {}
      for (const row of data ?? []) {
        if (!row.exercise_name || !row.weight || !row.reps) continue
        const est1RM = row.weight * (1 + row.reps / 30)
        const existing = historyMap[row.exercise_name]
        if (!existing || est1RM > existing.best1RM) {
          historyMap[row.exercise_name] = {
            best1RM: est1RM,
            unit:    row.unit ?? 'kg',
          }
        }
      }
      return historyMap
    } catch (err) {
      console.error('Error fetching exercise history:', err)
      return {}
    }
  }

  // Navigate forward
  const handleNext = async () => {
    if (!canProceed()) return

    const isLastStep = wizardStep === totalSteps - 1

    if (isLastStep) {
      // Generate plan then show preview
      setGenerating(true)
      setShowPreview(true)
      try {
        const exerciseHistory = await fetchExerciseHistory()

        // Small artificial delay so the "Generando plan..." state is visible
        await new Promise(resolve => setTimeout(resolve, 1500))

        if (wizardData.mode === 'auto') {
          const plan = generateCyclePlan(
            {
              goal:              wizardData.goal,
              level:             wizardData.level,
              daysPerWeek:       wizardData.daysPerWeek,
              dailyTimeMinutes:  wizardData.dailyTimeMinutes,
              durationWeeks:     wizardData.durationWeeks,
              splitChoice:       wizardData.splitChoice ?? null,
              prioritizedGroups: wizardData.prioritizedGroups ?? [],
            },
            exerciseHistory
          )
          setGeneratedPlan(plan)
        } else {
          // Manual mode — empty plan scaffold
          setGeneratedPlan([])
        }
      } finally {
        setGenerating(false)
      }
      return
    }

    setWizardStep(prev => prev + 1)
  }

  // Navigate back
  const handleBack = () => {
    if (showPreview) {
      setShowPreview(false)
      setGeneratedPlan(null)
      return
    }
    if (wizardStep === 0) return
    setWizardStep(prev => prev - 1)
  }

  // Create cycle from preview
  const handleCreateCycle = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const exerciseHistory = await fetchExerciseHistory()
      await createCycle(wizardData, exerciseHistory)
      // Reset wizard
      setWizardStep(0)
      setWizardData(getInitialWizardData())
      setGeneratedPlan(null)
      setShowPreview(false)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // Close the active cycle
  const handleCloseCycle = async (cycleId) => {
    // Compute rough volumeByGroup from cycleData
    const volumeByGroup = {}
    if (cycleData?.exercises) {
      for (const ex of cycleData.exercises) {
        // We don't have actual logged volume here, so use planned sets as proxy
        // Real apps would aggregate from workout_sets; this is the placeholder computation
        const sets = ex.sets ?? 0
        // Map exercise to muscle group via the day's muscle_groups
        const day = cycleData.days.find(d => d.id === ex.cycle_day_id)
        if (day?.muscle_groups) {
          for (const mg of day.muscle_groups) {
            volumeByGroup[mg] = (volumeByGroup[mg] ?? 0) + sets
          }
        }
      }
    }
    try {
      await closeCycle(cycleId, volumeByGroup)
    } catch (err) {
      console.error('Error closing cycle:', err)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div
          style={{
            padding: '40px 20px',
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {[100, 160, 120, 80].map((h, i) => (
            <div
              key={i}
              style={{
                height: h,
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-subtle)',
                borderRadius: 'var(--r-lg)',
                opacity: 1 - i * 0.18,
              }}
            />
          ))}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div
        style={{
          padding: '32px 20px 80px',
          maxWidth: '600px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* ── Active cycle ── */}
        {activeCycle ? (
          <ActiveCycleView
            activeCycle={activeCycle}
            cycleData={cycleData}
            currentWeek={currentWeek}
            onClose={handleCloseCycle}
          />
        ) : (
          <>
            {/* ── Wizard / Preview ── */}
            {!showPreview ? (
              <>
                {/* Step dots */}
                <StepDots total={totalSteps} current={wizardStep} />

                {/* Step content */}
                {wizardStep === 0 && (
                  <StepGoal
                    value={wizardData.goal}
                    onChange={v => setWizard('goal', v)}
                  />
                )}
                {wizardStep === 1 && (
                  <StepLevel
                    value={wizardData.level}
                    onChange={v => setWizard('level', v)}
                  />
                )}
                {wizardStep === 2 && (
                  <StepAvailability
                    daysPerWeek={wizardData.daysPerWeek}
                    dailyTimeMinutes={wizardData.dailyTimeMinutes}
                    durationWeeks={wizardData.durationWeeks}
                    onChange={(key, val) => setWizard(key, val)}
                  />
                )}
                {wizardStep === 3 && (
                  <StepMode
                    value={wizardData.mode}
                    onChange={v => setWizard('mode', v)}
                  />
                )}
                {wizardStep === 4 && hasCycleMemory && (
                  <StepPriorities
                    cycleMemory={cycleMemory}
                    value={wizardData.prioritizedGroups}
                    onChange={v => setWizard('prioritizedGroups', v)}
                  />
                )}

                {/* Navigation */}
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '36px',
                  }}
                >
                  {wizardStep > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleBack}
                      style={{
                        flex: 1,
                        padding: '15px',
                        fontSize: '11px',
                        minHeight: '50px',
                      }}
                    >
                      ← Anterior
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={!canProceed()}
                    style={{
                      flex: 2,
                      padding: '15px',
                      fontSize: '11px',
                      minHeight: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {wizardStep === totalSteps - 1 ? 'Ver plan →' : 'Siguiente →'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Plan preview */}
                <PlanPreview
                  plan={generatedPlan}
                  wizardData={wizardData}
                  generating={generating}
                  onCreate={handleCreateCycle}
                />

                {/* Back button while generating or showing preview */}
                {!generating && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBack}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      padding: '14px',
                      fontSize: '11px',
                      minHeight: '44px',
                    }}
                  >
                    ← Volver al wizard
                  </button>
                )}

                {/* Create error */}
                {createError && (
                  <div
                    className="fade-in"
                    style={{
                      marginTop: '12px',
                      background: 'var(--c-accent-dim)',
                      border: '1px solid var(--c-accent-border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: 'var(--c-accent)',
                    }}
                  >
                    {createError}
                  </div>
                )}

                {/* Creating overlay spinner */}
                {creating && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      justifyContent: 'center',
                      marginTop: '16px',
                    }}
                  >
                    <span
                      className="spinner"
                      style={{
                        borderTopColor: 'var(--c-accent)',
                        borderColor: 'var(--c-border)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--c-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      Creando ciclo...
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Global error */}
            {error && (
              <div
                className="fade-in"
                style={{
                  marginTop: '16px',
                  background: 'var(--c-accent-dim)',
                  border: '1px solid var(--c-accent-border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: 'var(--c-accent)',
                }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
