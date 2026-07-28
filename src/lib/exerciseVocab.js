// Vocabulario del gimnasio: grupos musculares y equipo.
//
// Esto NO es texto de interfaz. Es la misma familia de palabras que los nombres
// de los ejercicios, así que sigue a `exercise_lang`, no a `app_lang`: quien
// tiene la app en inglés pero los lifts en español espera leer "Press de banca"
// y "Pecho", no "Press de banca" y "Chest".
//
// El fallo que arregla esto: al traducir el asistente de plan metí "Glúteo",
// "Mancuernas", "Poleas" y compañía en el diccionario de la app. Resultado: con
// la app en inglés, un grupo muscular salía en inglés y los otros nueve en
// español, en la misma fila. La lista era la del idioma equivocado.
//
// Igual que exerciseLabel: la identidad es la clave en español; esto solo elige
// las palabras y no toca datos ni historial.

const EN = {
  // Grupos musculares (lib/muscleGroups.js)
  'Pecho': 'Chest',
  'Espalda': 'Back',
  'Hombro': 'Shoulders',
  'Bíceps': 'Biceps',
  'Tríceps': 'Triceps',
  'Core': 'Core',
  'Cuádriceps': 'Quads',
  'Hamstrings': 'Hamstrings',
  'Glúteo': 'Glutes',
  'Gemelos': 'Calves',
  'Otros': 'Other',
  'Pierna': 'Legs',
  'Sin clasificar': 'Unsorted',

  // Equipo
  'Barra': 'Barbell',
  'Mancuernas': 'Dumbbells',
  'Poleas': 'Cables',
  'Máquinas': 'Machines',
  'Banco': 'Bench',
  'Barra dominadas': 'Pull-up bar',
  'Smith': 'Smith machine',
  'Rueda abdominal': 'Ab wheel',
  'Peso corporal': 'Bodyweight',
}

/**
 * Traduce una palabra del vocabulario de gimnasio al idioma de los EJERCICIOS.
 * Si no está, vuelve tal cual — igual que la traducción de la interfaz.
 */
export function exerciseTerm(term, lang = 'es') {
  if (lang !== 'en') return term
  return EN[term] || term
}

export const vocabularyFor = (lang) => (lang === 'en' ? EN : null)
