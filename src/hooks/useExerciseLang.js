import { useCallback } from 'react'
import { exerciseLabel } from '../lib/exercises'
import { exerciseTerm } from '../lib/exerciseVocab'
import { useLang } from './useLang'

/*
 * El idioma de los nombres de ejercicio. Sigue al de la app.
 *
 * Hubo una etapa con dos ajustes independientes —se podía tener la interfaz
 * en inglés y los lifts en español—, y la flexibilidad no compensaba: era una
 * segunda dimensión que duplicaba lo que hay que verificar en cada pantalla, y
 * daba pantallas mezcladas con la mitad de las palabras en un idioma y la
 * otra mitad en el otro. Una app en inglés dice "Barbell Bench Press"; una en
 * español, "Press de banca con barra".
 *
 * La identidad de un ejercicio es `library_id`: esto solo elige las palabras,
 * así que cambiar de idioma nunca toca el historial ni los récords. Los
 * ejercicios propios siempre muestran lo que escribió quien los creó.
 *
 * profiles.exercise_lang sigue existiendo en la base y ya no la lee ni la
 * escribe nadie. Borrarla es una migración destructiva que esto no necesita.
 */
export function useExerciseLang() {
  const { lang } = useLang()
  const label = useCallback((exercise) => exerciseLabel(exercise, lang), [lang])
  // Grupos musculares y equipo: misma familia de palabras que los nombres de
  // los ejercicios, así que van por aquí y no por el diccionario de la interfaz.
  const term = useCallback((word) => exerciseTerm(word, lang), [lang])
  return { lang, label, term }
}
