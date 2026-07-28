// Motion vocabulary for Raw — one place for every spring/ease the app uses.
// Components import these instead of declaring literals, so the whole app
// shares a single physical feel and a retune happens in one file.

// Press feedback on tappable controls: springs in on touch-down, settles with
// a hint of bounce on release.
export const SPRING_PRESS = { type: 'spring', bounce: 0.32, duration: 0.3 }

// Small surfaces popping into place (menus, popovers) — quick, slightly lively.
export const SPRING_POP = { type: 'spring', bounce: 0.28, duration: 0.32 }

// Sheets and large surfaces: enter from below with a hint of life, settle
// back after an abandoned drag, dismiss with no bounce at all.
export const SPRING_ENTER = { type: 'spring', bounce: 0.18, duration: 0.42 }
export const SPRING_SETTLE = { type: 'spring', bounce: 0.12, duration: 0.4 }
export const SPRING_DISMISS = { type: 'spring', bounce: 0, duration: 0.3 }

// Cambio de carta en la baraja de ejercicios. Corto y sin rebote: la carta
// que sale y la que entra van en secuencia (si no, dos alturas distintas
// pelean por el mismo hueco), así que cada tramo tiene que ser breve o el
// gesto se siente pastoso.
export const SPRING_DECK = { type: 'spring', bounce: 0, duration: 0.22 }

// One-shot celebratory pop (the ✓ confirming a set) — overshoots then lands.
export const EASE_POP_KEYFRAMES = [0.34, 1.56, 0.64, 1]
export const POP_DURATION = 0.34

// Plain fades for reduced-motion fallbacks.
export const FADE = { duration: 0.15 }
