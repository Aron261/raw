import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSharedRoutine } from '../hooks/useSharedRoutine'
import { useRoutines } from '../hooks/useRoutines'
import { useAuth } from '../hooks/useAuth'
import { useBetaGate } from '../hooks/useBetaGate'
import { sharedRoutineToInput, sharePath, countExercises } from '../lib/share'
import { ERROR_STYLE } from '../lib/ui'
import { Button, Logo } from '../components/ui'

// Pantalla pública de una rutina compartida (/r/:token).
//
// Va FUERA de RequireAuth: quien recibe el enlace normalmente no tiene cuenta
// todavía, y pedirle que se registre para ver siquiera de qué va el plan es la
// forma más rápida de que cierre la pestaña. Ve el plan primero; guardarlo —
// eso sí— exige cuenta, porque la copia se escribe en la suya.

const eyebrow = {
  fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--c-bg)' }}>
      <div style={{ padding: '0 16px 140px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  )
}

function Splash() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="animate-pulse" style={{ color: 'var(--c-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
        RAW
      </span>
    </div>
  )
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '32px', paddingBottom: '24px' }}>
      <Logo size={22} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '0.02em', color: 'var(--c-text)', lineHeight: 1 }}>
        RAW
      </span>
    </div>
  )
}

// Un día del plan, en solo lectura: el nombre, el enfoque y sus ejercicios con
// las series objetivo. Mismo lenguaje visual que la tarjeta del ciclo activo.
function DayCard({ day, index }) {
  const exercises = day.exercises || []
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
      borderRadius: '16px', padding: '16px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: exercises.length ? '10px' : 0 }}>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', minWidth: 0 }}>
          {day.day_name || `Día ${index + 1}`}
        </p>
        {day.focus && (
          <span style={{ ...eyebrow, flexShrink: 0 }}>{day.focus}</span>
        )}
      </div>

      {exercises.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>Sin ejercicios.</p>
      ) : (
        exercises.map((ex, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
            padding: '9px 0', borderTop: '1px solid var(--c-border-subtle)',
          }}>
            <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', minWidth: 0 }}>
              {ex.exercise_name}
            </span>
            {(ex.sets || ex.reps) && (
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                {ex.sets ?? '—'} × {ex.reps ?? '—'}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default function SharedRoutine() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const beta = useBetaGate()
  const { shared, loading, error, notFound, noteImport } = useSharedRoutine(token)
  const { createRoutine } = useRoutines()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  if (loading || authLoading) return <Splash />

  // Enlace inexistente, desactivado o rutina borrada: la misma respuesta para
  // los tres casos, para que probar tokens no revele cuáles existieron.
  if (notFound || error) {
    return (
      <Shell>
        <Brand />
        <h1 style={{ color: 'var(--c-text)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '8px' }}>
          Este enlace ya no está disponible
        </h1>
        <p style={{ color: 'var(--c-text-dim)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
          Puede que quien lo compartió lo haya desactivado. Pídele uno nuevo.
        </p>
        <Button variant="secondary" onClick={() => navigate('/')}>Ir a RAW</Button>
      </Shell>
    )
  }

  const isCycle = shared.type !== 'single_day'
  const days = shared.days || []
  const exercises = countExercises(shared)
  // Con sesión, la aprobación de beta tarda un instante en resolverse. Hasta que
  // resuelve no se sabe qué hará el botón, así que espera en vez de prometer de
  // más y cambiar de etiqueta bajo el pulgar.
  const checkingAccess = !!user && beta.loading
  const canSave = !!user && beta.approved

  const handleSave = async () => {
    // Sin sesión: al login, y de vuelta aquí con el enlace intacto.
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(sharePath(token))}`)
      return
    }
    // Con sesión pero sin beta: la copia se escribiría en su cuenta y el RLS la
    // rechazaría. Se le manda a la puerta de la beta en vez de fallar en seco.
    if (!beta.approved) {
      navigate('/')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await createRoutine(sharedRoutineToInput(shared))
      // El contador del dueño es decoración; la copia ya está guardada, así que
      // no se espera por él ni se le cuenta a nadie si falla.
      Promise.resolve(noteImport()).catch(() => {})
      // El anuncio viaja con la navegación: leerlo aquí no serviría de nada
      // porque esta pantalla desaparece en el mismo tick.
      navigate('/rutinas', { state: { imported: shared.name } })
    } catch (e) {
      setSaveError(e.message || 'No se pudo guardar la rutina')
      setSaving(false)
    }
  }

  return (
    <Shell>
      <Brand />

      <div className="fade-in">
        <p style={{ ...eyebrow, marginBottom: '8px' }}>
          {isCycle ? 'Ciclo compartido' : 'Rutina compartida'}
        </p>
        <h1 style={{ color: 'var(--c-text)', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
          {shared.name}
        </h1>
        {shared.shared_by && (
          <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '8px' }}>
            Compartida por <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{shared.shared_by}</span>
          </p>
        )}

        {/* Meta: lo que define el plan de un vistazo. */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '24px' }}>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>
            {days.length} {days.length === 1 ? 'día' : 'días'}
          </span>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {exercises} ejercicios</span>
          {shared.goal && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {shared.goal}</span>}
          {shared.level && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {shared.level}</span>}
          {shared.days_per_week && (
            <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>· {shared.days_per_week} días/sem</span>
          )}
        </div>

        {shared.description && (
          <p style={{
            color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-line',
            padding: '12px 14px', background: 'var(--c-surface)', borderRadius: '12px', marginBottom: '20px',
          }}>
            {shared.description}
          </p>
        )}

        {days.map((day, i) => <DayCard key={i} day={day} index={i} />)}

        {saveError && <div style={{ ...ERROR_STYLE, marginTop: '14px' }}>{saveError}</div>}
      </div>

      {/* CTA fija en la zona del pulgar: es la única acción de la pantalla. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: 'var(--c-bg)', borderTop: '1px solid var(--c-border-subtle)',
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Button
            variant="primary" full size="lg"
            loading={saving || checkingAccess}
            disabled={saving || checkingAccess}
            onClick={handleSave}
          >
            {saving ? 'Guardando...' : canSave ? 'Guardar en mis rutinas' : 'Entrar y guardarla'}
          </Button>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', lineHeight: 1.45, textAlign: 'center', marginTop: '8px' }}>
            {canSave
              ? 'Se guarda como una copia tuya: edítala sin tocar la original.'
              : 'Necesitas una cuenta de RAW para guardarla.'}
          </p>
        </div>
      </div>
    </Shell>
  )
}
