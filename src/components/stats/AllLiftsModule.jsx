import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeader from './SectionHeader'

const CAP = 6

function SortToggle({ sort, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '2px', background: 'var(--c-surface-2)', borderRadius: '8px', padding: '2px' }}>
      {[{ id: 'rm', label: '1RM' }, { id: 'az', label: 'A-Z' }].map(o => {
        const active = sort === o.id
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: '4px 9px', borderRadius: '6px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
              background: active ? 'var(--c-surface)' : 'transparent',
              color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'color 150ms',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Every exercise ranked by best estimated 1RM. Flat rows (no card) with search,
// sort, and a top-N cap. Each row taps into /exercise/:name.
export default function AllLiftsModule({ data }) {
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

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title="Mis levantamientos"
        subtitle={`${lifts.length} ejercicios · mejor 1RM estimado`}
        right={<SortToggle sort={sort} onChange={setSort} />}
      />

      {showSearch && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="input-field"
          style={{ width: '100%', fontSize: '13px', marginBottom: '10px' }}
        />
      )}

      {shown.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '12px 0' }}>
          Ningún ejercicio coincide con «{query.trim()}».
        </p>
      ) : (
        <div>
          {shown.map((lift, i) => (
            <button
              key={lift.name}
              onClick={() => navigate(`/exercise/${encodeURIComponent(lift.name)}`)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 2px', textAlign: 'left', background: 'transparent',
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
              <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '15px', lineHeight: 1 }}>›</span>
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
