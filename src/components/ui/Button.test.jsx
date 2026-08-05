// @vitest-environment jsdom
// El primitivo de botón.
//
// La app se exige tocables de 44px (PRODUCT.md, "designed for hostile
// conditions": una mano, dedos sudados, prisa entre series). El alto salía del
// texto más el relleno —los dos elegidos por estética— así que `md`, que es el
// tamaño por defecto y el de casi todos los botones, se quedaba en 43px y `sm`
// en 34px. Nadie lo iba a ver a ojo.
//
// Estas pruebas leen el estilo declarado, no el calculado: jsdom no maqueta,
// así que medir alturas reales aquí daría siempre cero.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Button from './Button'

afterEach(cleanup)

const alto = (nombre) => screen.getByText(nombre).style.minHeight

describe('área táctil', () => {
  it('el tamaño por defecto llega al mínimo', () => {
    render(<Button>Guardar</Button>)
    expect(alto('Guardar')).toBe('44px')
  })

  it('el pequeño también: sigue siendo algo que se toca', () => {
    render(<Button size="sm">Editar</Button>)
    expect(alto('Editar')).toBe('44px')
  })

  it('el grande mantiene su presencia', () => {
    render(<Button size="lg">Empezar entreno</Button>)
    expect(alto('Empezar entreno')).toBe('52px')
  })

  it('un size desconocido cae en el por defecto, no en cero', () => {
    render(<Button size="xs">Raro</Button>)
    expect(alto('Raro')).toBe('44px')
  })

  // El style de quien lo usa manda, pero no puede rebajar el suelo por
  // descuido: si alguien lo hace a propósito, que se vea en su código.
  it('un style propio no borra el mínimo sin decirlo', () => {
    render(<Button style={{ width: '200px' }}>Ancho</Button>)
    expect(alto('Ancho')).toBe('44px')
  })
})

describe('estados', () => {
  it('deshabilitado no se puede pulsar', () => {
    render(<Button disabled>Guardar</Button>)
    expect(screen.getByText('Guardar').closest('button').disabled).toBe(true)
  })

  it('cargando tampoco', () => {
    render(<Button loading>Guardar</Button>)
    expect(screen.getByText('Guardar').closest('button').disabled).toBe(true)
  })
})
