// Raw is a hub of sections; every pathname belongs to exactly one.
// 'training' keeps the bottom tab bar; the rest navigate from the hub
// (and their own back headers), so they render without tabs.
const TRAINING = /^\/(training|history|stats|rutinas|rutina|ejercicios|workout|exercise)(\/|$)/

export function sectionFor(pathname) {
  if (pathname === '/') return 'hub'
  if (TRAINING.test(pathname)) return 'training'
  if (pathname.startsWith('/nutrition')) return 'nutrition'
  if (pathname.startsWith('/longevity')) return 'longevity'
  if (pathname.startsWith('/social')) return 'social'
  if (pathname.startsWith('/coach') || pathname.startsWith('/chat')) return 'coach'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'hub'
}
