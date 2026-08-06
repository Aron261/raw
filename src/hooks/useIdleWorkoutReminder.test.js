// @vitest-environment jsdom
// El aviso de entreno abierto.
//
// Lo que se prueba es el aviso que SIEMPRE llega: el de al volver a la app.
// La notificación depende de permisos y de que el navegador no congele el
// temporizador —en una PWA de iOS lo congela—, así que la cuenta de «cuánto he
// estado fuera» es la que no puede fallar: es la que recoge el caso cuando la
// notificación no llega.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Se apunta cada escritura para poder afirmar que NO hay ninguna con el push
// apagado. Un mock que solo devuelve vacío no distinguiría «no escribe» de
// «escribe y da igual».
const { updates } = vi.hoisted(() => ({ updates: [] }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch) => { updates.push(patch); return { eq: () => Promise.resolve({ error: null }) } },
      upsert: (row) => { updates.push(row); return Promise.resolve({ error: null }) },
    }),
  },
}))

import { useIdleWorkoutReminder, IDLE_MS } from './useIdleWorkoutReminder'
import { PUSH_ENABLED } from '../lib/push'

const KEY = 'raw_last_seen_w1'
const hace = (ms) => String(Date.now() - ms)

const montar = (over = {}) => renderHook(() => useIdleWorkoutReminder({
  workoutId: 'w1', active: true, title: 'Tu entreno sigue abierto', body: '¿Sigues?', ...over,
}))

beforeEach(() => {
  localStorage.clear()
  updates.length = 0
  // Sin permiso concedido no se programa nada: aquí solo se mira la cuenta.
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

describe('useIdleWorkoutReminder — al volver a la app', () => {
  it('pregunta si se ha estado fuera más del umbral', () => {
    localStorage.setItem(KEY, hace(IDLE_MS + 60_000))
    const { result } = montar()
    expect(result.current.awayMs).toBeGreaterThanOrEqual(IDLE_MS)
  })

  it('no pregunta por una ausencia corta', () => {
    localStorage.setItem(KEY, hace(5 * 60_000))
    const { result } = montar()
    expect(result.current.awayMs).toBe(0)
  })

  it('sin marca previa no pregunta: el entreno acaba de empezar aquí', () => {
    const { result } = montar()
    expect(result.current.awayMs).toBe(0)
  })

  it('justo en el umbral ya cuenta', () => {
    localStorage.setItem(KEY, hace(IDLE_MS))
    const { result } = montar()
    expect(result.current.awayMs).toBeGreaterThanOrEqual(IDLE_MS)
  })

  it('en un entreno ya cerrado no hay nada que recordar', () => {
    localStorage.setItem(KEY, hace(IDLE_MS + 60_000))
    const { result } = montar({ active: false })
    expect(result.current.awayMs).toBe(0)
  })

  it('deja el reloj puesto al volver, para medir la próxima ausencia', () => {
    localStorage.setItem(KEY, hace(IDLE_MS + 60_000))
    montar()
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(Date.now() - 5_000)
  })
})

describe('useIdleWorkoutReminder — respuestas', () => {
  it('«sigo entrenando» calla el aviso y reinicia la cuenta', () => {
    localStorage.setItem(KEY, hace(IDLE_MS + 60_000))
    const { result } = montar()
    expect(result.current.awayMs).toBeGreaterThan(0)

    act(() => result.current.dismiss())
    expect(result.current.awayMs).toBe(0)
    // Sin volver a sellar, el siguiente parpadeo preguntaría otra vez.
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(Date.now() - 5_000)
  })

  it('cerrar el entreno borra la marca', () => {
    localStorage.setItem(KEY, hace(60_000))
    const { result } = montar()
    act(() => result.current.clear())
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

// El push está construido pero apagado (PUSH_ENABLED en src/lib/push.js). Estas
// pruebas fijan qué significa «apagado» y se saltan solas el día que se
// encienda, para no obligar a borrarlas entonces.
describe.skipIf(PUSH_ENABLED)('useIdleWorkoutReminder — con el push apagado', () => {
  it('no sella last_seen_at: nadie mira ese dato todavía', () => {
    montar()
    expect(updates).toHaveLength(0)
  })

  it('conceder el permiso no registra ningún buzón', async () => {
    Notification.requestPermission.mockResolvedValue('granted')
    const { result } = montar()
    await act(async () => { await result.current.enableNotifications() })
    expect(updates).toHaveLength(0)
  })

  it('pero el aviso al volver sigue funcionando: nunca dependió del push', () => {
    localStorage.setItem(KEY, hace(IDLE_MS + 60_000))
    const { result } = montar()
    expect(result.current.awayMs).toBeGreaterThanOrEqual(IDLE_MS)
  })
})

describe('useIdleWorkoutReminder — permiso de notificación', () => {
  it('no se pide solo: el permiso se ofrece, no se arrebata al entrar', () => {
    montar()
    expect(Notification.requestPermission).not.toHaveBeenCalled()
  })

  it('se pide únicamente cuando se acepta el ofrecimiento', async () => {
    Notification.requestPermission.mockResolvedValue('granted')
    const { result } = montar()
    let res
    await act(async () => { res = await result.current.enableNotifications() })
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1)
    expect(res).toBe('granted')
  })

  it('sin soporte en el navegador se dice, no se revienta', async () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = montar()
    let res
    await act(async () => { res = await result.current.enableNotifications() })
    expect(res).toBe('unsupported')
  })
})
