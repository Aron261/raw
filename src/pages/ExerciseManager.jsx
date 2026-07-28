import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useExerciseGroups } from '../hooks/useExerciseGroups'
import { useUnlinkedExercises } from '../hooks/useExerciseLinking'
import { useExerciseLang } from '../hooks/useExerciseLang'
import LinkExerciseSheet from '../components/LinkExerciseSheet'
import { MUSCLE_GROUPS, LEGACY_GROUPS } from '../lib/muscleGroups'
import { useLang } from '../hooks/useLang'

const UNCLASSIFIED = 'Sin clasificar'
const eyebrow = { fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }

// A single exercise row — tap to expand a chip selector and reassign its group.
function ExerciseRow({ ex, expanded, onToggle, onPick, busy }) {
  const label = ex.effective || UNCLASSIFIED
  const attention = ex.needsAttention
  return (
    <div style={{ borderTop: '1px solid var(--c-border-subtle)', opacity: busy ? 0.5 : 1, transition: 'opacity 150ms' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', textAlign: 'left', background: 'transparent' }}
      >
        <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ex.name}
        </span>
        <span style={{
          flexShrink: 0, fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
          background: attention ? 'var(--c-action-dim)' : 'var(--c-surface-2)',
          color: attention ? 'var(--c-action-text)' : 'var(--c-text-dim)',
          border: `1px solid ${attention ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
        }}>
          {label}
        </span>
        <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '12px', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>›</span>
      </button>

      {expanded && (
        <div style={{ paddingBottom: '12px' }}>
          {ex.suggestion && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '10px', marginBottom: '8px' }}>
              Sugerencia: <span style={{ color: 'var(--c-text-dim)', fontWeight: 700 }}>{ex.suggestion}</span>
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {MUSCLE_GROUPS.map(g => {
              const active = ex.effective === g
              const suggested = ex.suggestion === g && !active
              return (
                <button
                  key={g}
                  onClick={() => onPick(g)}
                  style={{
                    padding: '7px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em',
                    background: active ? 'var(--c-accent)' : 'var(--c-surface-2)',
                    color: active ? 'var(--c-on-action)' : 'var(--c-text)',
                    border: `1px solid ${active ? 'var(--c-accent)' : suggested ? 'var(--c-accent-border)' : 'var(--c-border-subtle)'}`,
                  }}
                >
                  {g}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ejercicios sin vincular ───────────────────────────────────────────────
// Los que ningún alias pudo resolver contra la librería. No se vincularon
// solos a propósito: decidir si un «Chest Supported Row» es un remo en máquina
// o un remo T-bar con pecho apoyado reescribiría historial real de entreno.
function UnlinkedSection({ items, onPick }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <p style={{ ...eyebrow, color: 'var(--c-action-text)' }}>Sin vincular</p>
        <span style={{ color: 'var(--c-text-ghost)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{items.length}</span>
      </div>
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.4, marginBottom: '8px' }}>
        No coinciden con ningún ejercicio de la librería, así que tienen su propio historial.
        Si alguno es en realidad uno de la librería, tócalo y vincúlalo para unir los récords.
      </p>
      {items.map(ex => (
        <button
          key={ex.id}
          onClick={() => onPick(ex)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 0', textAlign: 'left', background: 'transparent',
            borderTop: '1px solid var(--c-border-subtle)', minHeight: '44px', cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ex.name}
          </span>
          <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {ex.sets} {ex.sets === 1 ? 'serie' : 'series'}
          </span>
          <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '12px' }}>›</span>
        </button>
      ))}
    </div>
  )
}

export default function ExerciseManager() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { lang } = useExerciseLang()
  const { exercises, needsAttention, loading, classify, refresh } = useExerciseGroups(lang)
  const { unlinked, refresh: refreshUnlinked } = useUnlinkedExercises()
  const [linking, setLinking] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const pick = async (id, group) => {
    setBusyId(id)
    try { await classify(id, group); setExpandedId(null) }
    catch (err) { console.error('Classify failed:', err) }
    finally { setBusyId(null) }
  }

  // Group by effective group; order attention buckets first.
  const buckets = {}
  for (const ex of exercises) {
    const key = ex.isUnclassified ? UNCLASSIFIED : ex.effective
    ;(buckets[key] ||= []).push(ex)
  }
  const priority = [UNCLASSIFIED, ...LEGACY_GROUPS, ...MUSCLE_GROUPS]
  const rest = Object.keys(buckets).filter(k => !priority.includes(k)).sort()
  const sections = [...priority, ...rest].filter(k => buckets[k]?.length)

  return (
    <Layout>
      <div style={{ padding: '0 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }} className="fade-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '4px' }}>
          <button onClick={() => navigate(-1)} style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }} aria-label="Volver">←</button>
          <h1 style={{ flex: 1, fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            Mis ejercicios
          </h1>
        </div>
        <p style={{ ...eyebrow, marginBottom: '20px' }}>
          {exercises.length} ejercicios
          {needsAttention.length > 0 && <> · <span style={{ color: 'var(--c-action-text)' }}>{needsAttention.length} por revisar</span></>}
        </p>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <span className="spinner" style={{ width: '20px', height: '20px' }} />
          </div>
        )}

        {!loading && exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--c-border)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {t('Todavía no hay ejercicios')}
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '6px', lineHeight: 1.5, maxWidth: '32ch', marginInline: 'auto' }}>
              {t('Aparecen aquí solos en cuanto registras tu primer entreno. Desde aquí los ordenas por grupo muscular.')}
            </p>
          </div>
        )}

        {!loading && <UnlinkedSection items={unlinked} onPick={setLinking} />}

        {!loading && sections.map(section => {
          const isAttention = section === UNCLASSIFIED || LEGACY_GROUPS.includes(section)
          return (
            <div key={section} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <p style={{ ...eyebrow, color: isAttention ? 'var(--c-action-text)' : 'var(--c-text-dim)' }}>{section}</p>
                <span style={{ color: 'var(--c-text-ghost)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{buckets[section].length}</span>
              </div>
              {isAttention && (
                <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.4, marginBottom: '6px' }}>
                  {section === UNCLASSIFIED
                    ? 'Sin grupo asignado — tócalos para clasificarlos.'
                    : 'Grupo antiguo tras dividir Pierna — reasígnalos a cuádriceps, hamstrings, glúteo o gemelos.'}
                </p>
              )}
              <div>
                {buckets[section].map(ex => (
                  <ExerciseRow
                    key={ex.id}
                    ex={ex}
                    expanded={expandedId === ex.id}
                    busy={busyId === ex.id}
                    onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                    onPick={(g) => pick(ex.id, g)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div style={{ height: '32px' }} />
      </div>

      {linking && (
        <LinkExerciseSheet
          exercise={linking}
          onClose={() => setLinking(null)}
          onDone={() => { setLinking(null); refreshUnlinked(); refresh() }}
        />
      )}
    </Layout>
  )
}
