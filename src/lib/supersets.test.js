// La vuelta de una superserie.
//
// Lo que se prueba es la regla que no se ve: el descanso es de la vuelta, no de
// cada ejercicio. Si esto se equivoca, el cronómetro arranca entre A y B —
// justo cuando estás andando a la otra máquina— y una superserie deja de serlo.

import { describe, it, expect } from 'vitest'
import {
  groupMates, roundStep, groupLabel, canLinkNext,
  orderedBlocks, normalizeOrder, planMove, moveKind,
} from './supersets'

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

/* ── Orden ────────────────────────────────────────────────────────────── */
// La invariante: los miembros de una superserie ocupan posiciones seguidas.
// Nada de lo que se pueda hacer desde el menú puede meter un tercero en medio.

// Devuelve los ids en el orden resultante, para leer las pruebas de un vistazo.
const order = (rows) => rows.map(r => r.id)
// ¿Están seguidos los miembros de cada grupo?
const adjacent = (rows, exercises) => {
  const groupOf = (id) => exercises.find(x => x.id === id)?.group_id || null
  const seq = rows.slice().sort((a, b) => a.sort_order - b.sort_order).map(r => groupOf(r.id))
  const seen = new Set()
  let prev = null
  for (const g of seq) {
    if (g !== prev && g !== null) {
      if (seen.has(g)) return false   // el grupo reaparece: quedó partido
      seen.add(g)
    }
    prev = g
  }
  return true
}

describe('planMove — la superserie no se parte', () => {
  it('mover el suelto arriba salta la superserie entera, no se mete en medio', () => {
    const rows = planMove(session, 'c', 'up')
    expect(order(rows)).toEqual(['c', 'a', 'b'])
    expect(adjacent(rows, session)).toBe(true)
  })

  // El lado manda: desde A hacia abajo hay compañero, así que eso es reordenar
  // la vuelta. Para sacar la superserie de sitio se empuja desde su borde.
  it('desde A hacia abajo hay compañero: reordena la vuelta', () => {
    const rows = planMove(session, 'a', 'down')
    expect(order(rows)).toEqual(['b', 'a', 'c'])
    expect(adjacent(rows, session)).toBe(true)
  })

  it('desde el borde de abajo del grupo viaja el bloque entero', () => {
    const rows = planMove(session, 'b', 'down')
    expect(order(rows)).toEqual(['c', 'a', 'b'])
    expect(adjacent(rows, session)).toBe(true)
  })

  it('desde dentro del grupo cambia el orden de la vuelta, no la posición', () => {
    const rows = planMove(session, 'b', 'up')
    expect(order(rows)).toEqual(['b', 'a', 'c'])
    // …y la vuelta pasa a empezar por B.
    expect(rows.find(r => r.id === 'b').group_order).toBe(0)
    expect(rows.find(r => r.id === 'a').group_order).toBe(1)
  })

  it('no hay a dónde por arriba desde el primer bloque', () => {
    expect(planMove(session, 'a', 'up')).toBeNull()
  })

  it('renumera sin huecos, vengan como vengan los sort_order', () => {
    const gappy = [
      ex('a', { sort_order: 5, group_id: 'g1', group_order: 0 }),
      ex('b', { sort_order: 40, group_id: 'g1', group_order: 1 }),
      ex('c', { sort_order: 99 }),
    ]
    const rows = planMove(gappy, 'c', 'up')
    expect(rows.map(r => r.sort_order)).toEqual([0, 1, 2])
  })

  it('una superserie de tres viaja como una sola cosa', () => {
    const trio = [
      ex('a', { sort_order: 0, group_id: 'g', group_order: 0 }),
      ex('b', { sort_order: 1, group_id: 'g', group_order: 1 }),
      ex('c', { sort_order: 2, group_id: 'g', group_order: 2 }),
      ex('z', { sort_order: 3 }),
    ]
    const rows = planMove(trio, 'z', 'up')
    expect(order(rows)).toEqual(['z', 'a', 'b', 'c'])
  })
})

describe('orderedBlocks / normalizeOrder — reparación', () => {
  it('recompone una superserie que estaba partida por un tercero', () => {
    // Datos de antes de que la invariante existiera: c en medio de a y b.
    const split = [
      ex('a', { sort_order: 0, group_id: 'g1', group_order: 0 }),
      ex('c', { sort_order: 1 }),
      ex('b', { sort_order: 2, group_id: 'g1', group_order: 1 }),
    ]
    expect(orderedBlocks(split).map(b => b.map(x => x.id))).toEqual([['a', 'b'], ['c']])
    const rows = normalizeOrder(split)
    expect(order(rows)).toEqual(['a', 'b', 'c'])
    expect(adjacent(rows, split)).toBe(true)
  })

  it('el bloque se queda donde estaba su primer miembro', () => {
    const split = [
      ex('z', { sort_order: 0 }),
      ex('a', { sort_order: 1, group_id: 'g1', group_order: 0 }),
      ex('c', { sort_order: 2 }),
      ex('b', { sort_order: 3, group_id: 'g1', group_order: 1 }),
    ]
    expect(order(normalizeOrder(split))).toEqual(['z', 'a', 'b', 'c'])
  })

  it('sin superseries no toca nada', () => {
    const plain = [ex('a', { sort_order: 0 }), ex('b', { sort_order: 1 })]
    expect(order(normalizeOrder(plain))).toEqual(['a', 'b'])
  })
})

describe('moveKind — el menú dice qué va a mover', () => {
  it('un suelto mueve un suelto', () => {
    expect(moveKind(session, 'c', 'up')).toBe('block')
  })

  it('desde el borde del grupo mueve la superserie entera', () => {
    expect(moveKind(session, 'b', 'down')).toBe('group')
  })

  it('hacia el lado donde hay compañero, cambia el orden de la vuelta', () => {
    expect(moveKind(session, 'b', 'up')).toBe('self')
    expect(moveKind(session, 'a', 'down')).toBe('self')
  })

  it('null cuando no hay a dónde — el menú no ofrece la opción', () => {
    expect(moveKind(session, 'a', 'up')).toBeNull()
    expect(moveKind(session, 'c', 'down')).toBeNull()
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
