import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeader from './SectionHeader'
import Segmented from './Segmented'
import { useLang } from '../../hooks/useLang'
import { clampLines } from '../../lib/ui'

const CAP = 6

// Tres preguntas distintas sobre la misma lista:
//   Relativa — cuánto levantas PARA TU CUERPO. Es la única que sube cuando
//     mejoras y la única en la que un curl puede ganarle a un peso muerto.
//   1RM      — cuánto mueves en absoluto. Ordenaba así por defecto, y por eso
//     el ranking no cambiaba nunca: arriba el peso muerto, abajo el curl,
//     entrenaras lo que entrenaras.
//   A-Z      — para buscar, no para competir.
const SORT_OPTIONS = [
  { id: 'rel', label: 'Relativa' },
  { id: 'rm',  label: '1RM' },
  { id: 'az',  label: 'A-Z' },
]

// El nivel se pinta con el mismo acento de siempre y con su palabra al lado:
// DESIGN.md no tiene un segundo color, y en el gimnasio con sol de frente un
// tono no distingue nada. La palabra hace el trabajo.
function LevelBadge({ level }) {
  if (!level) return null
  return (
    <span style={{
      flexShrink: 0,
      fontFamily: 'var(--font-sans)', fontSize: '9.5px', fontWeight: 800,
      letterSpacing: '0.02em', textTransform: 'uppercase',
      color: 'var(--c-action-text)',
      background: 'var(--c-action-dim)',
      border: '1px solid var(--c-action-border)',
      borderRadius: 'var(--r-xs)',
      padding: '2px 6px',
    }}>
      {level}
    </span>
  )
}

export default function AllLiftsModule({ data, readOnly = false }) {
  const { t, locale } = useLang()
  const navigate = useNavigate()

  const lifts = data?.allLifts || []
  const rel = data?.relativeStrength || []
  const hasRel = rel.length > 0

  // Sin báscula no hay fuerza relativa, así que la vista por defecto cae al
  // 1RM en vez de abrir en una pestaña vacía.
  const [sort, setSort] = useState(hasRel ? 'rel' : 'rm')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const options = hasRel ? SORT_OPTIONS : SORT_OPTIONS.filter(o => o.id !== 'rel')
  const byRel = sort === 'rel'

  const filtered = useMemo(() => {
    const source = byRel ? rel : lifts
    const q = query.trim().toLowerCase()
    let list = q ? source.filter(l => l.name.toLowerCase().includes(q)) : source
    if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [byRel, rel, lifts, query, sort])

  if (lifts.length === 0) return null

  const showAll = expanded || query.trim().length > 0
  const shown = showAll ? filtered : filtered.slice(0, CAP)
  const showSearch = lifts.length > CAP
  const openLift = readOnly ? undefined : (name) => navigate(`/exercise/${encodeURIComponent(name)}`)

  const ratio = (v) => v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Lo destacado solo tiene sentido en un orden que signifique algo, y sin
  // búsqueda activa.
  const featured = (!query.trim() && sort !== 'az') ? filtered[0] : null
  const rows = featured ? shown.slice(1) : shown

  const subtitle = byRel
    ? t('Tu mejor marca dividida por tu peso corporal. El nivel solo aparece en los básicos.')
    : `${lifts.length} ${t('ejercicios')} · ${t('mejor 1RM estimado')}`

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        subtitle={subtitle}
        right={<Segmented options={options.map(o => ({ ...o, label: t(o.label) }))} value={sort} onChange={setSort} ariaLabel={t('Ordenar levantamientos')} />}
      />

      {showSearch && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('Buscar ejercicio...')}
          aria-label={t('Buscar ejercicio')}
          className="input-field"
          style={{ width: '100%', fontSize: '13px', marginBottom: '10px' }}
        />
      )}

      {featured && (
        <button
          onClick={openLift ? () => openLift(featured.name) : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', marginBottom: '10px', textAlign: 'left',
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-md)',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                ▲ {byRel ? t('Más fuerte para tu peso') : t('Más fuerte')}
              </span>
              {byRel && <LevelBadge level={featured.level} />}
            </span>
            <span style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', ...clampLines(2) }}>
              {featured.name}
            </span>
            {byRel && featured.next && (
              <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, marginTop: '4px' }}>
                {t('{n}× para {level}', { n: ratio(featured.next.ratio), level: t(featured.next.level) })}
              </span>
            )}
          </div>
          <span style={{ flexShrink: 0, color: 'var(--c-text)', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {byRel ? `${ratio(featured.ratio)}×` : featured.best1RM}
            {!byRel && <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '12px', marginLeft: '3px' }}>{featured.unit}</span>}
          </span>
        </button>
      )}

      {shown.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '12px 0' }}>
          {t('Ningún ejercicio coincide con')} «{query.trim()}».
        </p>
      ) : (
        <div>
          {rows.map((lift, i) => (
            <button
              key={lift.name}
              onClick={openLift ? () => openLift(lift.name) : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 2px', textAlign: 'left', background: 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', ...clampLines(2) }}>
                  {lift.name}
                </span>
                {byRel && lift.level && (
                  <span style={{ display: 'inline-block', marginTop: '4px' }}>
                    <LevelBadge level={lift.level} />
                  </span>
                )}
              </div>
              <span style={{ flexShrink: 0, color: 'var(--c-text)', fontWeight: 800, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                {byRel ? `${ratio(lift.ratio)}×` : lift.best1RM}
                {!byRel && <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{lift.unit}</span>}
              </span>
              {!readOnly && <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '15px', lineHeight: 1 }}>›</span>}
            </button>
          ))}
        </div>
      )}

      {!query.trim() && filtered.length > CAP && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontFamily: 'var(--font-sans)', color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          {expanded ? t('Ver menos') : `${t('Ver todos')} (${filtered.length})`}
          <span aria-hidden="true" style={{ fontSize: '13px' }}>{expanded ? '↑' : '↓'}</span>
        </button>
      )}
    </section>
  )
}
