// @vitest-environment jsdom
// El selector de grasa corporal.
//
// Los tramos son para quien no sabe su número. Pero el caso que se encontró en
// cuanto se estrenó es el contrario: alguien que sí lo sabe («estoy entre 13 y
// 15») y a quien la escala obligaba a redondear a 12 o a 15. De ahí el campo
// libre — y de ahí que aquí se pruebe sobre todo lo que pasa con un valor que
// NO cae en ningún tramo.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import BodyFatPicker from './BodyFatPicker'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    lang: 'es', locale: 'es-CO',
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
  }),
}))

afterEach(cleanup)

const pintar = (props = {}) => {
  const onChange = vi.fn()
  const r = render(<BodyFatPicker sex="Masculino" value={null} onChange={onChange} {...props} />)
  return { ...r, onChange }
}

const campoLibre = (container) => container.querySelector('input[type="number"]')

describe('sin sexo en el perfil', () => {
  it('pide elegirlo en vez de enseñar la escala de hombre y callar', () => {
    pintar({ sex: null })
    expect(screen.getByText(/Elige tu sexo/)).toBeTruthy()
    expect(screen.queryByText('8%')).toBeNull()
  })

  it('«Otro» tampoco tiene una escala honesta', () => {
    pintar({ sex: 'Otro' })
    expect(screen.getByText(/Elige tu sexo/)).toBeTruthy()
  })
})

describe('la escala', () => {
  it('cambia con el sexo: los tramos no son los mismos', () => {
    const { unmount } = pintar({ sex: 'Masculino' })
    expect(screen.getByText('8%')).toBeTruthy()
    unmount()
    pintar({ sex: 'Femenino' })
    expect(screen.queryByText('8%')).toBeNull()
    expect(screen.getByText('16%')).toBeTruthy()
  })

  it('elegir un tramo devuelve su porcentaje', () => {
    const { onChange } = pintar()
    fireEvent.click(screen.getByText('15%'))
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('marca como activo solo el tramo exacto', () => {
    const { container } = pintar({ value: 15 })
    const activos = [...container.querySelectorAll('button[aria-pressed="true"]')]
    expect(activos).toHaveLength(1)
    expect(activos[0].textContent).toContain('15%')
  })
})

describe('un valor que no cae en ningún tramo', () => {
  it('no marca ninguna silueta: 14 no es 15', () => {
    const { container } = pintar({ value: 14 })
    expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0)
  })

  it('pero describe el tramo más cercano, en vez de dejar la línea en blanco', () => {
    pintar({ value: 14 })
    expect(screen.getByText('Se marcan algo, sobre todo con buena luz')).toBeTruthy()
  })

  it('y lo enseña en el campo libre', () => {
    const { container } = pintar({ value: 14 })
    expect(campoLibre(container).value).toBe('14')
  })
})

describe('el campo libre', () => {
  it('acepta un número exacto', () => {
    const { container, onChange } = pintar()
    fireEvent.change(campoLibre(container), { target: { value: '14' } })
    expect(onChange).toHaveBeenCalledWith(14)
  })

  it('admite un decimal', () => {
    const { container, onChange } = pintar()
    fireEvent.change(campoLibre(container), { target: { value: '13.5' } })
    expect(onChange).toHaveBeenCalledWith(13.5)
  })

  it('no propaga lo que la base rechazaría (el CHECK es 3-70)', () => {
    const { container, onChange } = pintar()
    // Tecleando «14» se pasa por «1», que está fuera de rango: no puede llegar
    // a guardarse ni bloquear la escritura del resto.
    fireEvent.change(campoLibre(container), { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(campoLibre(container), { target: { value: '14' } })
    expect(onChange).toHaveBeenCalledWith(14)
  })

  it('tampoco propaga un valor imposible por arriba', () => {
    const { container, onChange } = pintar()
    fireEvent.change(campoLibre(container), { target: { value: '95' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('vaciarlo deja el dato sin especificar', () => {
    const { container, onChange } = pintar({ value: 14 })
    fireEvent.change(campoLibre(container), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('se sincroniza al elegir un tramo con el dedo', () => {
    const { container, rerender, onChange } = pintar()
    fireEvent.click(screen.getByText('20%'))
    expect(onChange).toHaveBeenCalledWith(20)
    rerender(<BodyFatPicker sex="Masculino" value={20} onChange={onChange} />)
    expect(campoLibre(container).value).toBe('20')
  })
})

describe('no saberlo es una respuesta válida', () => {
  it('lo borra, y el cálculo vuelve a Mifflin', () => {
    const { onChange } = pintar({ value: 14 })
    fireEvent.click(screen.getByText('No sé / prefiero no decirlo'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('sin valor, el enlace lo dice en vez de ofrecer borrar la nada', () => {
    pintar({ value: null })
    expect(screen.getByText('Sin especificar')).toBeTruthy()
  })
})
