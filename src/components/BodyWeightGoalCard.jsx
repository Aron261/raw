import { useState, useMemo } from 'react'
import GoalRow from './GoalRow'
import GoalModal from './GoalModal'
import { groupGoals } from '../lib/goals'
import { useGoals } from '../hooks/useGoals'
import { useBodyWeight } from '../hooks/useBodyWeight'
import { useProfile } from '../hooks/useProfile'
import { useLang } from '../hooks/useLang'
import { defaultLiftUnit } from '../lib/units'

// La meta de peso corporal, en Nutrición.
//
// Estaba en Inicio junto a las de fuerza, y ahí no se podía hacer nada con
// ella: lo que mueve la báscula es lo que comes, no lo que levantas. Ahora se
// mide donde se actúa — debajo de los macros del día, que es la palanca.
//
// Solo lectura cuando un entrenador mira la ficha de un cliente: la meta es del
// cliente y se cambia desde su cuenta.
export default function BodyWeightGoalCard({ userId = null, readOnly = false }) {
  const { t } = useLang()
  const { open, completed, createGoal, deleteGoal, completeGoal } = useGoals(userId)
  const { logs } = useBodyWeight(userId)
  const { profile } = useProfile()
  const [showModal, setShowModal] = useState(false)

  const ctx = useMemo(() => ({ workouts: [], bodyWeightLogs: logs }), [logs])
  const groups = useMemo(() => groupGoals(open, ctx, { home: 'nutrition' }), [open, ctx])
  const done = useMemo(() => groupGoals(completed, ctx, { home: 'nutrition' }), [completed, ctx])

  const goals = groups.flatMap(g => g.goals)
  const archived = done.flatMap(g => g.goals)

  // Sin meta y sin poder crearla (vista de entrenador), la tarjeta no aporta
  // nada: mejor no ocupar sitio.
  if (!goals.length && !archived.length && readOnly) return null

  return (
    <section style={{ marginBottom: '22px' }}>
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
        borderRadius: 'var(--r-lg)',
        padding: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: goals.length ? '14px' : '10px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('Meta de peso')}
          </p>
          {!readOnly && !goals.length && (
            <button
              onClick={() => setShowModal(true)}
              aria-label={t('Agregar meta')}
              style={{
                color: 'var(--c-action-text)', fontSize: '22px', lineHeight: 1, fontWeight: 300,
                minWidth: '44px', minHeight: '44px', margin: '-11px -10px -11px 0',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              +
            </button>
          )}
        </div>

        {goals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {goals.map(goal => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onDelete={readOnly ? undefined : (g => deleteGoal(g.id))}
                onComplete={readOnly ? undefined : (g => completeGoal(g.id))}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 400, lineHeight: 1.5 }}>
            {t('Ponte un peso objetivo y esta pantalla te dice si lo que comes te está llevando ahí.')}
          </p>
        )}
      </div>

      {showModal && (
        <GoalModal
          home="nutrition"
          onClose={() => setShowModal(false)}
          onSave={async (data) => { await createGoal(data); setShowModal(false) }}
          progressCtx={ctx}
          currentWeightUnit={defaultLiftUnit(profile)}
        />
      )}
    </section>
  )
}
