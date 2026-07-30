// @vitest-environment jsdom
// "Cómo se hace" solo vive en el menú ··· de un entreno en curso: en un entreno
// terminado el menú entero está oculto, así que esta ruta no se puede mirar sin
// crear un entreno de verdad. De ahí la prueba — comprueba que la entrada
// aparece solo cuando ese ejercicio tiene animación aprobada, que es la misma
// puerta que ExerciseGif, pero aplicada un paso antes para no ofrecer un menú
// que abriría una hoja vacía.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// La hoja (Sheet) arrastra media API de motion: gestos, valores animados y
// sus suscripciones. Aquí solo importa que renderice, así que se sustituyen
// por lo mínimo que no reviente.
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, drag, dragControls, dragListener, dragConstraints,
                  dragElastic, onDragEnd, style, initial, animate, exit,
                  transition, whileTap, ...p }) => <div style={style} {...p}>{children}</div>,
  }),
  useReducedMotion: () => true,
  useMotionValue: (v) => ({ get: () => v, set: () => {}, on: () => () => {} }),
  useMotionValueEvent: () => {},
  useDragControls: () => ({ start: () => {} }),
  animate: () => ({ stop: () => {} }),
  AnimatePresence: ({ children }) => children,
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }) }))
vi.mock('../hooks/useExerciseLang', () => ({
  useExerciseLang: () => ({ label: (e) => e?.name ?? '', term: (x) => x, lang: 'es' }),
}))
vi.mock('../hooks/useWorkout', () => ({
  calc1RM: (w, r) => (r ? Math.round(w * (1 + r / 30)) : w),
  useExerciseAllTimeBest: () => ({ allTimeBestWeight: null }),
  usePreviousSets: () => ({ previousSets: [] }),
}))
vi.mock('./SetRow', () => ({ default: () => <div /> }))
vi.mock('./PRBadge', () => ({ default: () => <span /> }))

import ExerciseRow from './ExerciseRow'

afterEach(cleanup)

const GIF = 'https://static.exercisedb.dev/media/abc.gif'

function renderRow(library) {
  render(
    <ExerciseRow
      workoutExercise={{
        id: 'we1', unit: 'kg', sets: [],
        exercises: { id: 'e1', name: 'Press de banca', library_id: 'l1', library },
      }}
      workoutId="w1"
      onAddSet={vi.fn()} onDeleteSet={vi.fn()} onUpdateSet={vi.fn()}
      onUpdateUnit={vi.fn()} onRemoveExercise={vi.fn()} onUpdateNotes={vi.fn()}
      completedSetIds={new Set()} onToggleSetDone={vi.fn()}
    />
  )
  fireEvent.click(screen.getByLabelText('Opciones'))
}

describe('ExerciseRow · cómo se hace', () => {
  it('ofrece la animación cuando está aprobada', () => {
    renderRow({ name: 'Press de banca', gif_url: GIF, media_reviewed: true })
    expect(screen.getByText('Cómo se hace')).toBeTruthy()
  })

  it('no la ofrece si nadie la ha revisado', () => {
    renderRow({ name: 'Press de banca', gif_url: GIF, media_reviewed: false })
    expect(screen.queryByText('Cómo se hace')).toBeNull()
  })

  it('no la ofrece en un ejercicio propio, sin ficha de librería', () => {
    renderRow(null)
    expect(screen.queryByText('Cómo se hace')).toBeNull()
  })

  it('abre la hoja con la animación', () => {
    renderRow({ name: 'Press de banca', gif_url: GIF, media_reviewed: true })
    fireEvent.click(screen.getByText('Cómo se hace'))
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe(GIF)
  })
})
