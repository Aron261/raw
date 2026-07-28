// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import RestTimerSheet from './RestTimerSheet'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }),
}))

afterEach(cleanup)
beforeEach(() => vi.useRealTimers())

/*
 * Lo que se prueba aquí no es el aspecto —eso se mira— sino las dos cosas que
 * pueden dejar la hoja pegada en pantalla en mitad de un entreno:
 *
 * · Que el desmontaje lo dispare el reloj y no el fin de una animación. Si un
 *   día alguien lo cuelga de onAnimationComplete, un navegador que no dispare
 *   ese evento deja la hoja tapando las series para siempre.
 * · Que el cierre lleve el restId, para que un cierre tardío no mate el
 *   descanso siguiente que ya empezó.
 */
describe('RestTimerSheet', () => {
  const base = { restId: 'r1', total: 90, onExtend: vi.fn(), onDismiss: vi.fn() }

  it('cuenta el tiempo que queda', () => {
    render(<RestTimerSheet {...base} endsAt={Date.now() + 84_000} />)
    expect(screen.getByText('1:24')).toBeTruthy()
  })

  it('al llegar a cero avisa y se cierra solo, por reloj', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<RestTimerSheet {...base} onDismiss={onDismiss} endsAt={Date.now() - 1000} />)

    // Nada más montar todavía no se ha ido: hay un momento de "Hecho".
    expect(onDismiss).not.toHaveBeenCalled()

    // Son dos esperas encadenadas y la segunda solo se programa cuando React
    // ha aplicado el estado de la primera: hay que dejar que respire entre
    // medias en vez de saltar los 2060ms de golpe.
    await act(async () => { vi.advanceTimersByTime(1800) })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(onDismiss).toHaveBeenCalledWith('r1')
    vi.useRealTimers()
  })

  it('«Saltar» cierra con el id del descanso que se estaba viendo', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<RestTimerSheet {...base} restId="r7" onDismiss={onDismiss} endsAt={Date.now() + 60_000} />)

    act(() => { screen.getByLabelText('Saltar descanso').click() })
    await act(async () => { vi.advanceTimersByTime(300) })

    expect(onDismiss).toHaveBeenCalledWith('r7')
    vi.useRealTimers()
  })

  it('«+30 s» alarga en vez de cerrar', () => {
    const onExtend = vi.fn()
    const onDismiss = vi.fn()
    render(<RestTimerSheet {...base} onExtend={onExtend} onDismiss={onDismiss} endsAt={Date.now() + 60_000} />)

    act(() => { screen.getByLabelText('Añadir 30 segundos de descanso').click() })
    expect(onExtend).toHaveBeenCalledWith(30)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('terminado, ya no ofrece alargar', () => {
    render(<RestTimerSheet {...base} endsAt={Date.now() - 1000} />)
    expect(screen.queryByLabelText('Añadir 30 segundos de descanso')).toBeNull()
    expect(screen.getByText('Hecho')).toBeTruthy()
  })
})
