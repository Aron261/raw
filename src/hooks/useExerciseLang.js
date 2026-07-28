import { useCallback } from 'react'
import { useProfile } from './useProfile'
import { exerciseLabel } from '../lib/exercises'
import { exerciseTerm } from '../lib/exerciseVocab'

/*
 * The lifter's chosen language for exercise names. Identity is `library_id`;
 * this only picks the words, so switching language never touches history or
 * PRs — the same exercise just says "Press de banca con barra" or "Barbell
 * Bench Press". Custom exercises always show what the user typed.
 */
export function useExerciseLang() {
  const { profile } = useProfile()
  const lang = profile?.exercise_lang === 'en' ? 'en' : 'es'
  const label = useCallback((exercise) => exerciseLabel(exercise, lang), [lang])
  // Grupos musculares y equipo: misma familia de palabras que los nombres de
  // los ejercicios, así que siguen este idioma y no el de la interfaz.
  const term = useCallback((word) => exerciseTerm(word, lang), [lang])
  return { lang, label, term }
}
