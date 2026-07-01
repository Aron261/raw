// Canonical muscle groups. Leg work is split into quad / hamstring / glute /
// calf (per user preference); hip adduction folds into Cuádriceps.
export const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Core',
  'Cuádriceps', 'Hamstrings', 'Glúteo', 'Gemelos',
]

// Bucket for exercises with no group assigned (own table) and none in the
// library. Shown muted and last; not a real muscle group.
export const CATCH_ALL = 'Otros'

// Groups no longer offered but that may still exist in stored data. These get
// surfaced for re-classification in the exercise manager.
export const LEGACY_GROUPS = ['Pierna']

export const isLegacyGroup = (g) => LEGACY_GROUPS.includes(g)

// Heuristic suggestion when re-classifying a legacy "Pierna" exercise (or any
// unclassified one whose name reads like leg work). Returns a group or null.
export function guessLegGroup(name) {
  const n = (name || '').toLowerCase()
  if (/calf|gemelo|pantorr|soleo|sóleo/.test(n)) return 'Gemelos'
  if (/rdl|romanian|peso muerto|deadlift|femoral|hamstring|leg curl|curl femoral|nordic/.test(n)) return 'Hamstrings'
  if (/hip ?thrust|glute|glúteo|gluteo|abduction|abducción|abducc|kickback|patada|puente|hip ?extension/.test(n)) return 'Glúteo'
  if (/squat|sentadilla|prensa|leg press|extension|extensión|zancada|lunge|búlgar|bulgar|hack|aducc|adduc|step ?up/.test(n)) return 'Cuádriceps'
  return null
}
