// Traducción de errores de Postgres a mensajes para la persona usuaria.
//
// Nunca se devuelve el texto crudo de Postgres: lleva nombres de políticas,
// de columnas y de constraints, que es información sobre la estructura interna
// que no hace falta exponer al modelo ni al cliente.

type PgLike = { code?: string; message?: string; details?: string; hint?: string }

const BY_CODE: Record<string, string> = {
  '42501': 'No tienes permiso para esa operación.',
  'PGRST301': 'No tienes permiso para esa operación.',
  '23505': 'Ya existe un registro igual.',
  '23503': 'Ese registro está enlazado con otro y no se puede modificar así.',
  '23502': 'Falta un dato obligatorio.',
  '23514': 'Los datos no son válidos.',
  '22P02': 'Un identificador no tiene el formato correcto.',
}

// Constraints concretas con un mensaje mejor que el genérico de su código.
const BY_CONSTRAINT: Array<[RegExp, string]> = [
  [/routines_one_active_per_user/, 'Ya tienes un ciclo activo. Desactívalo antes de activar otro.'],
  [/routines_active_only_cycle_chk/, 'Solo los ciclos pueden marcarse como activos.'],
  [/routines_type_chk/, 'El tipo de rutina debe ser "cycle" o "single_day".'],
  [/routines_source_chk/, 'El origen de la rutina no es válido.'],
  [/nutrition_foods_user_id_name_norm_key/, 'Ya tienes un alimento con ese nombre.'],
  // El calendario valida sus cifras en Postgres, no solo en el formulario: el
  // conector escribe contra la misma tabla sin pasar por la interfaz.
  [/scheduled_sessions_duration_sane/, 'La duración tiene que estar entre 1 minuto y 24 horas.'],
  [/scheduled_sessions_distance_sane/, 'La distancia no parece plausible.'],
  [/scheduled_sessions_rpe_sane/, 'El esfuerzo (RPE) va de 1 a 10.'],
  [/scheduled_sessions_kind_check/, 'Ese tipo de sesión no existe.'],
  [/scheduled_sessions_status_check/, 'Ese estado de sesión no existe.'],
]

export function toSpanish(err: unknown): string {
  const e = (err ?? {}) as PgLike
  const raw = `${e.message ?? ''} ${e.details ?? ''}`

  for (const [re, msg] of BY_CONSTRAINT) if (re.test(raw)) return msg

  // Los raise exception de nuestras propias RPC ya vienen en español y son
  // seguros de mostrar: son mensajes que escribimos nosotros, no de Postgres.
  const ours = [
    'Usuario no autenticado', 'La rutina necesita un nombre', 'days debe ser un array',
    'Demasiados días', 'Demasiados ejercicios', 'Un ejercicio no tiene nombre',
    'Rutina no encontrada', 'Solo los ciclos pueden marcarse como activos',
    'No autorizado', 'Cambio no encontrado', 'Ese cambio ya se deshizo',
    'Revisión no encontrada', 'solo puede hacerse desde la app RAW',
    'Sesión no encontrada', 'Día de rutina no encontrado',
    'debe ser una fecha YYYY-MM-DD', 'debe ser uno de:',
    'Hace falta `session_id` o `series_id`',
    // Validaciones de metas (create_goal / update_goal). Sin estar aquí, un
    // "te falta el ejercicio" se convierte en "No se pudo completar la
    // operación." y el modelo no tiene forma de saber qué corregir: reintenta
    // lo mismo o se rinde. El mensaje es la mitad de la herramienta.
    'No existe un objetivo tuyo',
    'es obligatorio en las metas',
    'solo aplica a los objetivos',
    'Los objetivos de constancia',
    'tiene que ser mayor que cero',
    'debe ser "kg" o "lb"',
    'No mandaste ningún campo',
    // Perfil, ejercicios, macros y Longevidad.
    'va de 1 a 7',
    'va de 3 a 70',
    'no puede ser negativo',
    'Ejercicio no encontrado',
    'Suplemento no encontrado',
    'no puede ir vacío',
    'Todavía no hay objetivos de nutrición',
    // Huecos que ya estaban: estos tres se lanzaban desde tools.ts y llegaban
    // convertidos en el genérico, así que el modelo no podía enterarse de que
    // le faltaba confirm=true ni de que no había mandado ningún cambio.
    'hay que pasar confirm=true',
    'No hay nada que cambiar',
    'Versión no encontrada',
  ]
  for (const m of ours) if (e.message?.includes(m)) return e.message

  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code]

  return 'No se pudo completar la operación.'
}

// Se registra el detalle completo en el servidor, no en la respuesta.
export function logError(where: string, err: unknown) {
  console.error(`[mcp] ${where}:`, err)
}
