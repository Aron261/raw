// @vitest-environment jsdom
// La fila plegable de Estadísticas.
//
// Lo que se prueba es lo que hace que la página se pueda ojear: plegado se ve
// la cifra, abierto se ve el módulo, y el contenido se DESMONTA al plegar —
// dentro hay gráficos que miden su contenedor y uno de ancho cero los deja
// rotos al volver.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ t: (k) => k, locale: 'es-CO', lang: 'es' }),
}))

import StatSection from './StatSection'

afterEach(cleanup)

describe('StatSection', () => {
  it('plegado enseña la cifra y NO el contenido', () => {
    render(
      <StatSection label="Constancia" summary="3 por semana · ▲ 20%" open={false} onToggle={() => {}}>
        <p>contenido del módulo</p>
      </StatSection>
    )
    expect(screen.getByText('3 por semana · ▲ 20%')).toBeTruthy()
    expect(screen.queryByText('contenido del módulo')).toBeNull()
  })

  it('abierto enseña el contenido y esconde la cifra', () => {
    // Abierto el módulo ya pinta su número en grande: repetirlo sería ruido.
    render(
      <StatSection label="Constancia" summary="3 por semana" open onToggle={() => {}}>
        <p>contenido del módulo</p>
      </StatSection>
    )
    expect(screen.getByText('contenido del módulo')).toBeTruthy()
    expect(screen.queryByText('3 por semana')).toBeNull()
  })

  it('el título sale siempre, plegado o no', () => {
    const { rerender } = render(
      <StatSection label="Volumen" summary="x" open={false} onToggle={() => {}}><p>c</p></StatSection>
    )
    expect(screen.getByText('Volumen')).toBeTruthy()
    rerender(<StatSection label="Volumen" summary="x" open onToggle={() => {}}><p>c</p></StatSection>)
    expect(screen.getByText('Volumen')).toBeTruthy()
  })

  it('sin cifra no deja una línea vacía', () => {
    render(
      <StatSection label="Volumen" summary={null} open={false} onToggle={() => {}}><p>c</p></StatSection>
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('avisa a lectores de pantalla si está desplegado', () => {
    const { rerender } = render(
      <StatSection label="Volumen" summary="x" open={false} onToggle={() => {}}><p>c</p></StatSection>
    )
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')
    rerender(<StatSection label="Volumen" summary="x" open onToggle={() => {}}><p>c</p></StatSection>)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
  })

  it('pulsar la fila entera alterna', () => {
    const onToggle = vi.fn()
    render(<StatSection label="Volumen" summary="x" open={false} onToggle={onToggle}><p>c</p></StatSection>)
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
