// Los dos idiomas son independientes a propósito, y es fácil romperlo sin
// darse cuenta: basta meter una palabra de gimnasio en el diccionario de la
// interfaz. Pasó con "Glúteo" al traducir el asistente de plan — con la app en
// inglés, ese grupo muscular salía en inglés y los otros nueve en español, en
// la misma fila.

import { describe, it, expect } from 'vitest'
import { exerciseTerm } from './exerciseVocab'
import { dictionaryFor } from './i18n'
import { MUSCLE_GROUPS, CATCH_ALL, LEGACY_GROUPS } from './muscleGroups'

describe('exerciseTerm', () => {
  it('traduce el vocabulario de gimnasio', () => {
    expect(exerciseTerm('Glúteo', 'en')).toBe('Glutes')
    expect(exerciseTerm('Mancuernas', 'en')).toBe('Dumbbells')
  })

  it('en español devuelve la palabra tal cual', () => {
    expect(exerciseTerm('Glúteo', 'es')).toBe('Glúteo')
  })

  it('lo que no conoce vuelve intacto', () => {
    expect(exerciseTerm('Ejercicio propio del usuario', 'en')).toBe('Ejercicio propio del usuario')
  })

  it('cubre TODOS los grupos musculares', () => {
    // Si se añade un grupo y se olvida aquí, saldría en español dentro de una
    // lista en inglés — que es justo el fallo que esto arregla.
    const sinTraducir = [...MUSCLE_GROUPS, CATCH_ALL, ...LEGACY_GROUPS]
      .filter(g => exerciseTerm(g, 'en') === g && g !== 'Core' && g !== 'Hamstrings')
    expect(sinTraducir).toEqual([])
  })
})

describe('los dos diccionarios no se pisan', () => {
  it('ninguna palabra de gimnasio vive en el diccionario de la interfaz', () => {
    // Si estuviera en los dos, la seguiría el idioma de la app y no el de los
    // ejercicios: exactamente "el idioma de los ejercicios lo pisa el de la app".
    const ui = new Set(Object.keys(dictionaryFor('en')))
    const gym = [...MUSCLE_GROUPS, CATCH_ALL, ...LEGACY_GROUPS,
                 'Barra', 'Mancuernas', 'Poleas', 'Máquinas', 'Banco',
                 'Barra dominadas', 'Rueda abdominal', 'Sin clasificar']
    const solapan = gym.filter(w => ui.has(w))
    expect(solapan).toEqual([])
  })
})
