// Raw is a hub of sections; every pathname belongs to exactly one.
// The home ("/") is the Hoy dashboard of the training section, which keeps
// the bottom tab bar (Menú · Hoy · + · Progreso · Rutinas). The remaining
// sections (Nutrición, Coach, Perfil) navigate from the Menú index and their
// own back headers, so they render without tabs.
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
