// La vuelta de una superserie.
//
// Lo que se prueba es la regla que no se ve: el descanso es de la vuelta, no de
// cada ejercicio. Si esto se equivoca, el cronómetro arranca entre A y B —
// justo cuando estás andando a la otra máquina— y una superserie deja de serlo.

import { describe, it, expect } from 'vitest'
import { groupMates, roundStep, groupLabel, canLinkNext } from './supersets'

const ex = (id, over = {}) => ({ id, sort_order: 0, group_id: null, group_order: 0, ...over })

// A + B en superserie, C suelto detrás.
const session = [
  ex('a', { sort_order: 0, group_id: 'g1', group_order: 0 }),
  ex('b', { sort_order: 1, group_id: 'g1', group_order: 1 }),
  ex('c', { sort_order: 2 }),
]
const byId = (id) => session.find(x => x.id === id)
const doneNone = () => false

describe('roundStep — descanso de la vuelta', () => {
  it('a mitad de vuelta pasa al compañero sin descansar', () => {
    expect(roundStep(session, byId('a'), doneNone)).toEqual({ rest: false, next: 'b' })
  })

  it('al cerrar la vuelta descansa y vuelve al primero', () => {
    expect(roundStep(session, byId('b'), doneNone)).toEqual({ rest: true, next: 'a' })
  })

  it('un ejercicio suelto descansa y se queda donde está', () => {
    expect(roundStep(session, byId('c'), doneNone)).toEqual({ rest: true, next: null })
  })

  it('con el compañero ya terminado deja de alternar y vuelve a descansar siempre', () => {
    const done = (x) => x.id === 'b'
    expect(roundStep(session, byId('a'), done)).toEqual({ rest: true, next: null })
  })

  it('una superserie de tres solo descansa en el último', () => {
    const trio = [
      ex('a', { group_id: 'g', group_order: 0 }),
      ex('b', { group_id: 'g', group_order: 1 }),
      ex('c', { group_id: 'g', group_order: 2 }),
    ]
    expect(roundStep(trio, trio[0], doneNone)).toEqual({ rest: false, next: 'b' })
    expect(roundStep(trio, trio[1], doneNone)).toEqual({ rest: false, next: 'c' })
    expect(roundStep(trio, trio[2], doneNone)).toEqual({ rest: true, next: 'a' })
  })

  it('la vuelta va por group_order, no por el orden en que llegan las filas', () => {
    const swapped = [
      ex('b', { group_id: 'g', group_order: 1 }),
      ex('a', { group_id: 'g', group_order: 0 }),
    ]
    expect(roundStep(swapped, swapped[1], doneNone)).toEqual({ rest: false, next: 'b' })
  })
})

describe('groupMates', () => {
  it('un ejercicio suelto no tiene compañeros', () => {
    expect(groupMates(session, byId('c'), doneNone)).toEqual([])
  })

  it('los terminados salen de la vuelta', () => {
    const mates = groupMates(session, byId('a'), (x) => x.id === 'b')
    expect(mates.map(m => m.id)).toEqual(['a'])
  })
})

describe('groupLabel', () => {
  it('etiqueta a los miembros por su orden en la vuelta', () => {
    expect(groupLabel(session, byId('a'))).toBe('A')
    expect(groupLabel(session, byId('b'))).toBe('B')
  })

  it('un ejercicio suelto no lleva galón', () => {
    expect(groupLabel(session, byId('c'))).toBeNull()
  })

  it('un grupo que se quedó con un miembro tampoco: no es una pareja', () => {
    const lonely = [ex('a', { group_id: 'g', group_order: 0 })]
    expect(groupLabel(lonely, lonely[0])).toBeNull()
  })
})

describe('canLinkNext', () => {
  it('el último de la sesión no tiene con quién unirse', () => {
    expect(canLinkNext(session, byId('c'))).toBe(false)
  })

  it('no se ofrece unir lo que ya está unido', () => {
    expect(canLinkNext(session, byId('a'))).toBe(false)
  })

  it('se puede unir con el siguiente cuando no comparten grupo', () => {
    expect(canLinkNext(session, byId('b'))).toBe(true)
  })
})
