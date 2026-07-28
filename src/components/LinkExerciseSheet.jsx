import { useEffect, useState } from 'react'
import { Sheet, Button } from './ui'
import { suggestLibraryMatches, mergeExerciseIntoLibrary } from '../hooks/useExerciseLinking'
import { useLang } from '../hooks/useLang'

/*
 * Link one unresolved exercise to its canonical library entry — or leave it
 * custom. Suggestions come from trigram similarity against the library's
 * Spanish name, English name and aliases, but the lifter decides: a score of
 * 0.5 happily proposes "Peso muerto rumano" for "Deadlift", which is a
 * different lift. Nothing here is applied automatically.
 *
 * When the lifter already has an exercise for the chosen entry this is a
 * merge, and the sheet says so with the set counts, because merging moves
 * training history and that should never be a surprise.
 */
export default function LinkExerciseSheet({ exercise, onClose, onDone }) {
  const { t } = useLang()
  const [suggestions, setSuggestions] = useState(null)
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    suggestLibraryMatches(exercise.name, 6)
      .then(rows => { if (!cancelled) setSuggestions(rows) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
    return () => { cancelled = true }
  }, [exercise.name])

  const confirm = async () => {
    if (!picked || busy) return
    setBusy(true)
    setErr(null)
    try {
      await mergeExerciseIntoLibrary(exercise.id, picked.library_id)
      onDone()
    } catch (e) {
      setErr(e.message || 'No se pudo vincular.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={exercise.name}
      subtitle={`${exercise.sets} ${exercise.sets === 1 ? 'serie registrada' : 'series registradas'} · ¿qué ejercicio es?`}
      onClose={onClose}
    >
      {suggestions === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
          <span className="spinner" style={{ width: '18px', height: '18px' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '46vh', overflowY: 'auto', marginBottom: '14px' }}>
            {suggestions.map(s => {
              const active = picked?.library_id === s.library_id
              return (
                <button
                  key={s.library_id}
                  onClick={() => setPicked(active ? null : s)}
                  aria-pressed={active}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                    padding: '13px 12px', minHeight: '44px', borderRadius: 'var(--r-md)',
                    marginBottom: '6px', cursor: 'pointer',
                    background: active ? 'var(--c-action-dim)' : 'var(--c-surface-2)',
                    border: `1px solid ${active ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
                    transition: 'background 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                      {s.name}
                    </span>
                    <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      {s.name_en}{s.muscle_group ? ` · ${s.muscle_group}` : ''}
                    </span>
                  </span>
                  {active && (
                    <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '14px', fontWeight: 900 }}>✓</span>
                  )}
                </button>
              )
            })}
            {suggestions.length === 0 && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                {t('No encontramos nada parecido en la librería.')}
              </p>
            )}
          </div>

          {picked && (
            <p style={{
              color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px',
              background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
              borderRadius: 'var(--r-sm)', padding: '10px 12px',
            }}>
              «{exercise.name}» pasará a llamarse «{picked.name}». Sus {exercise.sets}{' '}
              {exercise.sets === 1 ? 'serie' : 'series'} se conservan; si ya tienes ese ejercicio,
              los dos historiales se unen en uno.
            </p>
          )}

          {err && (
            <p role="alert" style={{ color: 'var(--c-action-text)', fontSize: '11px', marginBottom: '10px' }}>{err}</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="primary" full size="lg" disabled={!picked || busy} loading={busy} onClick={confirm}>
              {picked ? `Es «${picked.name}»` : 'Elige uno'}
            </Button>
            <Button variant="ghost" full onClick={onClose}>
              {t('Es un ejercicio propio — déjalo así')}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
