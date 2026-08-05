// @vitest-environment jsdom
// El envoltorio de campo con etiqueta.
//
// Era un <p> encima del input: idéntico a la vista, pero para un lector de
// pantalla el campo no tenía nombre —"cuadro de edición" y ya— y tocar la
// etiqueta no enfocaba nada. Había UN htmlFor en toda la app para unos sesenta
// y cinco controles, así que arreglarlo aquí ata los veintiocho Field que ya
// existen sin tocar ninguno.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Field from './Field'

afterEach(cleanup)

describe('la etiqueta nombra al control', () => {
  it('el input queda accesible por su etiqueta', () => {
    render(<Field label="Peso"><input /></Field>)
    expect(screen.getByLabelText('Peso').tagName).toBe('INPUT')
  })

  it('la etiqueta es un <label>, no un párrafo', () => {
    const { container } = render(<Field label="Peso"><input /></Field>)
    const lab = container.querySelector('label')
    expect(lab).toBeTruthy()
    expect(lab.getAttribute('for')).toBe(container.querySelector('input').id)
  })

  it('funciona con select y textarea, no solo con input', () => {
    render(
      <>
        <Field label="Unidad"><select><option>kg</option></select></Field>
        <Field label="Nota"><textarea /></Field>
      </>
    )
    expect(screen.getByLabelText('Unidad').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Nota').tagName).toBe('TEXTAREA')
  })

  // Quien ya gestiona su id lo necesita para otra cosa: no se le pisa.
  it('un id propio manda sobre el generado', () => {
    const { container } = render(<Field label="Peso"><input id="mio" /></Field>)
    expect(container.querySelector('input').id).toBe('mio')
    expect(container.querySelector('label').getAttribute('for')).toBe('mio')
  })

  it('htmlFor explícito apunta a un control de fuera', () => {
    const { container } = render(<Field label="Peso" htmlFor="externo"><input id="externo" /></Field>)
    expect(container.querySelector('label').getAttribute('for')).toBe('externo')
  })

  it('cada campo recibe un id distinto: dos «Peso» no se pisan', () => {
    const { container } = render(
      <>
        <Field label="Peso"><input /></Field>
        <Field label="Altura"><input /></Field>
      </>
    )
    const [a, b] = [...container.querySelectorAll('input')]
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })
})

describe('casos donde no hay un control único', () => {
  // Con varios hijos no hay forma de saber cuál es el control, y adivinar
  // pondría la etiqueta a apuntar al sitio equivocado.
  it('con varios hijos no revienta ni inventa un destino', () => {
    const { container } = render(
      <Field label="Rango"><input /><input /></Field>
    )
    expect(container.querySelectorAll('input')).toHaveLength(2)
    expect(container.querySelector('label').getAttribute('for')).toBeNull()
  })

  it('sin etiqueta no pinta label', () => {
    const { container } = render(<Field><input /></Field>)
    expect(container.querySelector('label')).toBeNull()
  })

  it('el hint se sigue viendo', () => {
    render(<Field label="Peso" hint="En kilos"><input /></Field>)
    expect(screen.getByText('En kilos')).toBeTruthy()
  })
})
