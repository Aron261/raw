// @vitest-environment jsdom
// La baraja: recorrido circular, carta de cierre y regleta.
//
// Lo que se prueba aquí es lo que no se ve mirando el componente: que del
// último se pasa al primero (y no a la nada), que la regleta enseña la sesión
// entera aunque la baraja solo tenga lo que queda, y que barrer con el dedo
// cae en el tramo que hay debajo. Todo eso son cuentas de índices, que es
// exactamente donde una baraja se rompe en silencio.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../hooks/useLang', () => ({ useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }) }))
// motion/react en jsdom: sin animaciones ni arrastre, solo el div de dentro.
vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }) => {
      // Las props de motion (drag, initial, animate…) no son atributos válidos.
      const { drag, dragDirectionLock, dragSnapToOrigin, dragElastic, onDragEnd,
              initial, animate, transition, ...dom } = rest
      return <div {...dom}>{children}</div>
    },
  }),
}))

import ExerciseDeck, { END_KEY } from './ExerciseDeck'

afterEach(cleanup)

const exercise = (key, label, extra = {}) => ({ key, kind: 'exercise', label, done: false, groupId: null, ...extra })

function setup({ done = [], current = 'a', group = null } = {}) {
  const names = { a: 'Press banca', b: 'Remo', c: 'Sentadilla' }
  const rail = ['a', 'b', 'c'].map(k => exercise(k, names[k], {
    done: done.includes(k),
    groupId: group?.includes(k) ? 'g1' : null,
  })).concat({ key: END_KEY, kind: 'end', label: 'Fin del recorrido', done: false, groupId: null })

  // La baraja solo lleva lo pendiente (más el que se está mirando) + el cierre.
  const stops = rail
    .filter(r => r.kind === 'exercise' && (!r.done || r.key === current))
    .map(r => ({ key: r.key, kind: 'exercise', we: { id: r.key } }))
    .concat({ key: END_KEY, kind: 'end' })

  const onCurrentChange = vi.fn()
  render(
    <ExerciseDeck stops={stops} rail={rail} currentKey={current} onCurrentChange={onCurrentChange}>
      {(stop) => <div data-testid="card">{stop.kind === 'end' ? 'CIERRE' : stop.key}</div>}
    </ExerciseDeck>,
  )
  return { onCurrentChange, stops, rail }
}

const next = () => screen.getByLabelText('Ejercicio siguiente')
const prev = () => screen.getByLabelText('Ejercicio anterior')

describe('ExerciseDeck — recorrido circular', () => {
  it('del último ejercicio pasa a la carta de cierre, no al vacío', () => {
    const { onCurrentChange } = setup({ current: 'c' })
    fireEvent.click(next())
    expect(onCurrentChange).toHaveBeenCalledWith(END_KEY)
  })

  it('del cierre vuelve al primero — el recorrido da la vuelta', () => {
    const { onCurrentChange } = setup({ current: END_KEY })
    fireEvent.click(next())
    expect(onCurrentChange).toHaveBeenCalledWith('a')
  })

  it('hacia atrás desde el primero cae en el cierre', () => {
    const { onCurrentChange } = setup({ current: 'a' })
    fireEvent.click(prev())
    expect(onCurrentChange).toHaveBeenCalledWith(END_KEY)
  })

  it('las flechas nunca se desactivan: en los extremos siguen llevando a algún sitio', () => {
    setup({ current: 'a' })
    expect(next().disabled).toBe(false)
    expect(prev().disabled).toBe(false)
  })
})

describe('ExerciseDeck — ejercicios hechos', () => {
  it('un ejercicio hecho sale de la baraja pero sigue en la regleta', () => {
    const { onCurrentChange } = setup({ done: ['b'], current: 'a' })
    // Pasar de 'a' salta 'b': ya está hecho.
    fireEvent.click(next())
    expect(onCurrentChange).toHaveBeenCalledWith('c')
    // Pero sigue siendo alcanzable desde el índice.
    expect(screen.getByLabelText('Remo')).toBeTruthy()
  })

  it('se puede volver a uno hecho desde la regleta', () => {
    const { onCurrentChange } = setup({ done: ['b'], current: 'a' })
    fireEvent.click(screen.getByLabelText('Remo'))
    expect(onCurrentChange).toHaveBeenCalledWith('b')
  })

  it('los hechos se listan por nombre — el verde de un tramo no dice cuál es', () => {
    setup({ done: ['b'], current: 'a' })
    fireEvent.click(screen.getByText(/1 hecho/))
    expect(screen.getAllByText('Remo').length).toBeGreaterThan(0)
  })

  it('sin ninguno hecho no hay lista que abrir', () => {
    setup({ current: 'a' })
    expect(screen.queryByText(/hechos?/)).toBeNull()
  })
})

describe('ExerciseDeck — regleta', () => {
  it('arrastrar el dedo cae en el tramo que hay debajo, no en el que se tocó', () => {
    const { onCurrentChange } = setup({ current: 'a' })
    const railEl = screen.getByLabelText('Press banca').parentElement
    railEl.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 34, right: 400, bottom: 34 })

    // 4 tramos en 400px → 100px cada uno. 250px cae en el tercero ('c').
    fireEvent.pointerDown(railEl, { clientX: 250, pointerId: 1, pointerType: 'touch' })
    expect(onCurrentChange).toHaveBeenCalledWith('c')

    // Sin soltar, seguir hasta el segundo.
    fireEvent.pointerMove(railEl, { clientX: 150, pointerId: 1, pointerType: 'touch' })
    expect(onCurrentChange).toHaveBeenLastCalledWith('b')
  })

  it('un toque en el índice salta a ese ejercicio', () => {
    const { onCurrentChange } = setup({ current: 'a' })
    fireEvent.click(screen.getByLabelText('Sentadilla'))
    expect(onCurrentChange).toHaveBeenCalledWith('c')
  })

  it('la regleta lleva la sesión entera más el cierre', () => {
    setup({ current: 'a' })
    expect(screen.getByLabelText('Press banca')).toBeTruthy()
    expect(screen.getByLabelText('Remo')).toBeTruthy()
    expect(screen.getByLabelText('Sentadilla')).toBeTruthy()
    expect(screen.getByLabelText('Fin del recorrido')).toBeTruthy()
  })
})

describe('ExerciseDeck — carta', () => {
  it('enseña la carta de la clave actual', () => {
    setup({ current: 'b' })
    expect(screen.getByTestId('card').textContent).toBe('b')
  })

  it('en el cierre enseña la carta de cierre', () => {
    setup({ current: END_KEY })
    expect(screen.getByTestId('card').textContent).toBe('CIERRE')
  })
})
