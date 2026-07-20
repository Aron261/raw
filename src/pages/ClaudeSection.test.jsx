// @vitest-environment jsdom
// La sección de ajustes que explica cómo conectar RAW con Claude.
//
// Lo que de verdad importa aquí es que la URL sea EXACTA: si no coincide con
// los rewrites de vercel.json y con RESOURCE_URL de la Edge Function, el
// descubrimiento OAuth falla y el conector no llega a conectar. Es un dato que
// se copia a mano, así que una errata pasaría inadvertida hasta que alguien
// intentara usarlo.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('recharts', () => ({}))

import { ClaudeSection } from './Profile'

afterEach(cleanup)

const URL_ESPERADA = 'https://raw-red.vercel.app/mcp'

describe('ClaudeSection', () => {
  it('muestra la URL del conector exactamente', () => {
    render(<ClaudeSection />)
    expect(screen.getByText(URL_ESPERADA)).toBeTruthy()
  })

  it('copia la URL al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ClaudeSection />)
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))

    expect(writeText).toHaveBeenCalledWith(URL_ESPERADA)
    await waitFor(() => expect(screen.getByRole('button', { name: /copiada/i })).toBeTruthy())
  })

  // Safari sin permiso de portapapeles rechaza writeText. No debe romper la
  // pantalla ni mentir diciendo "Copiada": la URL sigue visible para copiarla a mano.
  it('no dice "Copiada" si el portapapeles falla', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })

    render(<ClaudeSection />)
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))

    await new Promise(r => setTimeout(r, 10))
    expect(screen.queryByRole('button', { name: /copiada/i })).toBeNull()
    expect(screen.getByText(URL_ESPERADA)).toBeTruthy()
  })

  it('los permisos están ocultos hasta que se piden', () => {
    render(<ClaudeSection />)
    expect(screen.queryByText(/Ver datos de otras personas/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /qué puede hacer/i }))

    // Lo que puede y —más importante— lo que no.
    expect(screen.getByText(/Crear y editar rutinas y ciclos/i)).toBeTruthy()
    expect(screen.getByText(/Registrar o cambiar entrenos y series/i)).toBeTruthy()
    expect(screen.getByText(/Cambiar tu perfil o tus objetivos de macros/i)).toBeTruthy()
    expect(screen.getByText(/Ver datos de otras personas/i)).toBeTruthy()
  })

  it('deja claro que administrador y borrado de cuenta son solo desde la app', () => {
    render(<ClaudeSection />)
    fireEvent.click(screen.getByRole('button', { name: /qué puede hacer/i }))
    expect(screen.getByText(/solo se hacen desde esta app/i)).toBeTruthy()
  })
})
