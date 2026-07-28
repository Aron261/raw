// Vocabulario del gimnasio: grupos musculares y equipo.
//
// Esto NO es texto de interfaz: es la misma familia de palabras que los
// nombres de los ejercicios, y viaja con ellos por useExerciseLang.
//
// Que viva fuera del diccionario de la app sigue importando aunque hoy los dos
// idiomas sean el mismo. El fallo que lo motivó: al traducir el asistente de
// plan entraron "Glúteo", "Mancuernas", "Poleas" y compañía en el diccionario
// de la interfaz, y bastaba con que a una le faltara la entrada para que un
// grupo muscular saliera en un idioma y los otros nueve en el otro, en la
// misma fila. Aquí están los diez juntos o no está ninguno.
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
