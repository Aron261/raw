// @vitest-environment jsdom
// Renombrar un ejercicio desde su propia carta.
//
// Es un renombrado de verdad, no un mote de esta sesión, así que la carta tiene
// que decirlo antes de guardar — y guardar lo que se ve, no lo que había
// escrito debajo. Aquí se fija esa puerta: quién puede abrirla, con qué texto
// arranca y qué sale hacia arriba.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

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
// El label sigue la misma precedencia que exerciseLabel: el nombre puesto a
// mano manda sobre el de la biblioteca.
vi.mock('../hooks/useExerciseLang', () => ({
  useExerciseLang: () => ({
    label: (e) => e?.custom_name?.trim() || e?.library?.name || e?.name || '',
    term: (x) => x, lang: 'es',
  }),
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

function renderRow({ exercise, onRenameExercise, deck = true, readOnly = false } = {}) {
  const rename = onRenameExercise === undefined ? vi.fn().mockResolvedValue(undefined) : onRenameExercise
  render(
    <ExerciseRow
      deck={deck}
      readOnly={readOnly}
      workoutExercise={{
        id: 'we1', unit: 'kg', sets: [],
        exercises: exercise || { id: 'e1', name: 'Press de banca' },
      }}
      workoutId="w1"
      onRenameExercise={rename}
      onAddSet={vi.fn()} onDeleteSet={vi.fn()} onUpdateSet={vi.fn()}
      onUpdateUnit={vi.fn()} onRemoveExercise={vi.fn()} onUpdateNotes={vi.fn()}
      completedSetIds={new Set()} onToggleSetDone={vi.fn()}
    />
  )
  return { rename }
}

const campo = () => screen.getByLabelText('Nombre del ejercicio')

describe('ExerciseRow · renombrar', () => {
  it('el nombre se toca y se convierte en campo', () => {
    renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    expect(campo().value).toBe('Press de banca')
  })

  it('arranca con lo que se está viendo: corregir una letra no obliga a reescribirlo', () => {
    renderRow({ exercise: { id: 'e1', name: 'Bench Press', library: { name: 'Press de banca' } } })
    fireEvent.click(screen.getByText('Press de banca'))
    // El borrador es la etiqueta visible, no el `name` interno.
    expect(campo().value).toBe('Press de banca')
  })

  it('avisa de que el renombrado alcanza a todo el historial', () => {
    renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    expect(screen.getByText(/Se renombra en todo tu historial/)).toBeTruthy()
  })

  it('guarda al salir del campo', async () => {
    const { rename } = renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    fireEvent.change(campo(), { target: { value: 'Press plano barra' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(rename).toHaveBeenCalledWith('e1', 'Press plano barra'))
  })

  it('Enter también guarda', async () => {
    const { rename } = renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    fireEvent.change(campo(), { target: { value: 'Press inclinado' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    await waitFor(() => expect(rename).toHaveBeenCalledWith('e1', 'Press inclinado'))
  })

  it('Escape sale sin tocar nada', () => {
    const { rename } = renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    fireEvent.change(campo(), { target: { value: 'Otra cosa' } })
    fireEvent.keyDown(campo(), { key: 'Escape' })
    expect(rename).not.toHaveBeenCalled()
    expect(screen.getByText('Press de banca')).toBeTruthy()
  })

  it('no guarda si no ha cambiado nada', async () => {
    const { rename } = renderRow()
    fireEvent.click(screen.getByText('Press de banca'))
    fireEvent.blur(campo())
    await waitFor(() => expect(rename).not.toHaveBeenCalled())
  })

  it('un fallo al guardar se dice en la carta, no se traga', async () => {
    const { rename } = renderRow({ onRenameExercise: vi.fn().mockRejectedValue(new Error('Sin conexión')) })
    fireEvent.click(screen.getByText('Press de banca'))
    fireEvent.change(campo(), { target: { value: 'Press nuevo' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(rename).toHaveBeenCalled())
    expect(await screen.findByText('Sin conexión')).toBeTruthy()
  })

  it('en una sesión en repaso el nombre no se toca', () => {
    renderRow({ readOnly: true })
    fireEvent.click(screen.getByText('Press de banca'))
    expect(screen.queryByLabelText('Nombre del ejercicio')).toBeNull()
  })

  it('sin la capacidad de renombrar, tocar el nombre no hace nada', () => {
    renderRow({ onRenameExercise: null })
    fireEvent.click(screen.getByText('Press de banca'))
    expect(screen.queryByLabelText('Nombre del ejercicio')).toBeNull()
  })

  it('en lista la puerta está en el menú: la cabecera ahí pliega la fila', () => {
    renderRow({ deck: false })
    fireEvent.click(screen.getByLabelText('Opciones'))
    fireEvent.click(screen.getByText('Editar nombre'))
    expect(campo().value).toBe('Press de banca')
  })

  it('ya no se ofrece «Repetir la vez pasada»: el ✓ acepta el fantasma', () => {
    renderRow()
    fireEvent.click(screen.getByLabelText('Opciones'))
    expect(screen.queryByText('Repetir la vez pasada')).toBeNull()
  })
})
