import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useCycle } from '../hooks/useCycle'
import { useRoutines } from '../hooks/useRoutines'
import { pressProps, hoverColor, ERROR_STYLE } from '../lib/ui'

// ── Small section header ───────────────────────────────────────────────
function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {children}
      </p>
      {action}
    </div>
  )
}

// ── Cycle day pill ─────────────────────────────────────────────────────
function CycleDayCard({ day }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '12px',
      marginBottom: '6px',
    }}>
      <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
        {day.day_name}
      </p>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '3px' }}>
        {(day.exercises || []).length} ejercicios
        {day.muscle_groups?.length > 0 ? ` · ${day.muscle_groups.join(', ')}` : ''}
      </p>
    </div>
  )
}

// ── Routine card ───────────────────────────────────────────────────────
function RoutineCard({ routine, onPress }) {
  return (
    <button
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 16px', marginBottom: '6px',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
        borderRadius: '14px', textAlign: 'left',
        transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
      {...pressProps(0.98)}
    >
      <div>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
          {routine.name}
        </p>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          {routine.routine_exercises?.length || 0} ejercicios
        </p>
      </div>
      <span style={{ color: 'var(--c-text-dim)', fontSize: '14px' }}>›</span>
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────
export default function Programa() {
  const navigate = useNavigate()
  const { activeCycle, cycleData, loading: cycleLoading, error: cycleError } = useCycle()
  const { routines, loading: routinesLoading } = useRoutines()

  const cycleDays = cycleData?.days || []

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="fade-in" style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <h1 style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Programa
          </h1>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
            Ciclos y rutinas
          </p>
        </div>

        {/* ── Ciclo activo ── */}
        <section className="fade-in" style={{ marginBottom: '32px', animationDelay: '40ms' }}>
          <SectionTitle
            action={
              <button
                onClick={() => navigate('/cycle')}
                style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {activeCycle ? 'Gestionar →' : 'Crear →'}
              </button>
            }
          >
            Ciclo
          </SectionTitle>

          {cycleLoading && (
            <div style={{ height: '80px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px' }} />
          )}

          {cycleError && <div style={ERROR_STYLE}>{cycleError}</div>}

          {!cycleLoading && !activeCycle && (
            <button
              onClick={() => navigate('/cycle')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '28px 20px',
                background: 'var(--c-surface)', border: '2px dashed var(--c-border)',
                borderRadius: '16px',
                transition: 'border-color 150ms var(--ease-out)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
              {...pressProps(0.98)}
            >
              <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sin ciclo activo
              </p>
              <p style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '6px' }}>
                + Crear ciclo de entrenamiento
              </p>
            </button>
          )}

          {!cycleLoading && activeCycle && (
            <>
              {/* Cycle header card */}
              <div style={{
                padding: '16px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-subtle)',
                borderRadius: '16px',
                marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    {activeCycle.name}
                  </p>
                  <span style={{
                    background: 'var(--c-accent-dim)', color: 'var(--c-accent)',
                    fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--c-accent-border)',
                  }}>
                    Activo
                  </span>
                </div>
                <p style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 600 }}>
                  {activeCycle.split_type} · {activeCycle.goal} · {activeCycle.level}
                </p>
              </div>

              {/* Day list */}
              {cycleDays.map(day => (
                <CycleDayCard key={day.id} day={day} />
              ))}
            </>
          )}
        </section>

        {/* ── Rutinas ── */}
        <section className="fade-in" style={{ marginBottom: '32px', animationDelay: '80ms' }}>
          <SectionTitle
            action={
              <button
                onClick={() => navigate('/routines')}
                style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Gestionar →
              </button>
            }
          >
            Rutinas
          </SectionTitle>

          {routinesLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(2)].map((_, i) => (
                <div key={i} style={{ height: '60px', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px', opacity: 1 - i * 0.3 }} />
              ))}
            </div>
          )}

          {!routinesLoading && routines.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '28px 20px',
              background: 'var(--c-surface)', border: '2px dashed var(--c-border)',
              borderRadius: '16px',
            }}>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sin rutinas guardadas
              </p>
              <button
                onClick={() => navigate('/routines')}
                style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '8px', display: 'block', margin: '8px auto 0' }}
              >
                + Crear rutina
              </button>
            </div>
          )}

          {!routinesLoading && routines.map(r => (
            <RoutineCard key={r.id} routine={r} onPress={() => navigate('/routines')} />
          ))}
        </section>

      </div>
    </Layout>
  )
}
