// @vitest-environment jsdom
// La hoja de micros del día.
//
// Dos cosas que, si fallan, la pantalla enseña lo contrario de lo que quiere:
//
//   · Pasarse de sodio es un problema y pasarse de fibra es el objetivo
//     cumplido. La misma barra tiene que leerse de las dos maneras.
//   · Si solo dos de cinco comidas traen micros, el total no es «lo que
//     comiste» sino «lo que sabemos». Eso se dice, no se calla.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import NutritionMicrosSheet from './NutritionMicrosSheet'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    lang: 'es',
    locale: 'es-CO',
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
  }),
}))

const OBJETIVOS = {
  micros: { sodio: 2300, fibra: 30, hierro: 8, azucar: 75, grasa_saturada: 22, colesterol: 300 },
}

afterEach(cleanup)

const abrir = (props = {}) => render(
  <NutritionMicrosSheet
    totals={{ micros: {} }}
    targets={OBJETIVOS}
    entryCount={5}
    coveredCount={2}
    onClose={() => {}}
    {...props}
  />
)

describe('agrupación', () => {
  it('separa lo que hay que alcanzar de lo que no hay que pasar', () => {
    abrir()
    expect(screen.getByText('No pasarse')).toBeTruthy()
    expect(screen.getByText('Alcanzar')).toBeTruthy()
  })

  it('los techos van primero: son los datos de etiqueta, los fiables', () => {
    const { container } = abrir()
    const titulos = [...container.querySelectorAll('h3')].map(h => h.textContent)
    expect(titulos.indexOf('No pasarse')).toBeLessThan(titulos.indexOf('Alcanzar'))
  })
})

describe('dirección de la barra', () => {
  it('pasarse de un techo pinta alerta', () => {
    const { container } = abrir({ totals: { micros: { sodio: 4800 } } })
    const barras = [...container.querySelectorAll('div[role="progressbar"] > div')]
    const alerta = barras.filter(b => b.style.background.includes('--c-action'))
    expect(alerta.length).toBe(1)
  })

  it('pasarse de un piso NO pinta alerta: es el objetivo cumplido', () => {
    const { container } = abrir({ totals: { micros: { fibra: 45 } } })
    const barras = [...container.querySelectorAll('div[role="progressbar"] > div')]
    expect(barras.some(b => b.style.background.includes('--c-action'))).toBe(false)
    expect(barras.some(b => b.style.background.includes('--c-success'))).toBe(true)
  })
})

describe('cobertura', () => {
  it('dice cuántas comidas traen datos, y que lo ausente no es cero', () => {
    abrir()
    expect(screen.getByText(/2 de 5 comidas de hoy traen micros/)).toBeTruthy()
    expect(screen.getByText(/no lo sabemos/)).toBeTruthy()
  })

  it('avisa de que son estimaciones, no una medición', () => {
    abrir()
    expect(screen.getByText(/no una medición/)).toBeTruthy()
  })

  it('sin comidas registradas lo dice en vez de un «0 de 0»', () => {
    abrir({ entryCount: 0, coveredCount: 0 })
    expect(screen.getByText('Todavía no has registrado nada hoy.')).toBeTruthy()
  })
})

describe('objetivos', () => {
  it('un nutriente sin objetivo se pinta con un guion, no con una barra a cero', () => {
    const { container } = abrir({ targets: { micros: { sodio: 2300 } } })
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('div[role="progressbar"]').length).toBe(1)
  })

  it('sin ningún objetivo ofrece calcularlos', () => {
    const onOpenTargets = vi.fn()
    abrir({ targets: { micros: {} }, onOpenTargets })
    expect(screen.getByText(/Todavía no tienes objetivos de micros/)).toBeTruthy()
    expect(screen.getByText('Calcular objetivos →')).toBeTruthy()
    expect(screen.queryByText('No pasarse')).toBeNull()
  })

  it('unos objetivos sin micros aguantan targets a medio hacer', () => {
    expect(() => abrir({ targets: {} })).not.toThrow()
    expect(() => abrir({ targets: null })).not.toThrow()
  })
})
