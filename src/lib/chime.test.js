// @vitest-environment jsdom
// El aviso de fin de descanso.
//
// Lo que importa probar es la regla de iOS, que es la que hacía falta desde el
// principio: un AudioContext que no nació de un gesto no suena. Si el cebado
// deja de llamarse al arrancar el descanso, el aviso desaparece en silencio en
// iPhone y ninguna otra prueba se entera.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chimeEnabled, setChimeEnabled, primeChime, playChime, __resetChime } from './chime'

let creados

class FakeGainNode {
  constructor() { this.gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }
  connect(x) { return x }
}
class FakeOsc {
  constructor() { this.frequency = {}; this.started = [] }
  connect(x) { return x }
  start(t) { this.started.push(t) }
  stop() {}
}

class FakeCtx {
  constructor() {
    this.state = 'suspended'
    this.currentTime = 0
    this.destination = {}
    this.osc = []
    creados.push(this)
  }
  resume() { this.state = 'running' }
  createOscillator() { const o = new FakeOsc(); this.osc.push(o); return o }
  createGain() { return new FakeGainNode() }
}

beforeEach(() => {
  creados = []
  __resetChime()
  window.localStorage.clear()
  window.AudioContext = FakeCtx
})

describe('preferencia', () => {
  it('viene encendido: quien no lo sepa no puede buscar una opción que no conoce', () => {
    expect(chimeEnabled()).toBe(true)
  })

  it('apagarlo dura más que la sesión', () => {
    setChimeEnabled(false)
    expect(chimeEnabled()).toBe(false)
    expect(window.localStorage.getItem('raw.restChime')).toBe('off')
  })

  it('y se puede volver a encender', () => {
    setChimeEnabled(false)
    setChimeEnabled(true)
    expect(chimeEnabled()).toBe(true)
  })
})

describe('la regla de iOS', () => {
  it('sin cebar desde un gesto, no suena', () => {
    playChime()
    expect(creados).toHaveLength(0)
  })

  it('cebar despierta el contexto', () => {
    primeChime()
    expect(creados).toHaveLength(1)
    expect(creados[0].state).toBe('running')
  })

  it('cebado, suenan los dos tonos', () => {
    primeChime()
    playChime()
    expect(creados[0].osc).toHaveLength(2)
  })

  it('cebar dos veces reutiliza el mismo contexto', () => {
    primeChime()
    primeChime()
    expect(creados).toHaveLength(1)
  })
})

describe('apagado', () => {
  it('no ceba nada', () => {
    setChimeEnabled(false)
    primeChime()
    expect(creados).toHaveLength(0)
  })

  it('no suena aunque el contexto ya estuviera vivo', () => {
    primeChime()
    setChimeEnabled(false)
    playChime()
    expect(creados[0].osc).toHaveLength(0)
  })
})

describe('sin audio en el navegador', () => {
  it('ni cebar ni sonar tumban el entreno', () => {
    delete window.AudioContext
    delete window.webkitAudioContext
    expect(() => { primeChime(); playChime() }).not.toThrow()
  })
})
