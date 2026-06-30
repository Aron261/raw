import { useState } from 'react'
import { Sheet } from '../ui'
import { MUSCLE_GROUPS } from '../../lib/muscleGroups'

// Assign a muscle group to each unclassified exercise. Items disappear as they
// get a group (the parent's `items` shrinks reactively).
export default function ClassifySheet({ items, onClassify, onClose }) {
  const [busyId, setBusyId] = useState(null)

  const pick = async (id, group) => {
    setBusyId(id)
    try { await onClassify(id, group) }
    catch (err) { console.error('Classify failed:', err) }
    finally { setBusyId(null) }
  }

  const done = items.length === 0

  return (
    <Sheet
      title="Clasificar ejercicios"
      subtitle={done ? null : 'Asigna un grupo muscular a cada ejercicio.'}
      onClose={onClose}
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, marginBottom: '6px' }}>
            ¡Todo clasificado!
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
            Tu balance muscular ya cuenta estos ejercicios.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '8px' }}>
          {items.map(ex => (
            <div key={ex.id} style={{ opacity: busyId === ex.id ? 0.5 : 1, transition: 'opacity 150ms' }}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '8px' }}>
                {ex.name}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {MUSCLE_GROUPS.map(g => (
                  <button
                    key={g}
                    disabled={busyId === ex.id}
                    onClick={() => pick(ex.id, g)}
                    style={{
                      padding: '8px 12px', borderRadius: '999px',
                      background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
                      color: 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em',
                      transition: 'background 120ms var(--ease-out), border-color 120ms var(--ease-out)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-action-dim)'; e.currentTarget.style.borderColor = 'var(--c-action-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
