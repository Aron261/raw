// @vitest-environment jsdom
// Weight steppers: rapid taps must accumulate exactly and each release must
// save the current value — the bug the browser harness couldn't pin down
// (its re-renders raced the synthetic events). Here the render is controlled,
// so the logic is deterministic.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }))
vi.mock('motion/react', () => ({ animate: () => {}, useReducedMotion: () => true }))
vi.mock('../hooks/useWorkout', () => ({ calc1RM: (w, r) => (r ? Math.round(w * (1 + r / 30)) : w) }))
// useLang cuelga de useProfile → supabase. Aquí solo hace falta que traduzca.
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }) }))

import SetRow from './SetRow'

afterEach(cleanup)

function renderRow(props = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SetRow
      set={{ id: 's1', reps: 8, weight: 10 }}
      setNumber={1}
      unit="lb"
      allTimeBest1RM={0}
      onSave={onSave}
      onToggleDone={() => {}}
      onRemove={() => {}}
      {...props}
    />,
  )
  return { onSave }
}

const tap = (btn) => { fireEvent.pointerDown(btn); fireEvent.pointerUp(btn) }
const lastWeight = (onSave) => onSave.mock.calls.at(-1)[2]

describe('SetRow weight steppers', () => {
  it('three rapid + taps accumulate and the last save carries the final value', async () => {
    const { onSave } = renderRow()
    const up = screen.getByLabelText('Subir peso serie 1 5') // lb → step 5
    tap(up); tap(up); tap(up) // 10 → 15 → 20 → 25
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(lastWeight(onSave)).toBe('25')
    // reps preserved, not marked done
    expect(onSave.mock.calls.at(-1)).toEqual([1, '8', '25', false])
  })

  it('− steps down and never below zero', async () => {
    const { onSave } = renderRow({ set: { id: 's1', reps: 8, weight: 5 } })
    const down = screen.getByLabelText('Bajar peso serie 1 5')
    tap(down) // 5 → 0
    tap(down) // clamps at 0
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(lastWeight(onSave)).toBe('0')
  })

  it('uses a 2.5 step in kg', async () => {
    const { onSave } = renderRow({ unit: 'kg', set: { id: 's1', reps: 8, weight: 20 } })
    const up = screen.getByLabelText('Subir peso serie 1 2.5')
    tap(up); tap(up) // 20 → 22.5 → 25
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(lastWeight(onSave)).toBe('25')
  })

  it('has no steppers in read-only mode', () => {
    renderRow({ readOnly: true })
    expect(screen.queryByLabelText('Subir peso serie 1 5')).toBeNull()
  })
})

// «Igual que la vez pasada» es el caso más común del gimnasio y costaba el
// teclado entero, con el número ya delante en gris dentro del propio campo.
describe('SetRow: aceptar el fantasma con el ✓', () => {
  const vacia = { set: null, previousSet: { reps: 8, weight: 60 } }

  it('un toque registra la serie con los números de la vez pasada', async () => {
    const { onSave } = renderRow(vacia)
    const check = screen.getByLabelText('Repetir la vez pasada en la serie 1: 8 por 60 lb')
    fireEvent.click(check)
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls.at(-1)).toEqual([1, '8', '60', true])
  })

  it('sin serie anterior no hay nada que aceptar: el ✓ sigue inhabilitado', () => {
    renderRow({ set: null, previousSet: null })
    expect(screen.getByLabelText('Completar serie 1').disabled).toBe(true)
  })

  // Media fila a medio escribir no se completa sola por detrás: quien empezó a
  // teclear ya está diciendo que hoy no es igual que la vez pasada.
  it('con un campo ya escrito, el ✓ no ofrece repetir', () => {
    renderRow({ ...vacia, set: { id: 's1', reps: 5, weight: 0 } })
    expect(screen.queryByLabelText(/Repetir la vez pasada/)).toBeNull()
  })

  it('una serie ya registrada no se toca: el ✓ la deshace', () => {
    renderRow({ set: { id: 's1', reps: 8, weight: 60 }, previousSet: { reps: 8, weight: 60 }, done: true })
    expect(screen.getByLabelText('Deshacer serie 1')).toBeTruthy()
    expect(screen.queryByLabelText(/Repetir la vez pasada/)).toBeNull()
  })
})

// Récord es superar la marca, no igualarla. Solo hay un récord: repetir la
// misma cifra es volver a tocar el mismo, no conseguir otro. El listón que
// llega en `allTimeBest1RM` ya excluye la sesión en curso, así que aquí basta
// con que la comparación sea estricta.
describe('SetRow — la insignia de récord', () => {
  // 8 × 60 con la fórmula del harness (w · (1 + r/30)) da 76.
  const pr = (best) => renderRow({ set: { id: 's1', reps: 8, weight: 60 }, allTimeBest1RM: best })

  it('aparece al superar la marca anterior', () => {
    pr(70)
    expect(screen.getByText('PR')).toBeTruthy()
  })

  it('NO aparece al igualarla — el récord sigue siendo el mismo', () => {
    pr(76)
    expect(screen.queryByText('PR')).toBeNull()
  })

  it('no aparece por debajo', () => {
    pr(90)
    expect(screen.queryByText('PR')).toBeNull()
  })

  it('sin historial no hay marca que superar', () => {
    pr(0)
    expect(screen.queryByText('PR')).toBeNull()
  })
})
