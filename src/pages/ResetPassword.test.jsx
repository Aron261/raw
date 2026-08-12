// @vitest-environment jsdom
// La pantalla de recuperación cambia la contraseña SIN pedir la actual: ese
// privilegio es del enlace de recuperación, no de cualquier sesión abierta.
// Si bastara con estar logueado, quien agarre un teléfono desbloqueado (o una
// sesión secuestrada) se queda con la cuenta en dos taps — exactamente lo que
// la reautenticación de "Cambiar contraseña" existe para impedir.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

let auth
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../hooks/useLang', () => ({
  useLang: () => ({ t: (k) => k, locale: 'es-CO', lang: 'es' }),
}))

import ResetPassword from './ResetPassword'

beforeEach(() => {
  auth = {
    user: { id: 'u1', email: 'pedro@example.com' },
    loading: false,
    recoverySession: false,
    setNewPassword: vi.fn(),
  }
  navigate.mockClear()
})
afterEach(cleanup)

describe('ResetPassword — solo con sesión de recuperación', () => {
  it('una sesión normal NO ve el formulario: ve enlace inválido', () => {
    render(<ResetPassword />)
    expect(screen.queryByLabelText(/nueva contraseña/i)).toBeNull()
    expect(screen.getByText(/el enlace no es válido o expiró/i)).toBeTruthy()
  })

  it('la sesión de recuperación sí ve el formulario', () => {
    auth.recoverySession = true
    render(<ResetPassword />)
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeTruthy()
  })

  it('sin sesión ninguna, enlace inválido', () => {
    auth.user = null
    render(<ResetPassword />)
    expect(screen.getByText(/el enlace no es válido o expiró/i)).toBeTruthy()
  })
})
