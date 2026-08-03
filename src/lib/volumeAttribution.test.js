// La regla del medio estímulo se aplica ahora en cuatro sitios —historial,
// generador, gráfico del ciclo, balance muscular— y todos pasan por aquí. Si
// esta función se equivoca, los cuatro mienten a la vez y del mismo modo, que
// es la clase de error que nadie nota.

import { describe, it, expect } from 'vitest'
import {
  SECONDARY_FACTOR, attributeSplit, totalOf, roundHalf, resolveMuscles, indexLibrary,
} from './volumeAttribution'
import { CATCH_ALL } from './muscleGroups'

const PRESS = { group: 'Pecho', secondaries: ['Tríceps', 'Hombro'] }

describe('attributeSplit', () => {
  it('el principal cobra entero y los secundarios la mitad', () => {
    expect(attributeSplit(3, PRESS)).toEqual({
      'Pecho':   { direct: 3, indirect: 0 },
      'Tríceps': { direct: 0, indirect: 1.5 },
      'Hombro':  { direct: 0, indirect: 1.5 },
    })
  })

  it('el total por grupos supera a las series hechas, que es el punto', () => {
    const acc = attributeSplit(3, PRESS)
    const suma = Object.values(acc).reduce((s, e) => s + totalOf(e), 0)
    expect(suma).toBe(6)   // 3 series reales → 6 de estímulo repartido
  })

  it('acumula sobre el mismo objeto entre ejercicios', () => {
    const acc = attributeSplit(3, PRESS)
    attributeSplit(4, { group: 'Tríceps', secondaries: [] }, acc)
    expect(acc['Tríceps']).toEqual({ direct: 4, indirect: 1.5 })
    expect(totalOf(acc['Tríceps'])).toBe(5.5)
  })

  it('un secundario repetido no cobra dos veces', () => {
    const acc = attributeSplit(4, { group: 'Espalda', secondaries: ['Bíceps', 'Bíceps'] })
    expect(acc['Bíceps'].indirect).toBe(2)
  })

  it('un secundario que ya es el principal no dobla', () => {
    // Pasa cuando el usuario reclasifica su ejercicio al grupo que la
    // biblioteca tenía como secundario.
    const acc = attributeSplit(4, { group: 'Tríceps', secondaries: ['Tríceps', 'Hombro'] })
    expect(acc['Tríceps']).toEqual({ direct: 4, indirect: 0 })
    expect(acc['Hombro'].indirect).toBe(2)
  })

  it('sin secundarios cuenta solo el principal', () => {
    expect(attributeSplit(3, { group: 'Bíceps' })).toEqual({
      'Bíceps': { direct: 3, indirect: 0 },
    })
  })

  it('ignora lo que no se puede atribuir', () => {
    expect(attributeSplit(0, PRESS)).toEqual({})
    expect(attributeSplit(3, { group: null, secondaries: ['Pecho'] })).toEqual({})
    expect(attributeSplit(3, undefined)).toEqual({})
  })

  it('no muta el array de secundarios que recibe', () => {
    const secondaries = ['Tríceps', 'Hombro']
    attributeSplit(3, { group: 'Pecho', secondaries })
    expect(secondaries).toEqual(['Tríceps', 'Hombro'])
  })

  it('sirve igual para kilos que para series', () => {
    const acc = attributeSplit(1000, PRESS)
    expect(acc['Tríceps'].indirect).toBe(1000 * SECONDARY_FACTOR)
  })
})

describe('roundHalf', () => {
  it('conserva las medias series', () => {
    expect(roundHalf(1.5)).toBe(1.5)
    expect(roundHalf(13.25)).toBe(13.5)
    expect(roundHalf(13.24)).toBe(13)
    expect(roundHalf(0)).toBe(0)
  })
})

describe('resolveMuscles', () => {
  const lib = { muscle_group: 'Pecho', secondary_muscles: ['Tríceps'] }

  it('la clasificación del usuario manda sobre la biblioteca', () => {
    expect(resolveMuscles({ muscle_group: 'Hombro' }, lib))
      .toEqual({ group: 'Hombro', secondaries: ['Tríceps'] })
  })

  it('sin clasificación propia usa la biblioteca', () => {
    expect(resolveMuscles(null, lib)).toEqual({ group: 'Pecho', secondaries: ['Tríceps'] })
  })

  it('un ejercicio inventado por el usuario no aporta secundarios', () => {
    expect(resolveMuscles({ muscle_group: 'Core' }, null))
      .toEqual({ group: 'Core', secondaries: [] })
  })

  it('sin nada cae en el cajón de sastre', () => {
    expect(resolveMuscles(null, null)).toEqual({ group: CATCH_ALL, secondaries: [] })
  })
})

describe('indexLibrary', () => {
  const library = [
    { id: 'lib-1', name: 'Press de banca con barra', muscle_group: 'Pecho' },
    { id: 'lib-2', name: 'Remo con barra', muscle_group: 'Espalda' },
  ]

  it('resuelve por library_id aunque el nombre no coincida', () => {
    const { lookup } = indexLibrary(library)
    expect(lookup({ library_id: 'lib-1', name: 'press banca' })?.muscle_group).toBe('Pecho')
  })

  it('cae al nombre cuando no hay enlace', () => {
    const { lookup } = indexLibrary(library)
    expect(lookup({ name: 'Remo con barra' })?.muscle_group).toBe('Espalda')
  })

  it('devuelve null si no lo conoce', () => {
    const { lookup } = indexLibrary(library)
    expect(lookup({ name: 'Ejercicio raro del gimnasio de abajo' })).toBeNull()
    expect(lookup(null)).toBeNull()
  })
})
