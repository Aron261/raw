import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/*
 * La ficha de librería de un ejercicio, a partir de su nombre.
 *
 * ExerciseDetail solo tiene el nombre —viene de la URL— y eso no basta para
 * buscar: el mismo movimiento se escribe "Press de banca", "Bench Press" o
 * "bench", según el idioma de la app y de lo que tecleara quien lo registró.
 * Resolver eso a mano aquí duplicaría la lógica que ya vive en la base.
 *
 * Así que se delega en `resolve_library_exercise`, el mismo RPC que usa
 * get_or_create_exercise: normaliza acentos y mayúsculas y compara contra
 * name, name_en y aliases, saltándose los ejercicios retirados. Si devuelve
 * null es un ejercicio propio, que no tiene ficha — ni la debe tener.
 */
export function useExerciseMedia(name) {
  const [exercise, setExercise] = useState(null)

  useEffect(() => {
    const clean = (name || '').trim()
    if (!clean) { setExercise(null); return }

    let cancelled = false
    ;(async () => {
      const { data: id, error } = await supabase
        .rpc('resolve_library_exercise', { txt: clean })
      if (cancelled || error || !id) { if (!cancelled) setExercise(null); return }

      const { data } = await supabase
        .from('exercises_library')
        .select('name, name_en, gif_url, media_reviewed, primary_muscles, secondary_muscles, equipment, description')
        .eq('id', id)
        .maybeSingle()
      if (!cancelled) setExercise(data ?? null)
    })()

    return () => { cancelled = true }
  }, [name])

  return exercise
}
