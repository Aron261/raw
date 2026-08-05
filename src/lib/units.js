// De qué unidad parte un ejercicio nuevo.
//
// Estaba cableado a 'lb' en cuatro sitios. Raw es una app es-CO, donde el
// estándar es el kilo, así que cada ejercicio nacía en la unidad equivocada y
// había que cambiarla a mano — un toque de más repetido en cada sesión.
//
// Se deduce de `weight_unit` del perfil, la unidad en la que esa persona ya
// dijo que se pesa, en vez de inventar una preferencia nueva que habría que
// pedirle y migrar. No es infalible —hay gimnasios con discos en libras donde
// la gente se pesa en kilos— pero acierta mucho más que una constante, y la
// unidad sigue estando a un toque dentro del entreno.
//
// Sin perfil cargado todavía, kilo: es el default correcto para la mayoría y
// no el que había por accidente.
export function defaultLiftUnit(profile) {
  return profile?.weight_unit === 'lb' ? 'lb' : 'kg'
}
