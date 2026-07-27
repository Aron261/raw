// @vitest-environment jsdom
// La unidad de un ejercicio solo puede tener un valor, así que solo se enseña
// uno. Antes se pintaban kg y lb siempre y había que mirar cuál estaba
// resaltada para saber en cuál estabas registrando.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import UnitToggle from './UnitToggle'

afterEach(cleanup)

describe('UnitToggle', () => {
  it('enseña solo la unidad activa, nunca las dos', () => {
    render(<UnitToggle value="kg" units={['kg', 'lb']} onChange={() => {}} />)
    expect(screen.getByText('kg')).toBeTruthy()
    expect(screen.queryByText('lb')).toBeNull()
  })

  it('un toque cambia a la otra', () => {
    const onChange = vi.fn()
    render(<UnitToggle value="kg" units={['kg', 'lb']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('lb')
  })

  it('y vuelve: el toggle cicla', () => {
    const onChange = vi.fn()
    render(<UnitToggle value="lb" units={['kg', 'lb']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('kg')
  })

  it('dice en voz alta las dos, porque solo se ve una', () => {
    // Sin las dos opciones a la vista, quien no ve la pantalla no puede deducir
    // cuál es la alternativa: el nombre accesible tiene que nombrarla.
    render(<UnitToggle value="kg" units={['kg', 'lb']} onChange={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/kg/)
    expect(btn.getAttribute('aria-label')).toMatch(/lb/)
  })

  it('sirve para cualquier par, no solo peso', () => {
    const onChange = vi.fn()
    render(<UnitToggle value="cm" units={['cm', 'ft']} onChange={onChange} />)
    expect(screen.queryByText('ft')).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('ft')
  })

  it('en solo lectura no es un botón', () => {
    render(<UnitToggle value="kg" units={['kg', 'lb']} onChange={() => {}} readOnly />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('kg')).toBeTruthy()
  })

  it('si el valor no está en la lista, cae en la primera sin romperse', () => {
    render(<UnitToggle value={undefined} units={['kg', 'lb']} onChange={() => {}} />)
    expect(screen.getByText('kg')).toBeTruthy()
  })
})
