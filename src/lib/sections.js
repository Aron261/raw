// Raw is a hub of sections; every pathname belongs to exactly one.
const TRAINING = /^\/(menu|training|history|stats|progreso|rutinas|rutina|ejercicios|workout|exercise)(\/|$)/

export function sectionFor(pathname) {
  if (pathname === '/') return 'training'
  if (TRAINING.test(pathname)) return 'training'
  if (pathname.startsWith('/nutrition')) return 'nutrition'
  if (pathname.startsWith('/social')) return 'social'
  if (pathname.startsWith('/coach') || pathname.startsWith('/chat')) return 'coach'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'training'
}

// ¿Lleva barra de pestañas esta pantalla?
//
// La barra es Perfil · Inicio · [+] · Progreso · Rutinas, así que aparece en
// esas cinco y en las pantallas que cuelgan de ellas (un entreno, el detalle de
// una rutina, la biblioteca de ejercicios). Perfil es su propia sección —no es
// una pantalla de entreno—, pero desde que tiene pestaña la barra tiene que
// seguir ahí: una pestaña que se borra al tocarla no es una pestaña.
//
// Nutrición, Coach y Social navegan desde los chips de Inicio y sus propias
// cabeceras, así que se quedan sin barra.
export function hasTabBar(pathname) {
  const section = sectionFor(pathname)
  return section === 'training' || section === 'profile'
}
