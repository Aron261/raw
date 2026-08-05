import { useEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_ENTER, SPRING_SETTLE } from '../lib/motion'
import { pressable } from '../lib/ui'
import { useLang } from '../hooks/useLang'
import { chimeEnabled, setChimeEnabled, primeChime, playChime } from '../lib/chime'

/*
 * El descanso entre series.
 *
 * Era una píldora flotante; en "Cuerpo" es una hoja que se apoya en el borde
 * de abajo y se empuja con el pulgar para quitarla. Es la misma pieza que la
 * maqueta de la dirección enseñaba y la única de su materialidad que no había
 * aterrizado.
 *
 * Lo que NO cambia respecto a la píldora, porque estaba bien resuelto:
 *
 * · El desmontaje lo dispara un temporizador de reloj, nunca un callback de
 *   fin de animación. La animación es cosmética y no puede tener la capacidad
 *   de dejar la hoja colgada en pantalla.
 * · onDismiss(restId) lleva el id para que el padre pueda ignorar un cierre
 *   tardío que llega cuando ya empezó otro descanso.
 * · Con prefers-reduced-motion no hay arrastre ni entrada: la cuenta atrás
 *   son números y no se pierde nada.
 *
 * El arrastre va en un envoltorio y la entrada/salida en el hijo: `drag` se
 * apropia del valor `y`, así que si los dos escriben en él la hoja se queda
 * parada donde la soltó el dedo en vez de salir.
 */
const RING_R = 22
const RING_C = 2 * Math.PI * RING_R

function fmt(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function RestTimerSheet({ restId, endsAt, total, onExtend, onDismiss }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const done = remaining === 0

  const leave = useCallback(() => {
    if (reduce) { onDismiss(restId); return }
    setExiting(true)
  }, [onDismiss, restId, reduce])

  // La salida dura ~200ms; el desmontaje va por reloj, no por la animación.
  useEffect(() => {
    if (!exiting) return
    const id = setTimeout(() => onDismiss(restId), 260)
    return () => clearTimeout(id)
  }, [exiting, onDismiss, restId])

  // Al llegar a cero: aviso, un momento de "Listo" y se va.
  //
  // La vibración sola no bastaba: navigator.vibrate no existe en iOS Safari,
  // así que en iPhone —con el móvil en el bolsillo o la pantalla apagada— el
  // fin del descanso no se notaba. El tono es el aviso que sí llega ahí.
  useEffect(() => {
    if (!done || exiting) return
    try { navigator.vibrate?.([150, 80, 150]) } catch {}
    playChime()
    const id = setTimeout(leave, 1800)
    return () => clearTimeout(id)
  }, [done, exiting, leave])

  const [sonido, setSonido] = useState(chimeEnabled)
  const alternarSonido = () => {
    const next = !sonido
    setChimeEnabled(next)
    setSonido(next)
    // Encenderlo ES un gesto: se aprovecha para desbloquear el audio, porque
    // si no iOS no dejaría sonar el descanso que ya está corriendo.
    if (next) primeChime()
  }

  const frac = total > 0 ? remaining / total : 0

  return (
    <motion.div
      // Envoltorio: posición y gesto. No anima opacidad ni entrada.
      drag={reduce || exiting ? false : 'y'}
      dragDirectionLock
      dragSnapToOrigin
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0.02, bottom: 0.5 }}
      onDragEnd={(e, info) => {
        if (info.offset.y > 56 || info.velocity.y > 480) leave()
      }}
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: 0,
        zIndex: 60,
        display: 'flex', justifyContent: 'center',
        padding: '0 12px',
        touchAction: 'none',
      }}
    >
      <motion.div
        role="timer"
        aria-label={done ? t('Descanso terminado') : t('Descanso en curso')}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 90 }}
        animate={
          exiting
            ? { opacity: 0, y: 90 }
            : reduce ? { opacity: 1 } : { opacity: 1, y: 0 }
        }
        transition={exiting ? SPRING_SETTLE : reduce ? { duration: 0.15 } : SPRING_ENTER}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--c-surface-glass)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--c-border-subtle)', borderBottom: 'none',
          borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
          boxShadow: 'var(--e-3)',
          padding: '10px 20px calc(18px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Asa. No es decorativa: dice que esto se puede empujar. */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '12px' }}>
          <span
            aria-hidden="true"
            style={{ width: '36px', height: '4px', borderRadius: '999px', background: 'var(--c-border)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
              letterSpacing: '-0.01em', color: done ? 'var(--c-success)' : 'var(--c-text-muted)',
            }}>
              {done ? t('Hecho') : t('Descanso')}
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700,
              letterSpacing: '-0.02em', lineHeight: 1.05, marginTop: '2px',
              color: done ? 'var(--c-success)' : 'var(--c-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(remaining)}
            </p>
          </div>

          {/* El anillo va en verde: es el color de "hecho/completo", no el
              acento — descansar no es una acción que haya que tomar. */}
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--c-surface-3)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r={RING_R} fill="none"
              stroke="var(--c-success)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - frac)}
              style={{ transition: reduce ? 'none' : 'stroke-dashoffset 260ms linear' }}
            />
          </svg>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {!done && (
            <button
              onClick={() => onExtend(30)}
              aria-label={t('Añadir 30 segundos de descanso')}
              style={{ ...sheetBtn, flex: 1 }}
              {...pressable(0.97)}
            >
              +30 s
            </button>
          )}
          <button
            onClick={leave}
            aria-label={t('Saltar descanso')}
            style={{ ...sheetBtn, flex: 1 }}
            {...pressable(0.97)}
          >
            {done ? t('Cerrar') : t('Saltar')}
          </button>

          {/* El interruptor vive aquí y no en Ajustes: es donde se descubre el
              sonido —justo después de oírlo— y donde se quiere apagar. */}
          <button
            onClick={alternarSonido}
            role="switch"
            aria-checked={sonido}
            aria-label={t('Sonido al terminar el descanso')}
            style={{ ...sheetBtn, flexShrink: 0, width: '44px', fontSize: '15px', color: sonido ? 'var(--c-text)' : 'var(--c-text-ghost)' }}
            {...pressable(0.97)}
          >
            <span aria-hidden="true">{sonido ? '🔔' : '🔕'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const sheetBtn = {
  minHeight: '44px',
  background: 'var(--c-surface-2)',
  border: '1px solid var(--c-border-subtle)',
  borderRadius: 'var(--r-md)',
  color: 'var(--c-text)',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '-0.015em',
  cursor: 'pointer',
}
