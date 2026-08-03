import { useNavigate } from 'react-router-dom'
import { useExerciseGroups } from '../../hooks/useExerciseGroups'
import { CATCH_ALL } from '../../lib/muscleGroups'
import SectionHeader from './SectionHeader'
import { useLang } from '../../hooks/useLang'
import { useExerciseLang } from '../../hooks/useExerciseLang'
import { formatVolume } from '../../lib/format'

// All-time volume distribution across muscle groups, shown as proportional
// horizontal bars (relative to the most-trained group). Each exercise credits
// its main muscle in full and every secondary one at half, so the solid part of
// a bar is what the muscle did as the star of the exercise and the faded part
// what it did backing up someone else.

export default function MuscleBalanceModule({ data, readOnly = false }) {
  const { t, locale } = useLang()
  const { term } = useExerciseLang()
  const navigate = useNavigate()
  const { needsAttention } = useExerciseGroups()

  const groups = data?.muscleBalance || []
  if (groups.length === 0) return null

  // Keep the catch-all bucket last and visually muted — it's "sin clasificar",
  // not a real muscle group.
  const known = groups.filter(g => g.group !== CATCH_ALL)
  const other = groups.find(g => g.group === CATCH_ALL)
  const ordered = other ? [...known, other] : known
  const max = Math.max(...groups.map(g => g.volume), 1)

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title="Balance muscular"
        subtitle="Cómo se reparte tu volumen total (peso × reps) entre grupos. Cada ejercicio cuenta entero para su músculo principal y a la mitad para cada secundario."
      />
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border-subtle)', boxShadow: 'var(--e-1)',
        borderRadius: 'var(--r-md)',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        {ordered.map(g => {
          const isOther = g.group === CATCH_ALL
          const fill = isOther ? 'var(--c-border)' : 'var(--c-action)'
          // Suelo del 2 % para que un grupo pequeño no desaparezca, repartido
          // entre los dos tramos en la misma proporción que el dato real.
          const totalPct = Math.max(2, (g.volume / max) * 100)
          const directPct = g.volume ? totalPct * ((g.direct || 0) / g.volume) : 0
          return (
            <div key={g.group}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ color: isOther ? 'var(--c-text-muted)' : 'var(--c-text)', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {term(g.group)}
                </span>
                <span style={{ flexShrink: 0, color: 'var(--c-text-dim)', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700 }}>
                  {formatVolume(g.volume, locale, { empty: '0' })} kg
                </span>
              </div>
              <div style={{ display: 'flex', background: 'var(--c-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: `${directPct}%`,
                  background: fill,
                  transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
                <div style={{
                  width: `${totalPct - directPct}%`,
                  background: fill,
                  opacity: 0.35,
                  transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              {g.indirect > 0 && (
                <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, marginTop: '4px' }}>
                  {formatVolume(g.direct, locale, { empty: '0' })} {t('directo')}
                  {' · '}
                  {formatVolume(g.indirect, locale, { empty: '0' })} {t('indirecto')}
                </p>
              )}
            </div>
          )
        })}

        {other && (
          <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, lineHeight: 1.4, marginTop: '2px', paddingTop: '12px', borderTop: '1px solid var(--c-border-subtle)' }}>
            «Otros» son ejercicios sin grupo muscular asignado.
          </p>
        )}
      </div>

      {/* Manage / classify exercises — full editor at /ejercicios */}
      {!readOnly && (
      <button
        onClick={() => navigate('/ejercicios')}
        style={{
          marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontFamily: 'var(--font-sans)', color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        {needsAttention.length > 0
          ? `Clasificar ${needsAttention.length} ${needsAttention.length === 1 ? 'ejercicio' : 'ejercicios'}`
          : 'Gestionar ejercicios'}
        <span aria-hidden="true" style={{ fontSize: '13px' }}>→</span>
      </button>
      )}
    </section>
  )
}
