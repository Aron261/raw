// Raw is a hub of sections; every pathname belongs to exactly one.
const TRAINING = /^\/(menu|training|history|stats|progreso|rutinas|rutina|ejercicios|workout|exercise)(\/|$)/

export function sectionFor(pathname) {
  if (pathname === '/') return 'training'
  if (TRAINING.test(pathname)) return 'training'
  if (pathname.startsWith('/calendario')) return 'calendar'
  if (pathname.startsWith('/nutrition')) return 'nutrition'
  if (pathname.startsWith('/coach') || pathname.startsWith('/chat')) return 'coach'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'training'
}

// ¿Lleva barra de pestañas esta pantalla?
//
// La barra es Inicio · Progreso · [+] · Nutrición · Rutinas, así que aparece en
// esas pantallas y en las que cuelgan de ellas (un entreno, el detalle de una
// rutina, la biblioteca de ejercicios).
//
// Perfil ya no es pestaña —lo sustituyó Nutrición, que se abre a diario— pero
// SÍ conserva la barra: sin ella se entra a configurar y no hay forma de volver
// más que con el gesto de atrás del navegador.
//
// Coach y Calendario siguen sin barra: se navega a ellos desde los chips de
// Inicio y sus propias cabeceras. El calendario en particular NO es pestaña a
// propósito — Raw es rotacional, y hacerlo espina dorsal invertiría eso.
export function hasTabBar(pathname) {
  const section = sectionFor(pathname)
  return section === 'training' || section === 'profile' || section === 'nutrition'
}
