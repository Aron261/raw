// @vitest-environment jsdom
// pressable() existe por un fallo concreto y fácil de repetir: pressProps ya
// define onMouseLeave para soltar la escala, así que un {...pressProps()} puesto
// encima de un onMouseLeave propio se lo comía y el borde resaltado se quedaba
// pegado al salir el ratón.

import { describe, it, expect, vi } from 'vitest'
import { pressProps, pressable } from './ui'

const evt = (transition = '') => ({ currentTarget: { style: { transition } } })

describe('pressable', () => {
  it('escala al tocar y suelta al levantar', () => {
    const p = pressable(0.9)
    const down = evt(); p.onTouchStart(down)
    expect(down.currentTarget.style.transform).toBe('scale(0.9)')

    const up = evt(); p.onTouchEnd(up)
    expect(up.currentTarget.style.transform).toBe('scale(1)')
  })

  it('no pisa el onMouseLeave de quien lo usa: encadena los dos', () => {
    const mine = vi.fn()
    const p = pressable(0.97, { onMouseLeave: mine })
    const e = evt()
    p.onMouseLeave(e)
    // El mío se ejecuta...
    expect(mine).toHaveBeenCalledOnce()
    // ...y la escala también vuelve a su sitio.
    expect(e.currentTarget.style.transform).toBe('scale(1)')
  })

  it('deja pasar los handlers que no toca', () => {
    const onClick = vi.fn()
    const onMouseEnter = vi.fn()
    const p = pressable(0.97, { onClick, onMouseEnter })
    expect(p.onClick).toBe(onClick)
    p.onMouseEnter(evt())
    expect(onMouseEnter).toHaveBeenCalledOnce()
  })

  it('el táctil es el que importa: existe sin depender del ratón', () => {
    // En un móvil el hover no existe. Un control que solo reacciona a
    // onMouseEnter no reacciona a nada.
    const p = pressable()
    expect(typeof p.onTouchStart).toBe('function')
    expect(typeof p.onTouchEnd).toBe('function')
  })

  it('se añade la transición de transform si el control no la tenía', () => {
    // El estilo inline gana a la hoja de estilos: sin esto, un botón con su
    // propia transition de color soltaba la escala de golpe.
    const p = pressable()
    const e = evt('color 150ms var(--ease-out)')
    p.onTouchStart(e)
    expect(e.currentTarget.style.transition).toContain('color 150ms')
    expect(e.currentTarget.style.transition).toContain('transform')
  })

  it('no la duplica si ya estaba', () => {
    const p = pressable()
    const e = evt('transform 200ms linear')
    p.onTouchStart(e)
    expect(e.currentTarget.style.transition).toBe('transform 200ms linear')
  })

  it('pressProps sigue funcionando igual para quien ya lo usaba', () => {
    const p = pressProps(0.95)
    const e = evt(); p.onMouseDown(e)
    expect(e.currentTarget.style.transform).toBe('scale(0.95)')
  })
})
