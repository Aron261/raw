// Traducción de la interfaz.
//
// La clave ES el texto en español. No hay `t('training.week_label')` que se
// pueda quedar desincronizado ni renderizar "training.week_label" en pantalla
// si alguien se equivoca al escribirlo: si una cadena no está traducida, sale
// en español, que es exactamente lo que la app hace hoy. Con ~440 cadenas y una
// sola persona manteniéndolas, esa red de seguridad vale más que unas claves
// bonitas.
//
// El plural no necesita maquinaria: español e inglés comparten la misma regla
// (uno / lo demás) y el código ya elige la forma con un ternario. Se traduce
// cada forma por separado — t(n === 1 ? 'entreno' : 'entrenos').
//
// El idioma de la interfaz es independiente del de los nombres de ejercicio
// (useExerciseLang): alguien puede querer la app en español y los ejercicios en
// inglés, que es justo para lo que existe aquel ajuste.

export const LANGS = ['es', 'en']
export const DEFAULT_LANG = 'es'

// Para fechas y números. La app se escribió contra es-CO.
const LOCALES = { es: 'es-CO', en: 'en-US' }
export const localeFor = (lang) => LOCALES[lang] || LOCALES[DEFAULT_LANG]

export const normalizeLang = (v) => (LANGS.includes(v) ? v : DEFAULT_LANG)

// ── Diccionario ──────────────────────────────────────────────────────────
// Solo `en`: el español es la clave. Ordenado por dónde aparece.
const EN = {
  // ── Genérico ──
  'Guardar': 'Save',
  'Guardando...': 'Saving...',
  'Cancelar': 'Cancel',
  'Cerrar': 'Close',
  'Eliminar': 'Delete',
  'Editar': 'Edit',
  'Reintentar': 'Retry',
  'Volver': 'Back',
  'Deshacer': 'Undo',
  'Empezar': 'Start',
  'Continuar': 'Continue',
  'Sin conexión': 'Offline',
  'Sin conexión · no se guardó': 'Offline · not saved',
  'No se guardó': 'Not saved',
  'días': 'days',
  'día': 'day',
  'semana': 'week',
  'semanas': 'weeks',
  'reps': 'reps',
  'rep': 'rep',

  // ── Barra inferior ──
  'Inicio': 'Home',
  'Progreso': 'Progress',
  'Rutinas': 'Routines',
  'Perfil': 'Profile',
  'Agregar': 'Add',

  // ── Inicio ──
  'Buenos días': 'Good morning',
  'Buenas tardes': 'Good afternoon',
  'Buenas noches': 'Good evening',
  'Esta semana': 'This week',
  'entreno': 'workout',
  'entrenos': 'workouts',
  'días este mes': 'days this month',
  'racha': 'streak',
  'kcal hoy': 'kcal today',
  'peso corporal': 'body weight',
  'coach': 'coach',
  'próximo': 'up next',
  'Entrena esta semana': 'Train this week',
  'Registra tu comida': 'Log your food',
  'Aún sin registrar': 'Not logged yet',
  'Toca un día para planear': 'Tap a day to plan',
  'Tus clientes': 'Your clients',
  'sin leer': 'unread',
  'Entreno de hoy': "Today's workout",
  'Ciclo activo': 'Active cycle',
  'Empezar entreno': 'Start workout',
  'Empezar entreno libre': 'Start a free workout',
  'Continuar entreno': 'Continue workout',
  'Creando entreno...': 'Creating workout...',
  'Sin ejercicios todavía': 'No exercises yet',
  'ejercicio': 'exercise',
  'ejercicios': 'exercises',
  'Volumen semanal': 'Weekly volume',
  'Sin entrenos registrados esta semana': 'No workouts logged this week',
  'Mejor marca esta semana': "This week's best",
  'Nuevo récord': 'New record',
  'Mayor progreso': 'Biggest gain',
  'Mejor levantamiento': 'Best lift',
  'Tu mejor 1RM estimado de todos los tiempos.': 'Your best estimated 1RM of all time.',
  'Superaste tu mejor registro en este ejercicio.': 'You beat your best on this exercise.',
  'Mis metas': 'My goals',
  'Nueva meta': 'New goal',
  'Crear meta': 'Create goal',
  'Agregar meta': 'Add goal',
  'Todavía no tienes metas activas.': "You don't have any active goals yet.",
  'Define una meta de fuerza o frecuencia para medir tu progreso real.': 'Set a strength or frequency goal to measure real progress.',
  'Registra tu primer entreno': 'Log your first workout',
  'Anota tus series y Raw te dice al instante si superas tu última marca. Toca «Empezar entreno» arriba.':
    'Log your sets and Raw tells you straight away whether you beat your last mark. Tap "Start workout" above.',
  'No pudimos cargar tus entrenos.': "We couldn't load your workouts.",
  'Recomendado por': 'Recommended by',
  'tu entrenador': 'your trainer',
  'De tu entrenador': 'From your trainer',
  'Creando...': 'Creating...',

  // ── Comparación de series ──
  'vs. la vez anterior': 'vs. last time',
  'Igual que la vez anterior': 'Same as last time',
  'más que la vez anterior': 'more than last time',
  'menos que la vez anterior': 'less than last time',
  'repetición': 'rep',
  'repeticiones': 'reps',
  'de 1RM estimado': 'of estimated 1RM',

  // ── Metas ──
  'Meta cumplida. Crea una nueva.': 'Goal reached. Set a new one.',
  'Ya casi. Te falta poco.': 'Almost there.',
  'Vas por la mitad. Sigue así.': 'Halfway. Keep going.',
  'Buen arranque. Mantén el ritmo.': 'Good start. Keep the pace.',
  'Apenas empiezas. Suma tu próximo entreno.': 'Just getting started. Add your next workout.',
  'Tipo de meta': 'Goal type',
  'Peso en ejercicio': 'Exercise weight',
  'Días entrenados': 'Days trained',
  'Nombre de la meta': 'Goal name',
  'Peso objetivo': 'Target weight',
  'Reps objetivo': 'Target reps',
  'Guardar meta': 'Save goal',

  // ── Calendario ──
  'Calendario de entrenamiento': 'Training calendar',
  'Mes': 'Month',
  'Semana': 'Week',
  'Ir a hoy': 'Go to today',
  'Hecho': 'Done',
  'Fuerza': 'Strength',
  'Cardio': 'Cardio',
  'Movilidad': 'Mobility',
  'Descanso': 'Rest',
  'Descarga': 'Deload',
  'Nota': 'Note',
  'Semana de descarga': 'Deload week',
  'Semana anterior': 'Previous week',
  'Semana siguiente': 'Next week',
  'Mes anterior': 'Previous month',
  'Mes siguiente': 'Next month',

  // ── Perfil ──
  'Tu perfil': 'Your profile',
  'Mis características': 'About me',
  'Añade tus datos': 'Add your details',
  'Entrenamiento': 'Training',
  'Apariencia': 'Appearance',
  'Cuenta': 'Account',
  'Panel de administración': 'Admin panel',
  'Estado de la app, usuarios y actividad': 'App status, users and activity',
  'Perfil y ajustes': 'Profile and settings',
  'Objetivo principal': 'Main goal',
  'Días que entrenas por semana': 'Days you train per week',
  'Objetivo, frecuencia y ejercicios': 'Goal, frequency and exercises',
  'Mis ejercicios': 'My exercises',
  'Clasifica por grupo muscular y vincula los que no reconoció': 'Sort by muscle group and link the ones it didn’t recognise',
  'Peso corporal': 'Body weight',
  'Sin registros — anota el primero': 'No entries — log the first one',
  'Ver historial': 'View history',
  'Registrar': 'Log',
  'Cerrar sesión': 'Sign out',
  'Tema': 'Theme',
  'Auto': 'Auto',
  'Claro': 'Light',
  'Oscuro': 'Dark',
  'Paleta': 'Palette',
  'Sobrio': 'Sober',
  'Vibrante': 'Vibrant',
  'Calmado': 'Calm',
  'Con color': 'With colour',
  'Idioma': 'Language',
  'Idioma de la app': 'App language',
  'Nombre de los ejercicios': 'Exercise names',
  'Solo cambia cómo se llaman. Tu historial y tus récords son los mismos en cualquier idioma.':
    'Only changes what they are called. Your history and records are the same in any language.',
  'Cambia los textos de la app. No toca los nombres de los ejercicios.':
    'Changes the app’s wording. Does not touch exercise names.',
  'Nombre': 'Name',
  'Tu nombre': 'Your name',
  'Fecha de nacimiento': 'Date of birth',
  'Ganar músculo': 'Build muscle',
  'Perder grasa': 'Lose fat',
  'Resistencia': 'Endurance',
  'Mantener': 'Maintain',

  // ── Entreno activo ──
  'Sin ejercicios aún': 'No exercises yet',
  'Agrega tu primer ejercicio para empezar a registrar tus series.': 'Add your first exercise to start logging sets.',
  'Mostrar series': 'Show sets',
  'nuevo': 'new',
  'Serie': 'Set',
  'Quitar serie': 'Remove set',
  'Completar serie': 'Complete set',
  'Deshacer serie': 'Undo set',
  'Reintentar guardar serie': 'Retry saving set',
  'Subir peso serie': 'Increase weight set',
  'Bajar peso serie': 'Decrease weight set',
  'Descartar entreno': 'Discard workout',
  'Unidad': 'Unit',
  'Tocar para cambiar a': 'Tap to switch to',
  'Cambiar a': 'Switch to',

  // ── Historial · Progreso ──
  'Historial': 'History',
  'Estadísticas': 'Statistics',
  'Vista de progreso': 'Progress view',
  'Sin entrenos aún': 'No workouts yet',
  'Cada sesión que registres aparece aquí, agrupada por mes.': 'Every session you log shows up here, grouped by month.',
  'No tienes ningún módulo activo. Elige cuáles quieres ver y aparecerán aquí.':
    'You have no active modules. Pick the ones you want and they will show up here.',

  // ── Biblioteca de ejercicios ──
  'Todavía no hay ejercicios': 'No exercises yet',
  'Aparecen aquí solos en cuanto registras tu primer entreno. Desde aquí los ordenas por grupo muscular.':
    'They show up here on their own once you log your first workout. This is where you sort them by muscle group.',
  'Sin clasificar': 'Unsorted',

  // ── Rutinas ──
  'Sin rutinas guardadas': 'No saved routines',
  'Crea un ciclo semanal o una rutina puntual para empezar.': 'Create a weekly cycle or a one-off routine to get started.',
  'Este día está vacío. Añade el primer ejercicio y la rutina ya sabrá qué toca.':
    'This day is empty. Add the first exercise and the routine will know what is up.',
  'Sin ciclo activo': 'No active cycle',

  // ── Nutrición ──
  'Nutrición': 'Nutrition',
  'Nada anotado todavía. Toca «+» para añadir.': 'Nothing logged yet. Tap "+" to add.',
  'Añadir comida': 'Add food',
  'Registrar peso': 'Log weight',
  'Crear rutina': 'Create routine',
  'Tu peso corporal de hoy': "Today's body weight",

  // ── Auth ──
  'Iniciar sesión': 'Sign in',
  'Crear cuenta': 'Create account',
  'Contraseña': 'Password',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
}

const DICTS = { en: EN }

/**
 * Traduce. La clave es el texto en español; si no está traducida, vuelve tal
 * cual — nunca se ve una clave cruda en pantalla.
 *
 * Interpola {nombre}: t('{n} días este mes', { n: 12 }).
 */
export function translate(lang, key, vars) {
  const dict = DICTS[lang]
  let out = (dict && dict[key]) || key
  if (vars) {
    for (const k of Object.keys(vars)) {
      out = out.replaceAll(`{${k}}`, String(vars[k]))
    }
  }
  return out
}

// Para pruebas y para auditar qué falta por traducir.
export const dictionaryFor = (lang) => DICTS[lang] || null
