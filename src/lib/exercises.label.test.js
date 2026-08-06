// Qué nombre se pinta.
//
// La regla de la app es que el idioma manda sobre los nombres de ejercicio: un
// ejercicio de la biblioteca se lee en el idioma de la interfaz y no hay forma
// de acabar con media lista en cada idioma. `custom_name` es la única
// excepción, y es explícita: si has escrito tú el nombre, ese es el que quieres
// ver, en el idioma que sea. Estas pruebas fijan esa precedencia — es lo que
// decide si renombrar un ejercicio se ve o no se ve.

import { describe, it, expect, vi } from 'vitest'

// exercises.js también resuelve ejercicios contra la base; aquí solo se mira la
// etiqueta, que es pura.
vi.mock('./supabase', () => ({ supabase: {} }))

import { exerciseLabel } from './exercises'

const libre = { name: 'Press raro de casa' }
const deBiblioteca = {
  name: 'Bench Press',
  library: { name: 'Press de banca', name_en: 'Bench Press' },
}

describe('exerciseLabel', () => {
  it('un ejercicio propio se lee como se escribió', () => {
    expect(exerciseLabel(libre, 'es')).toBe('Press raro de casa')
    expect(exerciseLabel(libre, 'en')).toBe('Press raro de casa')
  })

  it('uno de la biblioteca sigue al idioma de la app', () => {
    expect(exerciseLabel(deBiblioteca, 'es')).toBe('Press de banca')
    expect(exerciseLabel(deBiblioteca, 'en')).toBe('Bench Press')
  })

  it('el nombre puesto a mano gana, y no se traduce', () => {
    const renombrado = { ...deBiblioteca, custom_name: 'Press plano barra' }
    expect(exerciseLabel(renombrado, 'es')).toBe('Press plano barra')
    expect(exerciseLabel(renombrado, 'en')).toBe('Press plano barra')
  })

  it('también gana en un ejercicio propio', () => {
    expect(exerciseLabel({ ...libre, custom_name: 'Press de casa' }, 'es')).toBe('Press de casa')
  })

  it('vaciarlo devuelve el nombre de siempre', () => {
    expect(exerciseLabel({ ...deBiblioteca, custom_name: null }, 'es')).toBe('Press de banca')
    expect(exerciseLabel({ ...deBiblioteca, custom_name: '   ' }, 'es')).toBe('Press de banca')
  })

  it('sin ejercicio no hay etiqueta que pintar', () => {
    expect(exerciseLabel(null, 'es')).toBe('')
  })
})
