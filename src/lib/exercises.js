import { supabase } from './supabase'

/*
 * The single door through which a user's exercise is created or found.
 *
 * Identity is the library row, not the string: the `get_or_create_exercise`
 * RPC normalises what was typed (case, accents, spacing) and resolves it
 * against the library's Spanish name, English name and aliases. So "Bench
 * Press", "press de banca con barra" and "BENCH PRESS" all land on one row
 * with one history and one PR. A name with no canonical match becomes a
 * custom exercise — its own canon.
 *
 * Everything that used to `upsert({ user_id, name }, { onConflict:
 * 'user_id,name' })` must come through here; that upsert was what split
 * histories in the first place.
 */
export async function getOrCreateExerciseId(name, muscleGroup = null) {
  const clean = (name || '').trim()
  if (!clean) return null
  const { data, error } = await supabase.rpc('get_or_create_exercise', {
    p_name: clean,
    p_muscle_group: muscleGroup,
  })
  if (error) throw error
  return data
}

// Resolve many names at once, preserving the caller's spelling as the key so
// callers can map their own rows back. Sequential by design: the volumes here
// are a routine day's worth of exercises, and the RPC is a single index hit.
export async function resolveExerciseIds(names, muscleGroupByName = {}) {
  const unique = [...new Set((names || []).filter(Boolean).map(n => n.trim()))]
  const out = {}
  for (const name of unique) {
    out[name] = await getOrCreateExerciseId(name, muscleGroupByName[name] || null)
  }
  return out
}

/*
 * Which label to show. Identity lives in `library_id`; the name is only a
 * label, so a linked exercise displays its library name in the user's chosen
 * language and a custom exercise displays what the user typed.
 *
 * `exercise` may carry a joined `exercises_library` row (aliased `library`).
 */
export function exerciseLabel(exercise, lang = 'es') {
  if (!exercise) return ''
  const lib = exercise.library || exercise.exercises_library
  if (lib) {
    if (lang === 'en') return lib.name_en || lib.name || exercise.name
    return lib.name || exercise.name
  }
  return exercise.name
}
