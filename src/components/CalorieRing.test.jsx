// @vitest-environment jsdom
// El anillo de calorías.
//
// Es geometría, y la geometría se equivoca en silencio: un arco mal calculado
// no lanza, solo dibuja mal. Aquí se comprueba lo que el dibujo promete —
// cuánto está pintado y en qué proporción cada macro— leyendo los
// stroke-dasharray, que es donde vive esa promesa.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CalorieRing from './CalorieRing'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ lang: 'es', locale: 'en-US', t: (k) => k }),
}))

afterEach(cleanup)

// Longitud pintada de cada arco, como fracción de la circunferencia.
function arcos(container) {
  const anillos = [...container.querySelectorAll('circle[stroke-dasharray]')]
  return anillos.map(c => {
    const [len, resto] = c.getAttribute('stroke-dasharray').split(' ').map(Number)
    return len / (len + resto)
  })
}

const total = (container) => arcos(container).reduce((a, b) => a + b, 0)

describe('cuánto se pinta', () => {
  it('la mitad de las calorías es medio anillo', () => {
    const { container } = render(
      <CalorieRing kcal={1000} target={2000} protein={50} carbs={100} fat={30} />
    )
    expect(total(container)).toBeCloseTo(0.5, 2)
  })

  it('sin comer nada no se pinta nada', () => {
    const { container } = render(<CalorieRing kcal={0} target={2000} />)
    expect(total(container)).toBeCloseTo(0, 5)
  })

  it('pasarse no da una segunda vuelta: se queda lleno', () => {
    const { container } = render(
      <CalorieRing kcal={4000} target={2000} protein={100} carbs={200} fat={60} />
    )
    expect(total(container)).toBeCloseTo(1, 2)
  })

  it('sin objetivo no hay contra qué medir, así que se queda vacío', () => {
    const { container } = render(
      <CalorieRing kcal={800} target={0} protein={40} carbs={60} fat={20} />
    )
    expect(total(container)).toBeCloseTo(0, 5)
  })
})

describe('de qué se pinta', () => {
  it('cada macro ocupa lo que aporta en calorías, no en gramos', () => {
    // 100 g de proteína (400 kcal) y 100 g de grasa (900 kcal): la grasa tiene
    // que ocupar más del doble aunque los gramos sean los mismos.
    const { container } = render(
      <CalorieRing kcal={1300} target={1300} protein={100} carbs={0} fat={100} />
    )
    const [p, c, f] = arcos(container)
    expect(p).toBeCloseTo(400 / 1300, 2)
    expect(c).toBeCloseTo(0, 5)
    expect(f).toBeCloseTo(900 / 1300, 2)
  })

  it('los segmentos no se solapan: cada uno arranca donde acaba el anterior', () => {
    const { container } = render(
      <CalorieRing kcal={2000} target={2000} protein={100} carbs={150} fat={50} />
    )
    const anillos = [...container.querySelectorAll('circle[stroke-dasharray]')]
    let esperado = 0
    for (const c of anillos) {
      expect(Number(c.getAttribute('stroke-dashoffset'))).toBeCloseTo(-esperado, 1)
      esperado += Number(c.getAttribute('stroke-dasharray').split(' ')[0])
    }
  })

  it('sin macros no se dibuja ningún segmento, aunque haya calorías', () => {
    const { container } = render(<CalorieRing kcal={500} target={2000} />)
    expect(arcos(container)).toHaveLength(0)
  })
})

describe('la cifra del centro', () => {
  it('es lo registrado sobre el objetivo', () => {
    render(<CalorieRing kcal={1689} target={2893} protein={112} carbs={114} fat={87} />)
    expect(screen.getByText('1,689')).toBeTruthy()
    expect(screen.getByText('/ 2,893 kcal')).toBeTruthy()
  })

  it('con basura no imprime NaN', () => {
    render(<CalorieRing kcal={undefined} target={undefined} protein="x" />)
    expect(screen.getByText('0')).toBeTruthy()
  })
})
