// @vitest-environment jsdom
// Un refresco de token no puede desmontar la app.
//
// supabase-js emite un objeto `user` NUEVO en cada evento de sesión, aunque sea
// la misma persona. useBetaGate dependía de ese objeto, así que revisaba la
// aprobación otra vez y ponía loading = true; RequireAuth cambia los hijos por
// <Splash /> mientras carga, y eso desmonta la pantalla entera. En la práctica:
// el calendario perdía el mes que estabas mirando y la hoja del día se cerraba
// a medio llenar. Estas pruebas fijan que solo un cambio de PERSONA revisa.

import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'

const maybeSingle = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}))

import { AuthContext } from './useAuth'
import { useBetaGate } from './useBetaGate'

// Espejo mínimo de RequireAuth: lo que importa es que cambia los hijos por un
// marcador mientras `loading`, que es lo que provoca el desmontaje.
function Gate({ children }) {
  const beta = useBetaGate()
  if (beta.loading) return <span>splash</span>
  if (!beta.approved) return <span>gate</span>
  return children
}

// Cuenta MONTAJES, no renders: un re-render es inofensivo, lo que rompía la
// pantalla era volver a montarla (ahí es donde se pierde el estado local).
let mounts = 0
function Screen() {
  useEffect(() => { mounts++ }, [])
  return <span>pantalla</span>
}

const renderWith = (user) =>
  render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <Gate><Screen /></Gate>
    </AuthContext.Provider>
  )

beforeEach(() => {
  mounts = 0
  maybeSingle.mockReset()
  maybeSingle.mockResolvedValue({ data: { beta_approved: true }, error: null })
})
afterEach(cleanup)

describe('useBetaGate', () => {
  it('aprueba y muestra la pantalla', async () => {
    renderWith({ id: 'u1' })
    await waitFor(() => expect(screen.getByText('pantalla')).toBeTruthy())
    expect(maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('un objeto user nuevo con el mismo id no revisa ni desmonta', async () => {
    const { rerender } = renderWith({ id: 'u1' })
    await waitFor(() => expect(screen.getByText('pantalla')).toBeTruthy())
    expect(mounts).toBe(1)

    // Lo que hace supabase-js al refrescar el token: mismo id, objeto nuevo.
    await act(async () => {
      rerender(
        <AuthContext.Provider value={{ user: { id: 'u1' }, loading: false }}>
          <Gate><Screen /></Gate>
        </AuthContext.Provider>
      )
    })

    expect(screen.getByText('pantalla')).toBeTruthy()
    expect(screen.queryByText('splash')).toBeNull()
    expect(maybeSingle).toHaveBeenCalledTimes(1) // no se revisó otra vez
    expect(mounts).toBe(1)                       // no se desmontó
  })

  it('cambiar de persona sí vuelve a revisar', async () => {
    const { rerender } = renderWith({ id: 'u1' })
    await waitFor(() => expect(screen.getByText('pantalla')).toBeTruthy())

    await act(async () => {
      rerender(
        <AuthContext.Provider value={{ user: { id: 'u2' }, loading: false }}>
          <Gate><Screen /></Gate>
        </AuthContext.Provider>
      )
    })

    await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(2))
  })

  it('sin sesión no consulta y deja de cargar', async () => {
    renderWith(null)
    await waitFor(() => expect(screen.getByText('gate')).toBeTruthy())
    expect(maybeSingle).not.toHaveBeenCalled()
  })
})
