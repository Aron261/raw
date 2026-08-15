import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeader from './SectionHeader'
import Segmented from './Segmented'
import { useLang } from '../../hooks/useLang'
import { clampLines } from '../../lib/ui'

// Progresión — en qué estás subiendo y en qué llevas parado.
//
// La app tenía la gráfica de 1RM de UN ejercicio (en su ficha) y el mejor
// levantamiento de siempre, pero nunca la lista: "subiendo en sentadilla y
// remo, parado en press banca desde hace ocho semanas". Esa es la frase que
// hace que cambies algo, y era la única que no se podía leer en ningún sitio.
//
// Compara el mejor 1RM estimado de las últimas 8 semanas contra el de las 8
// anteriores. Solo aparecen los ejercicios con marca en las dos ventanas: uno
// que empezaste el mes pasado no está subiendo, es que no tiene con qué
// compararse.

const CAP = 5
const FILTERS = [
  { id: 'up',   label: 'Subiendo' },
  { id: 'flat', label: 'Parados' },
]

const TONE = {
  up:   { sign: '▲', color: 'var(--c-success)' },
  down: { sign: '▼', color: 'var(--c-action-text)' },
  flat: { sign: '=', color: 'var(--c-text-dim)' },
}

export default function ProgressionModule({ data, readOnly = false }) {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('up')
  const [expanded, setExpanded] = useState(false)

  const all = data?.progression || []

  // «Parados» junta lo que no se movió y lo que bajó: las dos cosas piden
  // atención, y separarlas en tres pestañas obligaría a mirar dos veces para
  // enterarte de lo mismo. Lo que más ha bajado va primero.
  const list = useMemo(() => {
    if (filter === 'up') return all.filter(x => x.status === 'up')
    return all.filter(x => x.status !== 'up').slice().reverse()
  }, [all, filter])

  // Sin dos ventanas que comparar no hay módulo. No es un vacío que llenar con
  // una tarjeta: es que todavía no ha pasado suficiente tiempo.
  if (all.length === 0) {
    return (
      <section style={{ marginBottom: '40px' }}>
        <SectionHeader title={t('Progresión')} />
        <div style={{ textAlign: 'center', padding: '28px 20px', border: '1px dashed var(--c-border-subtle)', borderRadius: 'var(--r-md)' }}>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 500, lineHeight: 1.5, maxWidth: '34ch', margin: '0 auto' }}>
            {t('Cuando repitas un ejercicio a lo largo de varios meses, aquí verás en cuáles subes y en cuáles te has quedado parado.')}
          </p>
        </div>
      </section>
    )
  }

  const shown = expanded ? list : list.slice(0, CAP)
  const openLift = readOnly ? undefined : (name) => navigate(`/exercise/${encodeURIComponent(name)}`)

  return (
    <section style={{ marginBottom: '40px' }}>
      <SectionHeader
        title={t('Progresión')}
        subtitle={t('Mejor 1RM de las últimas 8 semanas vs. las 8 anteriores.')}
        right={<Segmented options={FILTERS.map(f => ({ ...f, label: t(f.label) }))} value={filter} onChange={setFilter} ariaLabel={t('Filtro de progresión')} />}
      />

      {shown.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 500, padding: '14px 0', lineHeight: 1.5 }}>
          {filter === 'up'
            ? t('Ningún ejercicio subió en este periodo.')
            : t('Ningún ejercicio se quedó parado. Todo lo que repites está subiendo.')}
        </p>
      ) : (
        <div>
          {shown.map((x, i) => {
            const tone = TONE[x.status]
            return (
              <button
                key={x.name}
                onClick={openLift ? () => openLift(x.name) : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 2px', textAlign: 'left', background: 'transparent',
                  cursor: readOnly ? 'default' : 'pointer',
                  borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', ...clampLines(2) }}>
                    {x.name}
                  </span>
                  <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 500, marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                    {x.prior1RM} → {x.recent1RM} {x.unit}
                    {x.daysSince != null && x.daysSince > 21 && (
                      <> · {t('sin tocarlo hace {n} días', { n: x.daysSince })}</>
                    )}
                  </span>
                </div>
                {/* El signo acompaña al color: en el gimnasio, con sol de
                    frente, el verde y el azul no siempre se distinguen. */}
                <span style={{ flexShrink: 0, color: tone.color, fontWeight: 800, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                  {tone.sign} {x.deltaPct > 0 ? '+' : ''}{x.deltaPct}%
                </span>
                {!readOnly && <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-ghost)', fontSize: '15px', lineHeight: 1 }}>›</span>}
              </button>
            )
          })}
        </div>
      )}

      {list.length > CAP && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontFamily: 'var(--font-sans)', color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          {expanded ? t('Ver menos') : `${t('Ver todos')} (${list.length})`}
          <span aria-hidden="true" style={{ fontSize: '13px' }}>{expanded ? '↑' : '↓'}</span>
        </button>
      )}
    </section>
  )
}
