import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_DECK } from '../lib/motion'
import { useLang } from '../hooks/useLang'

/*
 * La baraja de ejercicios.
 *
 * Un ejercicio por pantalla, se pasa con el pulgar. La sesión sigue siendo la
 * misma lista —el orden no cambia al pasar— pero solo hay una carta delante:
 * entre serie y serie no se está eligiendo ejercicio, se está haciendo uno.
 *
 * Decisiones que no son obvias:
 *
 * · Solo se monta la carta visible. Montar las seis y moverlas con transform
 *   sería más "carrusel", pero cada ExerciseRow arrastra sus propios hooks de
 *   historial y récords: seis a la vez es seis veces el trabajo para enseñar
 *   una.
 *
 * · El arrastre no cambia el índice a mitad de gesto. Decide al soltar, por
 *   recorrido O por velocidad, para que un golpe rápido y corto cuente igual
 *   que uno lento y largo.
 *
 * · El recorrido es circular. Del último se pasa a la carta de cierre y de ahí
 *   al primero otra vez, así que nunca hay un extremo donde el gesto no hace
 *   nada. La carta de cierre es la que evita que dar la vuelta se sienta como
 *   haberse perdido: es un sitio, no un salto.
 *
 * · La regleta de arriba no se desplaza: los tramos se reparten el ancho, así
 *   que la sesión entera cabe siempre y se puede barrer de la primera a la
 *   última con un solo movimiento del pulgar. Una regleta con scroll propio
 *   pelearía con ese mismo gesto.
 *
 * · Los tramos miden todos igual y el activo crece de alto, no de ancho. Si el
 *   activo se ensanchara, la posición de cada tramo cambiaría según dónde estás
 *   y arrastrar dejaría de caer donde apunta el dedo.
 *
 * · Nunca es solo el gesto. Hay regleta, flechas y las teclas ← →, porque una
 *   interfaz que solo se maneja deslizando no se puede manejar con teclado ni
 *   se descubre sola.
 *
 * · Con prefers-reduced-motion se apaga el arrastre entero y las cartas se
 *   cambian sin desplazamiento: el deslizamiento lateral es justo el tipo de
 *   movimiento que peor sienta a quien pide menos movimiento.
 */

// La parada final: ni un ejercicio ni un hueco en blanco, una carta con lo que
// llevas y la salida del entreno.
export const END_KEY = '__end__'

export default function ExerciseDeck({
  stops,          // [{ key, kind: 'exercise' | 'end' }] — lo que se puede pasar
  rail,           // [{ key, kind, label, done, groupId }] — el índice completo
  currentKey,
  onCurrentChange,
  children,       // (stop, index) => ReactNode
}) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  // +1 al avanzar, −1 al retroceder: decide desde qué lado entra la carta.
  const [dir, setDir] = useState(0)
  const viewportRef = useRef(null)
  const railRef = useRef(null)
  // Índice bajo el dedo mientras se barre la regleta (null = no se está barriendo).
  const [scrubAt, setScrubAt] = useState(null)
  const [showDone, setShowDone] = useState(false)

  const total = stops.length
  const index = Math.max(0, stops.findIndex(s => s.key === currentKey))
  const current = stops[index]

  const railIndex = rail.findIndex(r => r.key === currentKey)
  const doneItems = rail.filter(r => r.done)

  // Saltar a una parada de la regleta. La regleta enseña más cosas que la
  // baraja —los ejercicios ya hechos siguen ahí— así que se navega por clave,
  // no por índice de baraja.
  const jumpRail = useCallback((i) => {
    const item = rail[i]
    if (!item || item.key === currentKey) return
    setDir(railIndex >= 0 && i < railIndex ? -1 : 1)
    onCurrentChange(item.key)
  }, [rail, railIndex, currentKey, onCurrentChange])

  // Un paso de baraja, dando la vuelta por los dos extremos.
  const step = useCallback((delta) => {
    if (!total) return
    const next = (((index + delta) % total) + total) % total
    const target = stops[next]
    if (!target || target.key === currentKey) return
    setDir(delta > 0 ? 1 : -1)
    onCurrentChange(target.key)
  }, [stops, total, index, currentKey, onCurrentChange])

  // ← / → mueven la baraja cuando el foco está dentro y no se está escribiendo.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!el.contains(document.activeElement)) return
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Barrido de la regleta ──────────────────────────────────────────────
     El dedo cae en un punto del ancho y ese punto ES el tramo: no hace falta
     acertarle a un blanco de 7px, basta con estar sobre su franja. Arrastrando
     se recorre la sesión entera de una pasada. */
  const indexFromX = (clientX) => {
    const el = railRef.current
    if (!el || !rail.length) return 0
    const r = el.getBoundingClientRect()
    const p = (clientX - r.left) / Math.max(r.width, 1)
    return Math.min(rail.length - 1, Math.max(0, Math.floor(p * rail.length)))
  }

  const onRailPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const i = indexFromX(e.clientX)
    setScrubAt(i)
    jumpRail(i)
    try { railRef.current?.setPointerCapture?.(e.pointerId) } catch {}
  }
  const onRailPointerMove = (e) => {
    if (scrubAt === null) return
    const i = indexFromX(e.clientX)
    if (i !== scrubAt) { setScrubAt(i); jumpRail(i) }
  }
  const endScrub = (e) => {
    if (scrubAt === null) return
    setScrubAt(null)
    try { railRef.current?.releasePointerCapture?.(e?.pointerId) } catch {}
  }

  if (total === 0) return null

  const scrubLabel = scrubAt !== null ? rail[scrubAt]?.label : null

  return (
    <div>
      {/* ── Índice: regleta barrible + flechas ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <DeckArrow dir="prev" onClick={() => step(-1)} label={t('Ejercicio anterior')} />

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* El nombre bajo el dedo. Sin él se barre a ciegas: los tramos no
              dicen cuál es cuál, solo cuántos faltan. */}
          {scrubLabel && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', bottom: 'calc(100% - 2px)',
                left: `${((scrubAt + 0.5) / rail.length) * 100}%`,
                transform: 'translateX(-50%)',
                maxWidth: '92%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                background: 'var(--c-text)', color: 'var(--c-bg)',
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 800, letterSpacing: '-0.01em',
                padding: '5px 9px', borderRadius: 'var(--r-xs)', boxShadow: 'var(--e-2)',
                pointerEvents: 'none', zIndex: 5,
              }}
            >
              {scrubLabel}
            </div>
          )}

          <div
            ref={railRef}
            onPointerDown={onRailPointerDown}
            onPointerMove={onRailPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              // El barrido es horizontal; el navegador se queda con el vertical
              // para que empezar sobre la regleta no bloquee el scroll de página.
              touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
            }}
          >
            {rail.map((item, i) => {
              const active = item.key === currentKey
              const isEnd = item.kind === 'end'
              // Los miembros de una superserie van unidos por una barra: la
              // pareja se ve en el índice sin tener que abrir nada.
              const linkedNext = !!item.groupId && rail[i + 1]?.groupId === item.groupId
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpRail(i)}
                  aria-label={isEnd ? t('Fin del recorrido') : item.label}
                  aria-current={active ? 'true' : undefined}
                  style={{
                    position: 'relative', padding: 0, background: 'transparent',
                    // El objetivo táctil es de 34px de alto aunque el tramo mida 7:
                    // un blanco de 7px en la mano sudada no se acierta.
                    height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    // Reparto a partes iguales: la sesión entera cabe siempre y
                    // cada tramo ocupa la misma franja, que es lo que hace que
                    // arrastrar caiga donde apunta el dedo.
                    flex: isEnd ? '0 0 18px' : '1 1 0', minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block', width: '100%', borderRadius: '999px',
                      height: active ? '11px' : '7px',
                      background: isEnd
                        ? (active ? 'var(--c-action)' : 'var(--c-text-ghost)')
                        : active ? 'var(--c-action)'
                        : item.done ? 'var(--c-success)' : 'var(--c-text-ghost)',
                      opacity: isEnd && !active ? 0.55 : 1,
                      transition: reduce ? 'none' : 'height 160ms var(--ease-rise), background-color 200ms var(--ease-out)',
                    }}
                  />
                  {linkedNext && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute', bottom: '4px', left: '50%', width: 'calc(100% + 3px)',
                        height: '2px', borderRadius: '999px', background: 'var(--c-data)', opacity: 0.75,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <DeckArrow dir="next" onClick={() => step(1)} label={t('Ejercicio siguiente')} />
      </div>

      {/* Los hechos salen de la baraja, no de la sesión. Aquí están por nombre
          —el color verde de un tramo dice que algo se hizo, no cuál. */}
      {doneItems.length > 0 ? (
        <div style={{ marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setShowDone(s => !s)}
            aria-expanded={showDone}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 0',
              background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '-0.01em', color: 'var(--c-text-dim)',
            }}
          >
            <span style={{ color: 'var(--c-success)' }}>✓</span>
            {doneItems.length} {t(doneItems.length === 1 ? 'hecho' : 'hechos')}
            <span className={`chevron ${showDone ? 'open' : ''}`} style={{ fontSize: '9px', color: 'var(--c-text-ghost)' }}>▼</span>
          </button>

          {showDone && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {doneItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpRail(rail.findIndex(r => r.key === item.key))}
                  style={{
                    fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
                    color: 'var(--c-text-dim)', background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-subtle)', borderRadius: 'var(--r-xs)',
                    padding: '5px 9px', cursor: 'pointer', maxWidth: '100%',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: '8px' }} />
      )}

      {/* Un lector de pantalla no ve moverse la regleta. */}
      <p aria-live="polite" className="sr-only">
        {current?.kind === 'end'
          ? t('Fin del recorrido')
          : t('Ejercicio {n} de {total}', { n: index + 1, total: Math.max(total - 1, 1) })}
      </p>

      {/* ── Carta ─────────────────────────────────────────────────────── */}
      <div ref={viewportRef} style={{ position: 'relative' }}>
        {/* La carta siguiente asoma por detrás: dice que hay más baraja sin
            enseñar contenido que todavía no toca. Con más de una parada
            siempre hay siguiente —el recorrido da la vuelta. */}
        {total > 1 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', left: '14px', right: '14px', top: '-8px', height: '80px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
              borderRadius: 'var(--r-xl)', boxShadow: 'var(--e-1)', opacity: 0.75, zIndex: 0,
            }}
          />
        )}

        {/* Dos capas a propósito. El arrastre y la transición de entrada/salida
            querrían escribir los dos en la misma `x`: `drag` se apropia de ese
            valor y la carta nueva se quedaba parada en el desplazamiento del
            gesto en vez de entrar. Así el envoltorio se ocupa del dedo (y
            vuelve solo a su sitio) y la carta de dentro, de aparecer. */}
        <motion.div
          drag={reduce ? false : 'x'}
          dragDirectionLock
          dragSnapToOrigin
          dragElastic={0.16}
          onDragEnd={(e, info) => {
            const far  = Math.abs(info.offset.x) > 72
            const fast = Math.abs(info.velocity.x) > 420
            if (!far && !fast) return
            step(info.offset.x < 0 ? 1 : -1)
          }}
          // El arrastre horizontal no debe robarle el scroll vertical a la
          // página: el pulgar sube y baja mucho más de lo que cruza.
          style={{ position: 'relative', zIndex: 1, touchAction: 'pan-y' }}
        >
          {/* Solo entrada, sin AnimatePresence. La carta que se va no se anima:
              React la desmonta y la nueva entra desde el lado correcto.
              Coreografiar también la salida obliga a mantener las dos montadas
              a la vez, y ExerciseRow monta un portal (el menú ···) que deja la
              salida sin terminar — la carta vieja se quedaba clavada a medio
              camino y la nueva no llegaba nunca. Un solo tramo, además, es la
              mitad de espera entre ejercicio y ejercicio. */}
          <div style={{ overflow: 'hidden' }}>
            {/* Barriendo la regleta la carta NO se desliza. Un barrido cruza
                diez tramos en medio segundo, y diez entradas laterales
                encadenadas es un tembleque: ahí la carta es el resultado de
                dónde está el dedo, no un sitio al que se acaba de llegar. */}
            <motion.div
              key={current?.key}
              initial={reduce || scrubAt !== null ? { opacity: 0.4 } : { x: dir >= 0 ? '88%' : '-88%', opacity: 0.3 }}
              animate={{ x: 0, opacity: 1 }}
              transition={reduce || scrubAt !== null ? { duration: 0.09 } : SPRING_DECK}
            >
              {current && children(current, index)}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function DeckArrow({ dir, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '999px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
        boxShadow: 'var(--e-1)', color: 'var(--c-text-dim)', cursor: 'pointer',
        transition: 'box-shadow 160ms var(--ease-out)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}
