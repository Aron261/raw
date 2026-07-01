import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeader from './SectionHeader'
import Segmented from './Segmented'

const CAP = 6
const SORT_OPTIONS = [{ id: 'rm', label: '1RM' }, { id: 'az', label: 'A-Z' }]

// Every exercise ranked by best estimated 1RM. Flat rows (no card) with search,
// sort, and a top-N cap. Rows tap into /exercise/:name — disabled in readOnly
// (coach viewing a client, where the detail page would show the coach's data).
export default function AllLiftsModule({ data, readOnly = false }) {
  const navigate = useNavigate()
  const lifts = data?.allLifts || []
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('rm')
  const [expanded, setExpanded] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q ? lifts.filter(l => l.name.toLowerCase().includes(q)) : lifts
    if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [lifts, query, sort])

  if (lifts.length === 0) return null

  const showAll = expanded || query.trim().length > 0
  const shown = showAll ? filtered : filtered.slice(0, CAP)
  const showSearch = lifts.length > CAP

  // Feature the strongest lift in the default view (not while searching/sorting
  // A-Z) — a distinct block that varies the section and celebrates the top PR.
  const featured = (!query.trim() && sort === 'rm') ? filtered[0] : null
  const rows = featured ? shown.slice(1) : shown
  const openLift = readOnly ? undefined : (name) => navigate(`/exercise/${encodeURIComponent(name)}`)

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title="Mis levantamientos"
        subtitle={`${lifts.length} ejercicios · mejor 1RM estimado`}
        right={<Segmented options={SORT_OPTIONS} value={sort} onChange={setSort} ariaLabel="Ordenar levantamientos" />}
      />

      {showSearch && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar ejercicio..."
          aria-label="Buscar ejercicio"
          className="input-field"
          style={{ width: '100%', fontSize: '13px', marginBottom: '10px' }}
        />
      )}

      {/* Featured: strongest lift */}
      {featured && (
        <button
          onClick={openLift ? () => openLift(featured.name) : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', marginBottom: '10px', textAlign: 'left',
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '14px',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--c-accent)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              ▲ Más fuerte
            </span>
            <span style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {featured.name}
            </span>
          </div>
          <span style={{ flexShrink: 0, color: 'var(--c-text)', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.03em' }}>
            {featured.best1RM}
            <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '12px', marginLeft: '3px' }}>{featured.unit}</span>
          </span>
        </button>
      )}

      {shown.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '12px 0' }}>
          Ningún ejercicio coincide con «{query.trim()}».
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
              <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lift.name}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--c-text)', fontWeight: 800, fontSize: '14px' }}>
                {lift.best1RM}
                <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{lift.unit}</span>
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
            fontFamily: 'var(--font-mono)', color: 'var(--c-accent)', fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {expanded ? 'Ver menos' : `Ver todos (${filtered.length})`}
          <span aria-hidden="true" style={{ fontSize: '13px' }}>{expanded ? '↑' : '↓'}</span>
        </button>
      )}
    </section>
  )
}
