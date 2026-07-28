import { useEffect, useRef, useState } from 'react'
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
 * · Nunca es solo el gesto. Hay puntos tocables, flechas y las teclas ← →,
 *   porque una interfaz que solo se maneja deslizando no se puede manejar con
 *   teclado ni se descubre sola.
 *
 * · Con prefers-reduced-motion se apaga el arrastre entero y las cartas se
 *   cambian sin desplazamiento: el deslizamiento lateral es justo el tipo de
 *   movimiento que peor sienta a quien pide menos movimiento.
 */

// Más allá de esto los puntos dejan de ser legibles y pasan a ser textura.
const MAX_DOTS = 8

export default function ExerciseDeck({ items, index, onIndexChange, isDone, children }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  // +1 al avanzar, −1 al retroceder: decide desde qué lado entra la carta.
  const [dir, setDir] = useState(0)
  const viewportRef = useRef(null)

  const total = items.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const current = items[safeIndex]

  const go = (next) => {
    if (next < 0 || next > total - 1 || next === safeIndex) return
    setDir(next > safeIndex ? 1 : -1)
    onIndexChange(next)
  }

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
      go(safeIndex + (e.key === 'ArrowRight' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (total === 0) return null

  return (
    <div>
      {/* ── Índice: puntos tocables + flechas ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '14px' }}>
        <DeckArrow
          dir="prev"
          disabled={safeIndex === 0}
          onClick={() => go(safeIndex - 1)}
          label={t('Ejercicio anterior')}
        />

        {total <= MAX_DOTS ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {items.map((it, i) => {
              const active = i === safeIndex
              const done = isDone?.(it)
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t('Ejercicio {n} de {total}', { n: i + 1, total })}
                  aria-current={active ? 'true' : undefined}
                  style={{
                    // El objetivo táctil es de 32px aunque el punto mida 7:
                    // un blanco de 7px en la mano sudada no se acierta.
                    width: '20px', height: '32px', padding: 0, background: 'transparent',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block', height: '7px', borderRadius: '999px',
                      width: active ? '20px' : '7px',
                      background: active
                        ? 'var(--c-action)'
                        : done ? 'var(--c-success)' : 'var(--c-text-ghost)',
                      transition: reduce ? 'none' : 'width 260ms var(--ease-rise), background-color 200ms var(--ease-out)',
                    }}
                  />
                </button>
              )
            })}
          </div>
        ) : (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700,
            letterSpacing: '-0.01em', color: 'var(--c-text-dim)', fontVariantNumeric: 'tabular-nums',
            minWidth: '58px', textAlign: 'center',
          }}>
            {safeIndex + 1} / {total}
          </span>
        )}

        <DeckArrow
          dir="next"
          disabled={safeIndex === total - 1}
          onClick={() => go(safeIndex + 1)}
          label={t('Ejercicio siguiente')}
        />
      </div>

      {/* Un lector de pantalla no ve los puntos moverse. */}
      <p aria-live="polite" className="sr-only">
        {t('Ejercicio {n} de {total}', { n: safeIndex + 1, total })}
      </p>

      {/* ── Carta ─────────────────────────────────────────────────────── */}
      <div ref={viewportRef} style={{ position: 'relative' }}>
        {/* La carta siguiente asoma por detrás: dice que hay más baraja sin
            enseñar contenido que todavía no toca. */}
        {safeIndex < total - 1 && (
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
            go(safeIndex + (info.offset.x < 0 ? 1 : -1))
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
            <motion.div
              key={current.id}
              initial={reduce ? { opacity: 0 } : { x: dir >= 0 ? '88%' : '-88%', opacity: 0.3 }}
              animate={{ x: 0, opacity: 1 }}
              transition={reduce ? { duration: 0.12 } : SPRING_DECK}
            >
              {children(current, safeIndex)}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function DeckArrow({ dir, disabled, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '999px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
        boxShadow: disabled ? 'none' : 'var(--e-1)',
        color: disabled ? 'var(--c-text-ghost)' : 'var(--c-text-dim)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'opacity 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}
