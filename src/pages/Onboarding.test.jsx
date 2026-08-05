// @vitest-environment jsdom
// La primera vez.
//
// Antes, tras el código beta se caía en Inicio sin nada configurado: saludo
// sin nombre, ejercicios naciendo en libras en una app es-CO, y las barras de
// nutrición midiéndose contra una meta inventada de 2500 kcal.
//
// Lo que importa probar: que las tres respuestas lleguen al perfil (la unidad
// manda sobre cada ejercicio nuevo, así que equivocarla se paga en cada
// sesión), y que se pueda saltar — forzar la puerta no da un perfil completo,
// da un nombre escrito de mala gana.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }),
}))

const saveProfile = vi.fn().mockResolvedValue(undefined)
const estado = { saving: false, saveError: null }
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ saveProfile, ...estado }),
}))

import Onboarding from './Onboarding'

beforeEach(() => {
  estado.saving = false
  estado.saveError = null
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('las tres preguntas', () => {
  it('guarda nombre, unidad y objetivo', async () => {
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} />)

    fireEvent.change(screen.getByLabelText('¿Cómo te llamas?'), { target: { value: 'Pedro' } })
    fireEvent.click(screen.getByText('lb'))
    fireEvent.click(screen.getByText('Perder grasa'))
    fireEvent.click(screen.getByText('Empezar'))

    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith({
      name: 'Pedro', weight_unit: 'lb', goal: 'Perder grasa',
    }))
    expect(onDone).toHaveBeenCalled()
  })

  // El kilo es el estándar donde vive la app; la libra era un accidente
  // heredado que obligaba a corregir cada ejercicio a mano.
  it('viene en kilos por defecto', async () => {
    render(<Onboarding onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText('¿Cómo te llamas?'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByText('Empezar'))
    await waitFor(() => expect(saveProfile.mock.calls[0][0].weight_unit).toBe('kg'))
  })

  it('el nombre en blanco no se guarda como cadena vacía', async () => {
    render(<Onboarding onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText('¿Cómo te llamas?'), { target: { value: '   ' } })
    fireEvent.click(screen.getByText('Empezar'))
    await waitFor(() => expect(saveProfile).toHaveBeenCalled())
    expect('name' in saveProfile.mock.calls[0][0]).toBe(false)
  })

  it('la selección se ve sin leer los colores', () => {
    render(<Onboarding onDone={() => {}} />)
    expect(screen.getByText('kg').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByText('lb'))
    expect(screen.getByText('lb').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('kg').getAttribute('aria-checked')).toBe('false')
  })
})

describe('salir sin contestar', () => {
  it('«Ahora no» entra sin guardar nada', () => {
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} />)
    fireEvent.click(screen.getByText('Ahora no'))
    expect(onDone).toHaveBeenCalled()
    expect(saveProfile).not.toHaveBeenCalled()
  })
})

describe('errores', () => {
  it('si el guardado falla, se dice y no se entra', () => {
    estado.saveError = 'No hay conexión'
    render(<Onboarding onDone={() => {}} />)
    expect(screen.getByText('No hay conexión')).toBeTruthy()
  })

  it('mientras guarda, el botón no se puede repulsar', () => {
    estado.saving = true
    render(<Onboarding onDone={() => {}} />)
    expect(screen.getByText('Guardando…').closest('button').disabled).toBe(true)
  })
})
