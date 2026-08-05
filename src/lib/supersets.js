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
