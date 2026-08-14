import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'motion/react'
import { SPRING_ENTER, SPRING_POP, EASE_POP_KEYFRAMES, POP_DURATION, FADE } from '../lib/motion'

// Landing pública — lo único que ve un visitante sin sesión en "/".
//
// Copy local a propósito: i18n.js lo está tocando otra sesión y esta página
// es es-CO de nacimiento; si algún día la landing se traduce, se migra entera.
//
// Dirección: la landing se compromete con el grafito (data-theme="dark" en el
// wrapper, permiso de marca — la app conserva sus dos modos). La pieza
// central es el HERO INTERACTIVO: la cifra se puede tocar y responde como
// responde la app — el número rueda, y al superar la última sesión el PR se
// marca en vivo. Después, un riel horizontal —entreno, calendario, nutrición,
// estadísticas— donde cada frase va sostenida por la pantalla de la app que
// la prueba, y la banda del coach con el entrenador de fondo.
// Movimiento con motion/react (ya en el bundle; la CSP de vercel.json no
// admite scripts externos) y todo tiene salida por prefers-reduced-motion.
//
// El <style> es legal: style-src 'unsafe-inline' está en la CSP y los media
// queries no se pueden escribir en un atributo style.

const MAILTO = 'mailto:pedroescobarconvers@hotmail.com?subject=Quiero%20probar%20Raw'

// ── Estilos de página ──────────────────────────────────────────────────────

const CSS = `
  .ld-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Bandas: tres materiales, cortes duros ──
     Grafito (hero) → azul de acción (el riel de secciones) → hueso (coach)
     → grafito (cierre). Cada banda fija su tema; el azul va con claro
     para que --c-action sea el azul hondo, no el de noche. Ningún fondo es
     plano: cada banda es un degradado TONAL de su propio material — pasos
     del mismo color, no colores nuevos (los del azul son la rampa del
     acento, como --c-data-2/3; los del hueso son surface-2/bg/surface-3). */
  .ld-band-dark {
    background:
      radial-gradient(58% 42% at 50% 0%, rgba(127, 160, 234, 0.09), transparent 72%),
      linear-gradient(180deg, #17181D 0%, var(--c-bg) 55%, #0E0F12 100%);
  }
  .ld-band-blue {
    background:
      radial-gradient(70% 55% at 50% 42%, rgba(255, 255, 255, 0.07), transparent 75%),
      linear-gradient(172deg, #1D3C77 0%, var(--c-action) 52%, #3E69C4 100%);
  }
  .ld-band-light {
    background: linear-gradient(180deg, var(--c-surface-2) 0%, var(--c-bg) 42%, var(--c-surface-3) 100%);
  }

  /* ── La foto del hero: el gym detrás del grafito ──
     Tres capas: la foto, un scrim que la funde con la banda (transparente
     arriba, grafito sólido al llegar al marquee) y el contenido. */
  .ld-band-hero { position: relative; overflow: hidden; }
  .ld-hero-photo {
    position: absolute; inset: 0;
  }
  .ld-hero-photo img {
    width: 100%; height: 100%; object-fit: cover; object-position: center 30%;
  }
  .ld-hero-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg,
      rgba(18, 19, 22, 0.82) 0%,
      rgba(18, 19, 22, 0.66) 34%,
      rgba(18, 19, 22, 0.88) 68%,
      #121316 92%);
  }
  .ld-band-hero > .ld-wrap, .ld-band-hero > .ld-marquee { position: relative; }

  .ld-nav {
    display: flex; justify-content: space-between; align-items: center;
    padding: 22px 0 12px;
  }

  .ld-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 52px; padding: 14px 28px; border-radius: var(--r-lg);
    font-size: 15px; font-weight: 800; letter-spacing: -0.01em; text-decoration: none;
  }
  .ld-btn-primary { background: var(--c-action); color: var(--c-on-action); box-shadow: var(--e-1); }
  .ld-btn-ghost { color: var(--c-action-text); border: 1px solid var(--c-action-border); background: transparent; }
  .ld-btn-sm { min-height: 44px; padding: 10px 18px; font-size: 13px; }

  /* ── Hero interactivo ── */
  .ld-hero {
    min-height: calc(100dvh - 90px); display: flex; flex-direction: column;
    justify-content: center; text-align: center;
    padding: clamp(24px, 5vh, 56px) 0 clamp(40px, 7vh, 64px);
  }
  .ld-kicker { color: var(--c-text-muted); font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
  .ld-h1 {
    font-size: clamp(44px, 6.6vw, 84px);
    color: var(--c-text); line-height: 0.98; text-wrap: balance; margin-top: 14px;
  }
  .ld-lift { margin-top: clamp(28px, 6vh, 56px); }
  .ld-lift-name { color: var(--c-text-secondary); font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
  .ld-lift-figure {
    display: flex; align-items: baseline; justify-content: center; gap: 0.08em;
    color: var(--c-text); font-weight: 900; letter-spacing: -0.045em; line-height: 0.85;
    font-size: clamp(72px, 13vw, 168px); margin-top: 10px;
  }
  .ld-lift-figure .ld-kg { overflow: hidden; display: inline-flex; }
  .ld-lift-unit { font-size: 0.36em; letter-spacing: -0.02em; color: var(--c-text-dim); }
  .ld-plate {
    width: 74px; height: 74px; border-radius: var(--r-pill);
    background: var(--c-action); color: var(--c-on-action);
    font-family: var(--font-sans); font-size: 17px; font-weight: 800; letter-spacing: -0.01em;
    border: none; cursor: pointer; box-shadow: var(--e-2);
  }
  .ld-plate:disabled { opacity: 0.45; cursor: default; }
  .ld-lift-cta { color: var(--c-text-muted); font-size: 12.5px; font-weight: 700; margin-top: 12px; }
  .ld-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: clamp(28px, 5vh, 44px); justify-content: center; }
  .ld-note { color: var(--c-text-muted); font-size: 12.5px; font-weight: 700; margin-top: 14px; }

  /* ── Marquee ── */
  .ld-marquee { overflow: hidden; padding: clamp(28px, 5vh, 56px) 0; }
  .ld-marquee-inner {
    display: flex; gap: 56px; white-space: nowrap; width: max-content;
    font-family: var(--font-sans); font-weight: 900;
    font-size: clamp(56px, 8vw, 110px); letter-spacing: -0.04em; line-height: 1;
    color: var(--c-surface-3);
  }

  /* ── Riel horizontal: las secciones de la app, una por tramo ──
     En escritorio el bloque se ancla y el riel corre en X con el scroll
     vertical; en móvil es un carrusel nativo que se desliza con el pulgar. */
  /* La altura la pone el JSX: una pantalla de recorrido por tramo (+1 para
     que el primero y el último se lean quietos). */
  .ld-rail-track { position: relative; }
  .ld-rail-sticky {
    position: sticky; top: 0; height: 100dvh;
    display: flex; align-items: center; overflow: hidden;
  }
  .ld-rail { display: flex; align-items: center; will-change: transform; }
  .ld-slide {
    width: 100vw; flex: none;
    display: grid; grid-template-columns: 1fr 1fr; align-items: center;
    gap: clamp(32px, 5vw, 80px);
    /* Alinea con el contenedor de 1120px de las demás bandas. */
    padding: 0 max(24px, calc((100vw - 1120px) / 2));
  }
  .ld-slide-media { display: flex; justify-content: center; }
  /* Pantallas bajas: el teléfono cede antes que el titular. */
  @media (min-width: 861px) and (max-height: 820px) {
    .ld-slide-media { transform: scale(0.84); }
  }
  .ld-slide-kicker {
    color: rgba(255, 255, 255, 0.72); font-size: 12.5px; font-weight: 800;
    letter-spacing: -0.01em; margin-bottom: 12px;
  }
  .ld-slide h2 {
    font-size: clamp(32px, 4.4vw, 60px); color: var(--c-on-action);
    line-height: 0.99; text-wrap: balance;
  }
  .ld-slide p {
    color: rgba(255, 255, 255, 0.86); font-size: clamp(15px, 1.3vw, 17px);
    font-weight: 500; line-height: 1.6; margin-top: 18px; max-width: 40ch;
  }
  /* Cuenta de avance: tres trazos, el activo encendido. */
  .ld-rail-ticks {
    position: absolute; left: 0; right: 0; bottom: clamp(24px, 5vh, 52px);
    display: flex; justify-content: center; gap: 10px;
  }
  .ld-tick {
    width: 46px; height: 3px; border-radius: var(--r-pill);
    background: rgba(255, 255, 255, 0.28);
  }
  .ld-tick-on { background: var(--c-on-action); }

  /* Móvil: carrusel nativo con snap. */
  .ld-rail-swipe {
    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
    padding: clamp(48px, 9vh, 80px) 0; scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .ld-rail-swipe::-webkit-scrollbar { display: none; }
  .ld-rail-swipe .ld-slide {
    scroll-snap-align: center; grid-template-columns: 1fr;
    gap: 28px; padding: 0 20px;
    /* Menos de un ancho completo: el borde del siguiente asoma y así se ve
       que esto se desliza, sin tener que dibujar una flecha. */
    width: 88vw;
  }
  .ld-rail-swipe .ld-slide:first-child { margin-left: 4vw; }
  .ld-rail-swipe .ld-slide:last-child { margin-right: 4vw; }

  /* La foto que le da fondo a la banda azul: textura, no protagonista. */
  .ld-blue-photo { position: absolute; inset: 0; overflow: hidden; }
  .ld-blue-photo img {
    width: 100%; height: 100%; object-fit: cover;
    opacity: 0.16; mix-blend-mode: luminosity;
  }
  .ld-blue-veil {
    position: absolute; inset: 0;
    background:
      radial-gradient(75% 50% at 50% 50%, rgba(29, 60, 119, 0.55), transparent 78%),
      linear-gradient(180deg, #1D3C77 0%, transparent 22%, transparent 78%, #1D3C77 100%);
  }

  /* ── Coach: la banda hueso, con el entrenador de fondo ──
     La foto cruza la banda entera; el velo la deja abierta a la derecha
     (donde flota la tarjeta) y sólida a la izquierda, que es donde se lee. */
  .ld-band-coach { position: relative; overflow: hidden; }
  .ld-coach-photo { position: absolute; inset: 0; }
  .ld-coach-photo img {
    width: 100%; height: 100%; object-fit: cover; object-position: 72% center;
  }
  .ld-coach-veil {
    position: absolute; inset: 0;
    background:
      linear-gradient(96deg,
        var(--c-bg) 0%, var(--c-bg) 30%,
        rgba(231, 231, 228, 0.90) 48%,
        rgba(231, 231, 228, 0.58) 72%,
        rgba(231, 231, 228, 0.42) 100%),
      linear-gradient(180deg, var(--c-bg) 0%, transparent 26%, transparent 72%, var(--c-bg) 100%);
  }
  .ld-coach {
    position: relative;
    display: grid; grid-template-columns: 1fr 1fr; gap: clamp(28px, 5vw, 72px);
    align-items: center; padding: clamp(72px, 13vh, 150px) 0;
  }
  .ld-coach-kicker {
    color: var(--c-text-dim); font-size: 12.5px; font-weight: 800;
    letter-spacing: -0.01em; margin-bottom: 12px;
  }
  @media (max-width: 860px) {
    .ld-coach { grid-template-columns: 1fr; }
    /* En vertical la foto queda detrás de todo: el velo sube a casi opaco
       para que el texto no pelee con ella. */
    .ld-coach-veil {
      background:
        linear-gradient(180deg,
          var(--c-bg) 0%, rgba(231, 231, 228, 0.92) 34%,
          rgba(231, 231, 228, 0.74) 68%, var(--c-bg) 100%);
    }
  }

  /* ── Cierre ── */
  .ld-final { text-align: center; padding: clamp(64px, 12vh, 140px) 0; }
  .ld-h2 {
    font-size: clamp(34px, 4.6vw, 64px); color: var(--c-text);
    line-height: 1.02; text-wrap: balance;
  }

  .ld-footer { border-top: 1px solid var(--c-border-subtle); padding: 28px 0 48px; }
`

// ── Hero interactivo ───────────────────────────────────────────────────────

// La última sesión del visitante imaginario. Todo lo que supere esto es PR.
const LAST_SESSION = 100
const MAX_EXTRA = 10

function formatKg(kg) {
  return kg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

// La cifra que se entrena: cada toque añade 2,5 kg, el número rueda como una
// pila de discos y el PR se marca en el momento en que la cifra lo es.
function LiftHero({ reduce }) {
  const [kg, setKg] = useState(LAST_SESSION)
  const maxed = kg >= LAST_SESSION + MAX_EXTRA
  const isPr = kg > LAST_SESSION

  return (
    <div className="ld-lift">
      <p className="ld-lift-name">Press de banca · tu última sesión: 100 kg × 8</p>

      <p className="ld-lift-figure tnum" aria-live="polite">
        <span className="ld-kg">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={kg}
              initial={reduce ? { opacity: 0 } : { y: '0.9em', opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: '-0.9em', opacity: 0 }}
              transition={reduce ? FADE : SPRING_POP}
              style={{ display: 'inline-block' }}
            >
              {formatKg(kg)}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="ld-lift-unit">kg × 8</span>
      </p>

      <div style={{ minHeight: '30px', marginTop: '14px' }}>
        {isPr && (
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={reduce ? FADE : { duration: POP_DURATION, ease: EASE_POP_KEYFRAMES }}
            className="tnum"
            style={{ color: 'var(--c-action-text)', fontSize: '15px', fontWeight: 800 }}
          >
            ▲ +{formatKg(kg - LAST_SESSION)} kg vs. la última sesión · PR
          </motion.p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <motion.button
          type="button"
          className="ld-plate tnum"
          disabled={maxed}
          onClick={() => setKg(k => Math.min(k + 2.5, LAST_SESSION + MAX_EXTRA))}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          aria-label="Añadir 2,5 kilos"
        >
          +2,5
        </motion.button>
      </div>
      <p className="ld-lift-cta">
        {maxed ? 'El resto se gana en el gym.' : 'Tócalo. Así se registra en Raw.'}
      </p>
    </div>
  )
}

// ── Los tres paneles: una frase y la pantalla que la sostiene ──────────────

// El chasis. Dentro va una pantalla de la app en modo claro: fondo hueso,
// tarjetas blancas — exactamente lo que se ve en el teléfono.
function PhoneFrame({ children }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 'min(310px, 100%)', borderRadius: '42px', background: 'var(--c-bg)',
        border: '1px solid var(--c-border)', boxShadow: 'var(--e-3)', padding: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 10px 12px' }}>
        {children}
      </div>
    </div>
  )
}

function ScreenHead({ title, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 2px' }}>
      <span style={{ fontWeight: 900, fontSize: '19px', letterSpacing: '-0.03em', color: 'var(--c-text)' }}>{title}</span>
      <span style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700 }}>{right}</span>
    </div>
  )
}

const card = { background: 'var(--c-surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--e-1)', padding: '14px' }

// ── Pantalla 1 · Entreno ──
function ScreenEntreno() {
  const timer = useRestTimer()
  const field = {
    flex: 1, background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)',
    boxShadow: 'inset 0 1px 2px rgba(22,24,27,.05)', padding: '9px 11px 7px',
  }
  const done = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px' }
  return (
    <>
      <ScreenHead title="Press de banca" right="Serie 3 de 4" />
      <div style={{ ...card, padding: 0 }}>
        <div style={{ ...done, borderBottom: '1px solid var(--c-border-subtle)' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>Serie 1</span>
          <span className="tnum" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--c-text)' }}>100 × 8</span>
          <span style={{ color: 'var(--c-success)', fontWeight: 800, fontSize: '12.5px' }}>✓</span>
        </div>
        <div style={done}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>Serie 2</span>
          <span className="tnum" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--c-text)' }}>100 × 8</span>
          <span style={{ color: 'var(--c-success)', fontWeight: 800, fontSize: '12.5px' }}>✓</span>
        </div>
      </div>
      <div style={{ ...card, boxShadow: 'var(--e-2)' }}>
        <div style={{ display: 'flex', gap: '9px' }}>
          <div style={field}>
            <div style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700 }}>Peso (kg)</div>
            <div className="tnum" style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text)', marginTop: '2px' }}>102,5</div>
          </div>
          <div style={field}>
            <div style={{ color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700 }}>Reps</div>
            {/* La última sesión, en fantasma bajo el dedo. */}
            <div className="tnum" style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text-ghost)', marginTop: '2px' }}>8</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '11px' }}>
          <span className="tnum" style={{ color: 'var(--c-action-text)', fontSize: '12.5px', fontWeight: 800 }}>▲ +2,5 kg</span>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '10.5px', fontWeight: 700 }}>vs. la última sesión · PR</span>
        </div>
      </div>
      <div style={{
        background: 'var(--c-action)', color: 'var(--c-on-action)', textAlign: 'center',
        borderRadius: 'var(--r-lg)', padding: '13px', fontWeight: 800, fontSize: '14px',
        boxShadow: 'var(--e-1)', letterSpacing: '-0.01em',
      }}>
        Guardar serie
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '7px', color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700 }}>
        Descanso <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--c-text-secondary)' }}>{timer}</span>
      </div>
    </>
  )
}

// ── Pantalla 2 · Calendario ──
// La capa de planificación: el ciclo proyectado sobre los días en que de
// verdad se entrena. Lo hecho va sólido; lo previsto, en línea discontinua
// (el mismo fantasma que dibuja projectCycle en la app).
function ScreenCalendario() {
  // Lun→Dom. 'done' cumplido, 'plan' proyectado, null día suelto. Tres
  // hechos y uno previsto: eso es lo que dice el 3/4 de la adherencia.
  const week = [
    ['L', 'done'], ['M', null], ['M', 'done'], ['J', null],
    ['V', 'done'], ['S', 'plan'], ['D', null],
  ]
  const rowBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', fontSize: '12.5px',
  }
  return (
    <>
      <ScreenHead title="Calendario" right="Agosto" />
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--c-text-muted)' }}>Esta semana</span>
          <span className="tnum" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--c-data)' }}>3 / 4</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {week.map(([letter, state], i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)' }}>{letter}</span>
              <span
                style={{
                  width: '22px', height: '22px', borderRadius: 'var(--r-pill)',
                  background: state === 'done' ? 'var(--c-data)' : 'transparent',
                  border: state === 'plan' ? '1.5px dashed var(--c-action-border)'
                    : state === 'done' ? 'none' : '1.5px solid var(--c-surface-3)',
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, padding: 0 }}>
        <div style={{ ...rowBase, borderBottom: '1px solid var(--c-border-subtle)' }}>
          <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Mié · Lower</span>
          <span style={{ fontWeight: 800, color: 'var(--c-success)', fontSize: '11.5px' }}>Hecho ✓</span>
        </div>
        <div style={{ ...rowBase, borderBottom: '1px solid var(--c-border-subtle)' }}>
          <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Vie · Push</span>
          <span style={{ fontWeight: 800, color: 'var(--c-success)', fontSize: '11.5px' }}>Hecho ✓</span>
        </div>
        <div style={rowBase}>
          <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Sáb · Bici · 40 min</span>
          <span style={{ fontWeight: 700, color: 'var(--c-text-muted)', fontSize: '11.5px' }}>Previsto</span>
        </div>
      </div>
    </>
  )
}

// ── Pantalla 3 · Nutrición ──
// El anillo de calorías y los macros contra objetivo. Los tres tonos son la
// rampa del mismo azul (--c-data / -2 / -3), como en la app.
function MacroRow({ label, g, target, color }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>{label}</span>
        <span className="tnum" style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--c-text)' }}>
          {g} <span style={{ color: 'var(--c-text-muted)', fontWeight: 700 }}>/ {target} g</span>
        </span>
      </div>
      <div style={{ height: '6px', borderRadius: 'var(--r-pill)', background: 'var(--c-surface-3)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (g / target) * 100)}%`, height: '100%', background: color, borderRadius: 'var(--r-pill)' }} />
      </div>
    </div>
  )
}

function ScreenNutricion() {
  const kcal = 2140, target = 2600
  const r = 33, circ = 2 * Math.PI * r
  return (
    <>
      <ScreenHead title="Nutrición" right="hoy" />
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <svg width="82" height="82" viewBox="0 0 82 82" style={{ flexShrink: 0 }}>
            <circle cx="41" cy="41" r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth="9" />
            <circle
              cx="41" cy="41" r={r} fill="none" stroke="var(--c-data)" strokeWidth="9"
              strokeDasharray={`${circ * (kcal / target)} ${circ}`} strokeLinecap="round"
              transform="rotate(-90 41 41)"
            />
          </svg>
          <div>
            <p className="tnum" style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--c-text)', lineHeight: 0.9 }}>
              2.140
            </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700, marginTop: '5px' }}>
              de 2.600 kcal
            </p>
            <p className="tnum" style={{ color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
              Quedan 460 kcal
            </p>
          </div>
        </div>
      </div>
      <div style={card}>
        <MacroRow label="Proteína" g={148} target={180} color="var(--c-data)" />
        <MacroRow label="Carbos" g={210} target={260} color="var(--c-data-2)" />
        <MacroRow label="Grasas" g={62} target={72} color="var(--c-data-3)" />
      </div>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>Almuerzo</span>
        <span className="tnum" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--c-text)' }}>720 kcal</span>
      </div>
    </>
  )
}

// ── Pantalla 4 · Estadísticas ──
function ScreenStats() {
  // Ocho semanas de press de banca: la última barra es la que manda. La
  // escala arranca bajo la primera semana, no en cero — si no, ocho barras
  // entre 92,5 y 105 salen todas del mismo alto y la subida no se ve.
  const bars = [92.5, 95, 95, 97.5, 100, 100, 102.5, 105]
  const floor = 88, ceil = 107
  return (
    <>
      <ScreenHead title="Progreso" right="8 semanas" />
      <div style={card}>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', fontWeight: 700 }}>Press de banca · mejor serie</p>
        <p className="tnum" style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-0.045em', color: 'var(--c-text)', lineHeight: 0.9, marginTop: '6px' }}>
          +12,5 kg
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '78px', marginTop: '14px' }}>
          {bars.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: `${((v - floor) / (ceil - floor)) * 100}%`, borderRadius: '4px 4px 2px 2px',
                background: i === bars.length - 1 ? 'var(--c-data)' : 'var(--c-data-3)',
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ ...card, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--c-border-subtle)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>1RM estimado</span>
          <span className="tnum" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--c-text)' }}>131 kg</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--c-border-subtle)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>Volumen semanal</span>
          <span className="tnum" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--c-text)' }}>18.400 kg</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>PRs este mes</span>
          <span className="tnum" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--c-action-text)' }}>4</span>
        </div>
      </div>
    </>
  )
}

const PANELS = [
  {
    kicker: 'Entreno',
    title: 'La fuerza tiene memoria.',
    body: 'Cada serie queda escrita en el momento en que sueltas la barra, con la sesión anterior en fantasma para saber a qué le estás apuntando.',
    Screen: ScreenEntreno,
  },
  {
    kicker: 'Calendario',
    title: 'El plan se cuida solo.',
    body: 'Defines tu rotación una vez y el ciclo se proyecta sobre los días en que de verdad entrenas. Terminas el entreno y el plan de ese día se marca hecho.',
    Screen: ScreenCalendario,
  },
  {
    kicker: 'Nutrición',
    title: 'Lo que comes también entrena.',
    body: 'Macros y calorías contra objetivos calculados que muestran de dónde salen, más 16 micronutrientes que sostienen el rendimiento.',
    Screen: ScreenNutricion,
  },
  {
    kicker: 'Estadísticas',
    title: 'El progreso se mira de frente.',
    body: 'Ocho semanas de press de banca en una sola mirada: mejor serie, 1RM estimado, volumen y los PRs que llevas ganados.',
    Screen: ScreenStats,
  },
]

function Slide({ panel }) {
  const { Screen } = panel
  return (
    <div className="ld-slide">
      <div>
        <p className="ld-slide-kicker">{panel.kicker}</p>
        <h2 className="font-display">{panel.title}</h2>
        <p>{panel.body}</p>
      </div>
      <div className="ld-slide-media">
        <PhoneFrame><Screen /></PhoneFrame>
      </div>
    </div>
  )
}

// ¿Pantalla angosta? El riel deja de anclarse y pasa a carrusel de pulgar.
function useIsNarrow(query = '(max-width: 860px)') {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setNarrow(e.matches)
    setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return narrow
}

// El riel. En escritorio el bloque se ancla una pantalla y las tres secciones
// desfilan en horizontal conforme bajas; en móvil (o con reduced motion) es
// un carrusel nativo con snap, que se desliza con el dedo.
function Cinema({ reduce }) {
  const narrow = useIsNarrow()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Un respiro al principio y al final para que la primera y la última no
  // entren ya en movimiento.
  const x = useTransform(
    scrollYProgress, [0.07, 0.93], ['0vw', `-${(PANELS.length - 1) * 100}vw`], { clamp: true },
  )
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', v => {
    setActive(Math.min(PANELS.length - 1, Math.max(0, Math.round(v * (PANELS.length - 1)))))
  })

  if (narrow || reduce) {
    return (
      <div className="ld-rail-swipe">
        {PANELS.map(panel => <Slide key={panel.kicker} panel={panel} />)}
      </div>
    )
  }

  return (
    <div className="ld-rail-track" ref={ref} style={{ height: `${(PANELS.length + 1) * 100}vh` }}>
      <div className="ld-rail-sticky">
        <motion.div className="ld-rail" style={{ x }}>
          {PANELS.map(panel => <Slide key={panel.kicker} panel={panel} />)}
        </motion.div>
        <div className="ld-rail-ticks" aria-hidden="true">
          {PANELS.map((panel, i) => (
            <span key={panel.kicker} className={`ld-tick${i === active ? ' ld-tick-on' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Piezas del escenario ───────────────────────────────────────────────────

// El descanso corre de verdad: el mock está vivo, no es una captura.
function useRestTimer(from = 92) {
  const [t, setT] = useState(from)
  useEffect(() => {
    const id = setInterval(() => setT(v => (v <= 1 ? from : v - 1)), 1000)
    return () => clearInterval(id)
  }, [from])
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

// La sesión del atleta vista desde la silla del coach — la misma serie del
// teléfono, el mismo día, con el estancamiento señalado y la respuesta.
function CoachCard() {
  const row = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid var(--c-border-subtle)', fontSize: '13px',
  }
  return (
    <div className="material" aria-hidden="true" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--c-text)' }}>Sesión de Andrés</span>
        <span style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700 }}>hoy, 7:12 am</span>
      </div>
      <div style={row}>
        <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Press de banca</span>
        <span className="tnum" style={{ fontWeight: 800, color: 'var(--c-text)' }}>
          100 × 8 <span style={{ color: 'var(--c-action-text)', fontSize: '11.5px' }}>PR</span>
        </span>
      </div>
      <div style={row}>
        <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Remo con barra</span>
        <span className="tnum" style={{ fontWeight: 800, color: 'var(--c-text)' }}>80 × 10</span>
      </div>
      <div style={{ ...row, borderBottom: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Press militar</span>
        <span className="tnum" style={{ fontWeight: 800, color: 'var(--c-text)' }}>
          50 × 6 <span style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700 }}>3 sesiones igual</span>
        </span>
      </div>
      <div style={{
        marginTop: '14px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)',
        padding: '10px 12px', fontSize: '12.5px', fontWeight: 500,
        color: 'var(--c-text-secondary)', lineHeight: 1.45,
      }}>
        <span style={{ fontWeight: 800, color: 'var(--c-text)' }}>Tú:</span> Ese press militar
        lleva tres sesiones plano — el jueves lo bajamos a 47,5 y subimos reps.
      </div>
    </div>
  )
}

// Revelado al hacer scroll: refuerza un contenido ya visible por defecto
// (once: true) y colapsa a un fundido si el sistema pide menos movimiento.
function Reveal({ delay = 0, children, ...rest }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={reduce ? FADE : { ...SPRING_ENTER, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const reduce = useReducedMotion()

  // El wrapper lleva data-theme="dark", pero el body queda fuera de él y el
  // rebote del scroll lo delataría en hueso. El hex es el --c-bg oscuro de
  // index.css — var() no alcanza aquí porque el body resuelve contra :root.
  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#121316'
    return () => { document.body.style.backgroundColor = prev }
  }, [])

  const heroLine = (i) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 34 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: reduce ? FADE : { ...SPRING_ENTER, delay: 0.08 + i * 0.1 },
  })

  // La banda se escribe en mayúsculas en el origen (regla de la caja de
  // frase) y duplicada para que el bucle de −50% cierre sin costura.
  const MARQUEE = 'FUERZA · PRECISIÓN · PROGRESO · SERIE A SERIE · '

  return (
    <div className="fade-in" style={{ minHeight: '100dvh', overflowX: 'clip' }}>
      <style>{CSS}</style>

      {/* ── Banda grafito: cabecera + la cifra que se toca ── */}
      <div className="ld-band-dark ld-band-hero" data-theme="dark">
        {/* El gym al fondo, fundiéndose en el grafito. La foto entra con un
            asentamiento lento (escala 1.08 → 1), el gesto de una cámara. */}
        <div className="ld-hero-photo" aria-hidden="true">
          <motion.img
            src="/landing-gym.jpg"
            alt=""
            initial={reduce ? undefined : { scale: 1.08 }}
            animate={reduce ? undefined : { scale: 1 }}
            transition={reduce ? undefined : { duration: 2.2, ease: [0.23, 1, 0.32, 1] }}
          />
          <div className="ld-hero-scrim" />
        </div>
        <div className="ld-wrap">
          <header className="ld-nav">
            <span className="font-display" style={{ fontSize: '24px', color: 'var(--c-text)' }}>RAW</span>
            <Link to="/login" className="pressable ld-btn ld-btn-ghost ld-btn-sm">Entrar</Link>
          </header>

          <section className="ld-hero">
            <motion.p className="ld-kicker" {...heroLine(0)}>Raw — registro de fuerza serie a serie</motion.p>
            <motion.h1 className="font-display ld-h1" {...heroLine(1)}>
              Para los que entrenan en serio.
            </motion.h1>
            <motion.div {...heroLine(2)}>
              <LiftHero reduce={reduce} />
            </motion.div>
            <motion.div className="ld-ctas" {...heroLine(3)}>
              <a href={MAILTO} className="pressable ld-btn ld-btn-primary">Pedir acceso a la beta</a>
              <a href="#coach" className="pressable ld-btn ld-btn-ghost">¿Entrenas gente?</a>
            </motion.div>
            <motion.p className="ld-note" {...heroLine(4)}>
              Beta cerrada — se entra con código.
            </motion.p>
          </section>
        </div>

        <div className="ld-marquee" aria-hidden="true">
          <motion.div
            className="ld-marquee-inner"
            animate={reduce ? undefined : { x: ['0%', '-50%'] }}
            transition={reduce ? undefined : { duration: 36, ease: 'linear', repeat: Infinity }}
          >
            <span>{MARQUEE.repeat(2)}</span>
            <span>{MARQUEE.repeat(2)}</span>
          </motion.div>
        </div>
      </div>

      {/* ── Banda azul: el riel horizontal con las tres secciones ──
          Ojo con el overflow: un ancestro en `hidden` mata el position:sticky
          del riel (lo convierte en su contenedor de scroll). Quien recorta el
          riel de 300vw es .ld-rail-sticky, que es el propio elemento pegado. */}
      <div className="ld-band-blue" data-theme="light" style={{ position: 'relative' }}>
        <div className="ld-blue-photo" aria-hidden="true">
          <img src="/landing-gym-2.jpg" alt="" loading="lazy" />
          <div className="ld-blue-veil" />
        </div>
        {/* Sin .ld-wrap: los tramos miden 100vw y traen su propio margen. */}
        <div style={{ position: 'relative' }}>
          <Cinema reduce={reduce} />
        </div>
      </div>

      {/* ── Banda hueso: el coach, con el entrenador de fondo ── */}
      <div className="ld-band-light ld-band-coach" data-theme="light">
        <div className="ld-coach-photo" aria-hidden="true">
          <img src="/landing-coach.jpg" alt="" loading="lazy" />
          <div className="ld-coach-veil" />
        </div>
        <div className="ld-wrap">
          <section id="coach" className="ld-coach">
            <Reveal>
              <p className="ld-coach-kicker">Panel coach</p>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 4.2vw, 58px)', color: 'var(--c-text)', lineHeight: 1.0, textWrap: 'balance' }}>
                ¿Entrenas gente? Lo ves el mismo día.
              </h2>
              <p style={{ color: 'var(--c-text-secondary)', fontSize: 'clamp(15px, 1.3vw, 17px)', fontWeight: 500, lineHeight: 1.6, maxWidth: '44ch', marginTop: '18px' }}>
                Asignas rutinas, ves las sesiones de tus clientes el mismo día que
                pasan — estancamientos y PRs incluidos — y hablas con cada uno por
                chat dentro de la app. Mismo lenguaje, visto desde el otro lado.
              </p>
              <a href={MAILTO} className="pressable ld-btn ld-btn-primary" style={{ marginTop: '28px' }}>
                Pedir acceso como coach
              </a>
            </Reveal>
            <Reveal delay={0.12}>
              <CoachCard />
            </Reveal>
          </section>
        </div>
      </div>

      {/* ── Banda grafito: cierre + pie ── */}
      <div className="ld-band-dark" data-theme="dark">
        <div className="ld-wrap">
          <section className="ld-final">
            <Reveal>
              <h2 className="font-display ld-h2">El código se pide.<br />El progreso se gana.</h2>
              <div className="ld-ctas">
                <a href={MAILTO} className="pressable ld-btn ld-btn-primary">Pedir acceso a la beta</a>
              </div>
              <p className="ld-note">La lista es corta y la revisa una persona.</p>
            </Reveal>
          </section>

          {/* ── Pie: instalar la PWA ── */}
          <footer className="ld-footer">
          <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '10px' }}>
            Raw se instala desde el navegador
          </p>
          <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', fontWeight: 500, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700 }}>iPhone:</span> abre Raw en Safari, toca
            Compartir y luego «Agregar a pantalla de inicio».
            <br />
            <span style={{ fontWeight: 700 }}>Android:</span> abre Raw en Chrome y toca
            «Instalar app» cuando el navegador lo ofrezca.
          </p>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '18px' }}>
              Raw · We Do Gym
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
