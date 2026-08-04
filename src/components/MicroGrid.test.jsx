// @vitest-environment jsdom
// La rejilla de micros de la pantalla del día.
//
// Se escribe después de que la pantalla reventara en blanco con la suite en
// verde: no había ni un test que renderizara este componente, así que un
// `sinObjetivo is not defined` llegó hasta el navegador.
//
// Y lo que prueba de fondo es la distinción que sostiene toda la mitad de
// micros: «no lo sé» no es «cero». Si una comida no reporta vitamina C, pintar
// 0% acusa al usuario de no haberla comido.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MicroGrid from './MicroGrid'
import { PRIORITY } from '../lib/nutrients'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    lang: 'es', locale: 'es-CO',
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
  }),
}))

// Objetivos para los nueve prioritarios.
const OBJETIVOS = {
  micros: {
    fibra: 40, potasio: 3400, calcio: 1000, hierro: 8, omega3: 1.6,
    vitamina_c: 90, vitamina_b12: 2.4, vitamina_a: 900, folato: 400,
  },
}

afterEach(cleanup)

const pintar = (props = {}) => render(
  <MicroGrid totals={{ micros: {} }} targets={OBJETIVOS} onOpenAll={() => {}} {...props} />
)

describe('qué se enseña', () => {
  it('los nueve prioritarios, y solo esos', () => {
    pintar({ totals: { micros: { fibra: 20 } } })
    for (const n of PRIORITY) expect(screen.getByText(n.label)).toBeTruthy()
    // El sodio es un techo: vive en la hoja completa, no aquí.
    expect(screen.queryByText('Sodio')).toBeNull()
  })

  it('en porcentaje del objetivo, que es lo que se entiende de un vistazo', () => {
    pintar({ totals: { micros: { calcio: 510 } } })
    expect(screen.getByText('51%')).toBeTruthy()
  })
})

describe('«sin dato» no es «cero»', () => {
  it('un micro que ninguna comida reportó sale con un guion', () => {
    pintar({ totals: { micros: { fibra: 20 } } })
    // Ocho de los nueve no se conocen.
    expect(screen.getAllByText('—')).toHaveLength(PRIORITY.length - 1)
    expect(screen.queryByText('0%')).toBeNull()
  })

  it('un cero reportado de verdad sí es un cero', () => {
    pintar({ totals: { micros: { fibra: 0 } } })
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('el contador cuenta sobre lo que se sabe, no sobre los nueve', () => {
    // Dos conocidos, uno de ellos cumplido.
    pintar({ totals: { micros: { fibra: 44, calcio: 300 } } })
    expect(screen.getByText('1 de 2')).toBeTruthy()
  })
})

describe('pasarse de un piso es cumplirlo', () => {
  it('por encima del 100% sigue contando y no se lee como alerta', () => {
    const { container } = pintar({ totals: { micros: { omega3: 3.5 } } })
    expect(screen.getByText('219%')).toBeTruthy()
    const barras = [...container.querySelectorAll('div[role="progressbar"] > div')]
    expect(barras.some(b => b.style.background.includes('--c-success'))).toBe(true)
    expect(barras.some(b => b.style.background.includes('--c-action'))).toBe(false)
  })

  it('la barra no se desborda aunque el porcentaje pase de cien', () => {
    const { container } = pintar({ totals: { micros: { omega3: 16 } } })
    const barras = [...container.querySelectorAll('div[role="progressbar"] > div')]
    for (const b of barras) {
      const m = b.style.transform.match(/scaleX\(([\d.]+)\)/)
      if (m) expect(Number(m[1])).toBeLessThanOrEqual(1)
    }
  })
})

describe('sin objetivos', () => {
  it('ofrece calcularlos en vez de enseñar nueve guiones', () => {
    pintar({ targets: { micros: {} } })
    expect(screen.getByText(/Sin objetivos de micros todavía/)).toBeTruthy()
    expect(screen.queryByText('Fibra')).toBeNull()
  })

  it('aguanta unos targets a medio hacer', () => {
    expect(() => pintar({ targets: {} })).not.toThrow()
    expect(() => pintar({ targets: null, totals: null })).not.toThrow()
  })
})

describe('la salida a la hoja completa', () => {
  it('está siempre, también sin objetivos', () => {
    const onOpenAll = vi.fn()
    pintar({ onOpenAll })
    fireEvent.click(screen.getByText('Ver los 16 y la cobertura del día ›'))
    expect(onOpenAll).toHaveBeenCalled()
  })
})
