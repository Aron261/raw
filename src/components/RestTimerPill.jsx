import { useEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_POP } from '../lib/motion'
import { pressable } from '../lib/ui'
import { useLang } from '../hooks/useLang'

/*
 * The rest-timer pill — the floating control DESIGN.md reserves the
 * "floating-control lift" shadow for. Appears when a set is marked done,
 * counts the rest down in the bottom reach zone, vibrates at zero, and
 * dismisses itself. +30 extends; ✕ skips. The countdown is plain numbers,
 * so reduced-motion users lose nothing but the entrance spring.
 *

 * The exit runs through the same declarative `animate` prop as the entrance
 * (an `exiting` state flips the target); the unmount itself is driven by a
 * plain timeout, never by an animation-complete callback — the animation is
 * cosmetic and must not be able to strand the pill. `onDismiss(restId)`
 * carries the id so the parent can ignore a stale dismissal that lands after
 * a newer rest has started.
 */
const RING_R = 15
const RING_C = 2 * Math.PI * RING_R

function fmt(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function RestTimerPill({ restId, endsAt, total, onExtend, onDismiss }) {
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

  // The exit fade lasts 180ms; unmount shortly after on the wall clock.
  useEffect(() => {
    if (!exiting) return
    const id = setTimeout(() => onDismiss(restId), 240)
    return () => clearTimeout(id)
  }, [exiting, onDismiss, restId])

  // At zero: one vibration, hold a brief "Listo" state, then dismiss.
  useEffect(() => {
    if (!done || exiting) return
    try { navigator.vibrate?.([150, 80, 150]) } catch {}
    const id = setTimeout(leave, 1800)
    return () => clearTimeout(id)
  }, [done, exiting, leave])

  const frac = total > 0 ? remaining / total : 0

  return (
    <motion.div
      role="timer"
      aria-label={done ? 'Descanso terminado' : `Descanso: ${fmt(remaining)} restantes`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.92 }}
      animate={
        exiting
          ? { opacity: 0, y: 16, scale: 0.92 }
          : reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
      }
      transition={exiting ? { duration: 0.18, ease: 'easeIn' } : reduce ? { duration: 0.15 } : SPRING_POP}
      style={{
        position: 'fixed',
        left: '50%', x: '-50%',
        bottom: 'calc(env(safe-area-inset-bottom) + 196px)',
        zIndex: 60,
        display: 'flex', alignItems: 'center', gap: '4px',
        background: 'var(--c-bg-glass)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--c-border)',
        borderRadius: '999px',
        padding: '6px 8px 6px 10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
      }}
    >
      {/* Ring + countdown — success green, the "done/complete" state color */}
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={RING_R} fill="none" stroke="var(--c-surface-3)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={RING_R} fill="none"
          stroke="var(--c-success)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - frac)}
          style={{ transition: reduce ? 'none' : 'stroke-dashoffset 260ms linear' }}
        />
      </svg>

      <span style={{
        minWidth: '52px', textAlign: 'center',
        fontFamily: 'var(--font-mono)', fontSize: done ? '12px' : '17px', fontWeight: 700,
        letterSpacing: done ? '0.06em' : '0.02em', textTransform: done ? 'uppercase' : 'none',
        color: done ? 'var(--c-success)' : 'var(--c-text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {done ? 'Listo' : fmt(remaining)}
      </span>

      {!done && (
        <button
          onClick={() => onExtend(30)}
          aria-label="Añadir 30 segundos de descanso"
          style={{
            height: '44px', padding: '0 10px', flexShrink: 0,
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
            color: 'var(--c-text-dim)', background: 'transparent', borderRadius: '999px',
            transition: 'color 120ms',
          }}
          {...pressable(0.92, {
            onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-text)' },
            onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-dim)' },
          })}
        >
          +30
        </button>
      )}

      <button
        onClick={leave}
        aria-label="Saltar descanso"
        style={{
          width: '44px', height: '44px', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-text-ghost)', fontSize: '14px', lineHeight: 1,
          background: 'transparent', borderRadius: '999px',
          transition: 'color 120ms',
        }}
        {...pressable(0.92, {
          onMouseEnter: e => { e.currentTarget.style.color = 'var(--c-text)' },
          onMouseLeave: e => { e.currentTarget.style.color = 'var(--c-text-ghost)' },
        })}
      >
        ✕
      </button>
    </motion.div>
  )
}
