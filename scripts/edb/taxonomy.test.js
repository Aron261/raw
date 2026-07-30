import { describe, it, expect } from 'vitest'
import { profile, conflicts, softMismatch } from './taxonomy.js'

// El emparejamiento por parecido de texto no distingue "con banda" de "con
// barra": ambos nombres comparten casi todas las palabras. Lo que separa un
// candidato real de uno que solo se lee parecido son estos ejes, así que se
// prueban los casos concretos que fallaron al construirlo.

const lib = (name, ...equipment) => profile(name, equipment)
const edb = (name, ...equipment) => profile(name, equipment)

describe('conflictos de eje', () => {
  it('rechaza el mismo movimiento con implemento distinto', () => {
    const a = lib('Peso muerto piernas rígidas', 'barra')
    const b = edb('band straight leg deadlift', 'band')
    expect(conflicts(a, b)).toContain('implement')
  })

  it('acepta el mismo movimiento con el implemento correcto', () => {
    const a = lib('Peso muerto piernas rígidas', 'barra')
    const b = edb('barbell straight leg deadlift', 'barbell')
    expect(conflicts(a, b)).toEqual([])
  })

  it('no confunde barra con mancuerna', () => {
    const a = lib('Elevaciones frontales con barra', 'barra')
    const b = edb('dumbbell front raise', 'dumbbell')
    expect(conflicts(a, b)).toContain('implement')
  })

  // La ausencia de ángulo es "plano": la librería tiene fila propia para las
  // variantes inclinada y declinada, así que un nombre sin ángulo es el plano.
  it('rechaza declinado cuando la fila no declara ángulo', () => {
    const a = lib('Press de banca en Smith', 'smith')
    const b = edb('smith decline bench press', 'smith machine')
    expect(conflicts(a, b)).toContain('angle')
  })

  it('empareja plano con plano aunque ninguno diga "plano"', () => {
    const a = lib('Press de banca con barra', 'barra')
    const b = edb('barbell bench press', 'barbell')
    expect(conflicts(a, b)).toEqual([])
  })

  it('empareja inclinado con inclinado', () => {
    const a = lib('Press inclinado con barra', 'barra')
    const b = edb('barbell incline bench press', 'barbell')
    expect(conflicts(a, b)).toEqual([])
  })

  it('separa inclinado de declinado', () => {
    const a = lib('Press inclinado con barra', 'barra')
    const b = edb('barbell decline bench press', 'barbell')
    expect(conflicts(a, b)).toContain('angle')
  })

  it('respeta el agarre cerrado', () => {
    const a = lib('Press cerrado con barra', 'barra')
    const b = edb('barbell close grip bench press', 'barbell')
    expect(conflicts(a, b)).toEqual([])
    expect(softMismatch(a, b)).toEqual([])
  })

  it('separa agarre cerrado de agarre ancho', () => {
    const a = lib('Press cerrado con barra', 'barra')
    const b = edb('barbell wide grip bench press', 'barbell')
    expect(conflicts(a, b)).toContain('grip')
  })
})

// Agarre y lateralidad no descartan cuando solo un lado los declara, pero
// tampoco pueden pasar como emparejamiento firme.
describe('desajustes blandos', () => {
  it('deja pasar la dominada prona contra el "pull-up" a secas', () => {
    const a = lib('Dominadas agarre prono', 'peso_corporal', 'barra_dominadas')
    const b = edb('pull-up', 'body weight')
    expect(conflicts(a, b)).toEqual([])
    expect(softMismatch(a, b)).toContain('grip')
  })

  it('marca "reverse" en vez de descartarlo', () => {
    const a = lib('Curl predicador con barra EZ', 'barra')
    const b = edb('barbell reverse preacher curl', 'barbell')
    expect(conflicts(a, b)).toEqual([])
    expect(softMismatch(a, b)).toContain('grip')
  })

  it('marca un bilateral propuesto para un unilateral', () => {
    const a = lib('Extensión de cuádriceps unilateral', 'maquina')
    const b = edb('lever leg extension', 'leverage machine')
    expect(conflicts(a, b)).toEqual([])
    expect(softMismatch(a, b)).toContain('side')
  })

  // La postura es laxa a propósito: ExerciseDB casi nunca la declara, y exigirla
  // dejaría sin candidato a casi todo.
  it('tolera que falte la postura', () => {
    const a = lib('Curl con mancuernas de pie', 'mancuerna')
    const b = edb('dumbbell biceps curl', 'dumbbell')
    expect(conflicts(a, b)).toEqual([])
  })
})
