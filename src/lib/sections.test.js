// Qué pantallas llevan barra de pestañas. Es una decisión fácil de romper sin
// darse cuenta: basta añadir una ruta y olvidarse de que la barra desaparece.

import { describe, it, expect } from 'vitest'
import { sectionFor, hasTabBar } from './sections'

describe('hasTabBar', () => {
  it('las cuatro pestañas la llevan', () => {
    // Nutrición entró en la barra: se abre varias veces al día y llegar a ella
    // por un chip de Inicio la hacía difícil de encontrar.
    for (const p of ['/', '/progreso', '/nutrition', '/rutinas']) {
      expect(hasTabBar(p)).toBe(true)
    }
  })

  it('Perfil la conserva aunque ya no sea pestaña', () => {
    // Perfil cedió su hueco a Nutrición, pero sin barra se entra a configurar y
    // no hay forma de volver salvo el gesto de atrás del navegador.
    expect(hasTabBar('/profile')).toBe(true)
  })

  it('las pantallas que cuelgan de una pestaña también', () => {
    // Ejercicios ya no es pestaña, pero se entra desde Perfil → Entrenamiento
    // y la barra tiene que seguir ahí para poder volver.
    for (const p of ['/ejercicios', '/rutina/abc', '/workout/123', '/exercise/Press']) {
      expect(hasTabBar(p)).toBe(true)
    }
  })

  it('las secciones que se navegan desde Inicio no la llevan', () => {
    for (const p of ['/coach', '/coach/cliente/1', '/chat/2']) {
      expect(hasTabBar(p)).toBe(false)
    }
  })
})

describe('sectionFor', () => {
  it('Perfil sigue siendo su propia sección, no una pantalla de entreno', () => {
    expect(sectionFor('/profile')).toBe('profile')
    expect(sectionFor('/')).toBe('training')
  })
})
