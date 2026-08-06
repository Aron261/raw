// Superseries: quién va con quién y qué pasa al cerrar una serie.
//
// No hay carta de superserie. Siguen siendo dos ejercicios y dos cartas — lo
// único que cambia es que la baraja se mueve sola entre ellas y que el descanso
// es de la VUELTA, no de cada ejercicio. Entre A y B se va andando a la otra
// máquina; descansar ahí es justo lo que una superserie no hace.
//
// Estas reglas viven aparte de la pantalla porque son cuentas, no pintura: si
// se equivocan, el cronómetro suena cuando no toca y la baraja te deja en la
// carta que no era.

// Los compañeros de superserie de un ejercicio, en el orden de la vuelta.
// Los que ya están terminados salen: si cierras A a mitad de la superserie, B
// se queda haciéndose solo en vez de mandarte a una carta cerrada.
export function groupMates(exercises, we, isDone = () => false) {
  if (!we?.group_id) return []
  return exercises
    .filter(x => x.group_id === we.group_id && !isDone(x))
    .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
}

// Qué hacer al marcar una serie como hecha.
//   { rest: true, next: null }        → ejercicio suelto: descansa y no te muevas
//   { rest: false, next: 'id-de-B' }  → mitad de vuelta: a por el compañero, sin descanso
//   { rest: true,  next: 'id-de-A' }  → vuelta cerrada: descansa y vuelve al primero
//
// Un grupo de un solo miembro (porque el otro ya se terminó, o porque quedó
// suelto al separarlo) se comporta como un ejercicio suelto: alternar con nadie
// no es alternar.
export function roundStep(exercises, we, isDone = () => false) {
  const mates = groupMates(exercises, we, isDone)
  if (mates.length < 2) return { rest: true, next: null }

  const i = mates.findIndex(x => x.id === we.id)
  if (i === -1) return { rest: true, next: null }

  const isLastOfRound = i === mates.length - 1
  return { rest: isLastOfRound, next: mates[(i + 1) % mates.length].id }
}

// «A», «B», «C» dentro de la superserie. Null cuando no hay superserie que
// etiquetar — un grupo de uno no es una pareja, es un ejercicio.
export function groupLabel(exercises, we) {
  if (!we?.group_id) return null
  const all = exercises
    .filter(x => x.group_id === we.group_id)
    .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
  if (all.length < 2) return null
  const i = all.findIndex(x => x.id === we.id)
  return i >= 0 ? String.fromCharCode(65 + i) : null
}

// ¿Se puede unir este ejercicio con el siguiente de la sesión? No, si es el
// último, y no, si ya son de la misma superserie.
export function canLinkNext(exercises, we) {
  const ordered = [...exercises].sort((a, b) => a.sort_order - b.sort_order)
  const i = ordered.findIndex(x => x.id === we.id)
  if (i === -1 || i === ordered.length - 1) return false
  return !(we.group_id && ordered[i + 1].group_id === we.group_id)
}

/* ── Orden de la sesión ──────────────────────────────────────────────────
 *
 * La sesión no es una lista de ejercicios, es una lista de BLOQUES: un
 * ejercicio suelto es un bloque de uno y una superserie es un bloque de todos
 * sus miembros. Los miembros de una superserie van juntos y punto — separarlos
 * no significa nada, porque lo que hace superserie a una superserie es que se
 * alterna sin soltar el sitio.
 *
 * Esa invariante se sostiene aquí, en el orden, y no en la pantalla: si se
 * dejara suelta, cualquier «mover arriba» podría meter una sentadilla entre A
 * y B y la barra de la regleta pasaría a unir dos tramos que ya no se tocan.
 */

// Los bloques, en el orden en que se ven. Un bloque de superserie se coloca
// donde esté su primer miembro y por dentro va en el orden de la vuelta.
//
// Ojo: los miembros se recogen por group_id, no por estar pegados. Así una
// superserie que hubiera quedado partida —datos de antes de que esto
// existiera— se recompone sola en cuanto se toca el orden.
export function orderedBlocks(exercises) {
  const ordered = [...exercises].sort((a, b) => a.sort_order - b.sort_order)
  const placed = new Set()
  const out = []
  for (const we of ordered) {
    if (placed.has(we.id)) continue
    if (!we.group_id) {
      placed.add(we.id)
      out.push([we])
      continue
    }
    const members = ordered
      .filter(x => x.group_id === we.group_id)
      .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
    members.forEach(m => placed.add(m.id))
    out.push(members)
  }
  return out
}

// Aplanar bloques a filas numeradas. Salir de aquí ya garantiza la invariante:
// los miembros de un grupo quedan en posiciones seguidas, se venga de donde se
// venga.
function flatten(blocks) {
  const rows = []
  for (const block of blocks) {
    block.forEach((we, i) => {
      rows.push({ id: we.id, sort_order: rows.length, group_order: block.length > 1 ? i : 0 })
    })
  }
  return rows
}

// Renumerar sin mover nada. Repara adyacencia y hace de red después de unir.
export function normalizeOrder(exercises) {
  return flatten(orderedBlocks(exercises))
}

// Qué haría un «mover arriba/abajo» desde este ejercicio:
//   'self'  → cambiar el orden de la vuelta (tiene un compañero de ese lado)
//   'group' → mover la superserie entera por encima/debajo del bloque vecino
//   'block' → mover un ejercicio suelto
//   null    → no hay a dónde
//
// Se expone para poder DECIRLO en el menú. Que el mismo botón mueva una cosa u
// otra según dónde estés solo es aceptable si la etiqueta lo dice antes de
// tocarlo; si no, es un botón que hace dos cosas y no avisa.
export function moveKind(exercises, weId, dir) {
  const blocks = orderedBlocks(exercises)
  const bi = blocks.findIndex(b => b.some(x => x.id === weId))
  if (bi === -1) return null
  const block = blocks[bi]
  const delta = dir === 'up' ? -1 : 1

  if (block.length > 1) {
    const mi = block.findIndex(x => x.id === weId)
    const target = mi + delta
    if (target >= 0 && target < block.length) return 'self'
  }

  const tb = bi + delta
  if (tb < 0 || tb >= blocks.length) return null
  return block.length > 1 ? 'group' : 'block'
}

// El orden resultante de ese movimiento, ya numerado. Null si no hay a dónde.
export function planMove(exercises, weId, dir) {
  const blocks = orderedBlocks(exercises)
  const bi = blocks.findIndex(b => b.some(x => x.id === weId))
  if (bi === -1) return null
  const block = blocks[bi]
  const delta = dir === 'up' ? -1 : 1

  // Dentro de la superserie: cambia quién va primero en la vuelta.
  if (block.length > 1) {
    const mi = block.findIndex(x => x.id === weId)
    const target = mi + delta
    if (target >= 0 && target < block.length) {
      const swapped = [...block]
      ;[swapped[mi], swapped[target]] = [swapped[target], swapped[mi]]
      const next = [...blocks]
      next[bi] = swapped
      return flatten(next)
    }
  }

  // Desde el borde: viaja el bloque entero, superserie incluida.
  const tb = bi + delta
  if (tb < 0 || tb >= blocks.length) return null
  const next = [...blocks]
  ;[next[bi], next[tb]] = [next[tb], next[bi]]
  return flatten(next)
}
