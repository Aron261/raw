// Catálogo de herramientas del servidor MCP de RAW.
//
// Reglas de diseño:
//   1. Verbos concretos. No hay herramienta de SQL genérico, ni argumentos que
//      nombren tablas o columnas. Una capacidad que no tiene herramienta
//      sencillamente no existe: no está bloqueada, no hay código que la escriba.
//   2. Lo que puede escribirse lo decide public.agent_writable_tables(), no
//      esta lista de herramientas: una herramienta que falte es una omisión,
//      una tabla fuera de esa función es una garantía. Quedan fuera a propósito
//      workouts/workout_exercises/sets, exercises_library (es global y
//      compartida), agent_writes (el propio rastro de auditoría) y
//      trainer_clients / push_subscriptions (conceden acceso, no son datos).
//   3. Los entrenos registrados son de SOLO LECTURA. El outbox offline
//      (src/lib/outbox.js) puede reenviar una escritura vieja horas después y
//      pisar o resucitar filas; escribir sets desde fuera corrompería ese flujo.
//      Es el único bloqueo que sobrevive por una razón técnica y no de criterio.
//   4. Cada consulta filtra por user_id, además de pasar por RLS. La RLS no
//      basta y creerlo costó una fuga: en la app un entrenador SÍ puede leer y
//      editar los datos de sus clientes, así que una consulta que se apoye solo
//      en ella devuelve, desde el conector de un entrenador, datos de gente que
//      nunca autorizó la conexión. Lo vigila un test en guardrails.test.js.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { MICRO_HINT, sanitizeMicros, sumMicros, countCovered } from './nutrients.ts'

type Ctx = { supabase: SupabaseClient; userId: string }
type Tool = {
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, any>, ctx: Ctx) => Promise<unknown>
}

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: 'object', properties: props, required, additionalProperties: false,
})
const str = (description: string) => ({ type: 'string', description })
const num = (description: string) => ({ type: 'number', description })
const bool = (description: string) => ({ type: 'boolean', description })

// Los micros llegan como objeto suelto para no tener que declarar diecisiete
// argumentos. La frase sobre omitir claves hace trabajo de verdad: sin ella un
// modelo servicial rellena las diecisiete claves con ceros y destruye la
// cuenta de cuántas comidas traen datos reales.
const MICROS_ARG = {
  type: 'object',
  description: `Micronutrientes con su unidad fija: ${MICRO_HINT}. Omite las que no conozcas — una clave ausente significa "desconocido", NO cero. No inventes valores: si solo sabes fibra y sodio, manda solo esos dos. ` +
    'IMPORTANTE con los dos azúcares: `azucar` es el TOTAL (incluye el de la fruta, la leche y las verduras) y `azucar_anadido` es solo el que alguien le echó a la comida — azúcar de mesa, jarabes, miel, concentrados de zumo, y el que traen los productos procesados. ' +
    'Un refresco, una galleta o un yogur de sabores llevan los dos. Una manzana, un yogur natural o un vaso de leche llevan `azucar` y ningún añadido: ahí omite `azucar_anadido` — como con cualquier clave, no se manda cero. ' +
    'En productos envasados de EE. UU. el añadido viene en la etiqueta como "Includes Xg Added Sugars". Si no lo sabes, omítelo en vez de copiar el total ahí: confundirlos convierte un día de fruta en una alarma.',
  additionalProperties: { type: 'number' },
}

const MEALS = ['desayuno', 'almuerzo', 'cena', 'snack']

// El calendario. Estos valores son los mismos CHECK que la tabla, así que un
// tipo inventado lo rechaza Postgres aunque el esquema de aquí se quede atrás.
const SESSION_KINDS = ['strength', 'cardio', 'mobility', 'rest', 'deload', 'note']

// Los mismos cuatro que acepta el check de `goals` (supabase/goals.sql). Si
// esta lista y aquella se separan, el conector vuelve a proponer tipos que la
// base rechaza.
const GOAL_TYPES = ['exercise_weight', 'body_weight', 'sessions_per_week', 'days_trained']
const SESSION_STATUSES = ['planned', 'done', 'skipped']

// Valores que acepta la base. Van como enum en el esquema de la herramienta
// para que el modelo elija bien a la primera en vez de descubrirlo con un
// error de restricción; Postgres sigue siendo quien manda.
const LEVELS = ['Principiante', 'Intermedio', 'Avanzado']
const PROFILE_GOALS = ['Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener']
const SEXES = ['Masculino', 'Femenino', 'Otro']
const ACTIVITY_LEVELS = ['sedentario', 'ligero', 'moderado', 'alto', 'muy_alto']
const NUTRITION_PHASES = ['definicion', 'mantener', 'volumen']
const BODY_FAT_SOURCES = ['estimado', 'medido']
const LANGS = ['es', 'en']
const WEIGHT_UNITS = ['kg', 'lb']
const HEIGHT_UNITS = ['cm', 'ft']

// Espeja MUSCLE_GROUPS + CATCH_ALL de src/lib/muscleGroups.js. Un grupo que no
// esté aquí cae en «Otros» al repartir volumen, así que inventarse uno saca al
// ejercicio del balance muscular sin decir nada.
const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps',
  'Core', 'Cuádriceps', 'Hamstrings', 'Glúteo', 'Gemelos', 'Otros',
]

// Los mismos momentos que ofrece la pantalla de Longevidad.
const SUPPLEMENT_TIMING = ['AM', 'PM', 'Pre-entreno', 'Con comida', 'Antes de dormir']

// Tope de ocurrencias de una serie. Espeja MAX_SERIES_OCCURRENCES de
// src/lib/schedule.js: sin él, "ponme cardio todas las semanas" escribe filas
// hasta que alguien lo pare.
const MAX_SERIES_OCCURRENCES = 26

// Solo una fecha local YYYY-MM-DD; cualquier otra cosa se descarta en vez de
// llegar a Postgres como un rango medio interpretado.
// "Hoy" es el hoy de la PERSONA, no el del servidor. Las edge functions corren
// en UTC: sin esto, una cena registrada desde Claude a las 8pm de Bogotá caía
// en el día siguiente y "cómo voy hoy" respondía con un día vacío. La zona la
// sella la app en profiles.timezone; sin ella (perfil viejo), UTC como antes.
const localDay = (tz: string | null, shiftDays = 0): string => {
  const d = new Date()
  if (shiftDays) d.setUTCDate(d.getUTCDate() + shiftDays)
  try {
    // en-CA formatea YYYY-MM-DD, que es exactamente el formato de eaten_on/date.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

const userTimezone = async (supabase: SupabaseClient, userId: string): Promise<string | null> => {
  const { data } = await supabase.from('profiles').select('timezone')
    .eq('id', userId).maybeSingle()
  return (data?.timezone as string | null) || null
}

const isoDate = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

// Nulo es "no lo sé", nunca cero: media hora de bici sin cuentakilómetros no
// son 0 km, y guardarlo como 0 lo convertiría en un dato falso.
const optNum = (v: unknown, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

// Este conector habla SOLO de la cuenta de quien lo conectó, y eso es lo que
// promete la pantalla de consentimiento. Pero la RLS de la app es más ancha a
// propósito: un entrenador puede leer y editar las rutinas, los entrenos y la
// nutrición de sus clientes desde la app. Delegar el alcance en la RLS haría
// que el conector de un entrenador arrastrase datos de gente que no autorizó
// nada. Por eso cada herramienta filtra por user_id además de la RLS, y las
// que pasan por una RPC comprueban antes de quién es la fila.
async function assertOwnRoutine(supabase: any, userId: string, routineId: string) {
  const own = unwrap(await supabase.from('routines').select('id')
    .eq('id', routineId).eq('user_id', userId).maybeSingle())
  if (!own) throw new Error('Rutina no encontrada.')
}

const clamp = (n: unknown, def: number, max: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : def
  return Math.max(1, Math.min(v, max))
}

// Lanza si Supabase devolvió error; si no, devuelve los datos.
const unwrap = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error
  return r.data
}

const EXERCISE_ITEM = {
  type: 'object',
  properties: {
    exercise_name: str('Nombre del ejercicio. Usa search_exercise_library antes para dar con el nombre exacto.'),
    sets: num('Número de series'),
    reps: str('Repeticiones como texto libre: "8-12", "5x5", "30-45 seg", "al fallo"'),
    rest_seconds: num('Descanso en segundos'),
    notes: str('Nota breve para ese ejercicio'),
    muscle_group: str('Grupo muscular, opcional'),
  },
  required: ['exercise_name'],
  additionalProperties: false,
}

const DAY_ITEM = {
  type: 'object',
  properties: {
    day_name: str('Nombre del día: "Día 1", "Lunes", "Push"…'),
    focus: str('Enfoque del día: "Push", "Pull", "Pierna", "Full Body"…'),
    exercises: { type: 'array', items: EXERCISE_ITEM, description: 'Ejercicios en orden' },
  },
  required: ['day_name', 'exercises'],
  additionalProperties: false,
}

export const TOOLS: Record<string, Tool> = {

  // ── LECTURA ─────────────────────────────────────────────────────────────

  get_profile: {
    description: 'Perfil de la persona usuaria: nombre, nivel, objetivo, días por semana, sexo, altura, peso y composición corporal (grasa, nivel de actividad, fase de nutrición). Se edita con update_profile. Estos son los INSUMOS con los que la app calcula los objetivos de macros; los objetivos ya aceptados están en get_nutrition_day.',
    inputSchema: obj({}),
    handler: async (_a, { supabase, userId }) =>
      unwrap(await supabase.from('profiles')
        .select('id,name,birth_date,sex,weight,weight_unit,height,height_unit,level,goal,days_per_week,is_trainer,exercise_lang,app_lang,body_fat_pct,body_fat_source,activity_level,nutrition_phase')
        .eq('id', userId).maybeSingle()),
  },

  list_routines: {
    description: 'Lista las rutinas: ciclos (varios días) y rutinas de un día. Marca cuál es el ciclo activo.',
    inputSchema: obj({
      type: { ...str('Filtra por formato'), enum: ['cycle', 'single_day'] },
      include_days: bool('Si es true incluye días y ejercicios de cada rutina'),
    }),
    handler: async (a, { supabase, userId }) => {
      const cols = a.include_days
        ? 'id,name,description,type,source,goal,level,days_per_week,is_active,created_at,routine_days(day_name,day_order,focus,routine_day_exercises(exercise_name,exercise_order,sets,reps,rest_seconds,notes))'
        : 'id,name,description,type,source,goal,level,days_per_week,is_active,created_at'
      let q = supabase.from('routines').select(cols)
        .eq('user_id', userId).order('created_at', { ascending: false })
      if (a.type) q = q.eq('type', a.type)
      return unwrap(await q)
    },
  },

  get_routine: {
    description: 'Devuelve una rutina completa con sus días y ejercicios en orden.',
    inputSchema: obj({ routine_id: str('ID de la rutina') }, ['routine_id']),
    handler: async (a, { supabase, userId }) => {
      // routine_snapshot es security invoker, así que su RLS deja ver también
      // las rutinas de un cliente si quien pregunta es su entrenador. Este
      // conector solo habla de la cuenta propia: se comprueba antes de mirar.
      const own = unwrap(await supabase.from('routines').select('id')
        .eq('id', a.routine_id).eq('user_id', userId).maybeSingle())
      if (!own) return null
      return unwrap(await supabase.rpc('routine_snapshot', { p_routine_id: a.routine_id }))
    },
  },

  get_active_cycle: {
    description: 'Devuelve el ciclo activo con todos sus días y ejercicios. Es el plan que la persona está siguiendo ahora mismo.',
    inputSchema: obj({}),
    handler: async (_a, { supabase, userId }) =>
      unwrap(await supabase.from('routines')
        .select('id,name,description,goal,level,days_per_week,routine_days(day_name,day_order,focus,routine_day_exercises(exercise_name,exercise_order,sets,reps,rest_seconds,notes))')
        .eq('user_id', userId).eq('is_active', true).maybeSingle()),
  },

  list_workouts: {
    description: 'Entrenos registrados, del más reciente al más antiguo, con sus ejercicios y series. SOLO LECTURA: los entrenos se registran desde la app, no desde aquí.',
    inputSchema: obj({
      since: str('Fecha inicial ISO (YYYY-MM-DD)'),
      until: str('Fecha final ISO (YYYY-MM-DD)'),
      limit: num('Máximo de entrenos (por defecto 30, máximo 200)'),
    }),
    handler: async (a, { supabase, userId }) => {
      let q = supabase.from('workouts')
        .select('id,name,notes,started_at,ended_at,routine_id,routine_day_id,source,workout_exercises(sort_order,unit,exercises(name,muscle_group),sets(set_number,reps,weight))')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(clamp(a.limit, 30, 200))
      if (a.since) q = q.gte('started_at', a.since)
      if (a.until) q = q.lte('started_at', a.until)
      return unwrap(await q)
    },
  },

  get_workout: {
    description: 'Un entreno concreto con todos sus ejercicios y series.',
    inputSchema: obj({ workout_id: str('ID del entreno') }, ['workout_id']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('workouts')
        .select('id,name,notes,started_at,ended_at,source,workout_exercises(sort_order,unit,notes,exercises(name,muscle_group),sets(set_number,reps,weight))')
        .eq('id', a.workout_id).eq('user_id', userId).maybeSingle()),
  },

  get_exercise_history: {
    description: 'Historial de series de un ejercicio a lo largo del tiempo, con peso, repeticiones y 1RM estimado. Sirve para ver progresión antes de planificar.',
    inputSchema: obj({
      exercise_name: str('Nombre del ejercicio'),
      limit: num('Máximo de series (por defecto 100, máximo 500)'),
    }, ['exercise_name']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('public_workout_summary')
        .select('*').eq('user_id', userId).ilike('exercise_name', a.exercise_name)
        .order('started_at', { ascending: false }).limit(clamp(a.limit, 100, 500))),
  },

  search_exercise_library: {
    description: 'Busca en la biblioteca de ejercicios de RAW por nombre en español o inglés. ÚSALA SIEMPRE ANTES de crear o editar una rutina: guardar un nombre que no está en la biblioteca rompe en silencio el seguimiento del progreso del ciclo. Ojo con los términos ambiguos: "sentadillas" no existe como tal, existen "Sentadilla con barra", "Sentadilla frontal", "Sentadilla goblet"… Si el término es ambiguo, pregunta cuál antes de guardar.',
    inputSchema: obj({
      query: str('Texto a buscar'),
      limit: num('Máximo de resultados (por defecto 15, máximo 50)'),
    }, ['query']),
    handler: async (a, { supabase }) => {
      const lim = clamp(a.limit, 15, 50)
      const exact = unwrap(await supabase.rpc('suggest_library_matches', { p_name: a.query, p_limit: lim }))
      if (Array.isArray(exact) && exact.length) return exact
      // Por la RPC y no por un .or() con el texto interpolado: la gramática de
      // filtros de PostgREST trata las comas y los paréntesis como sintaxis, así
      // que una búsqueda con una coma reescribía el filtro. La RPC además
      // normaliza igual que el resto de la biblioteca.
      return unwrap(await supabase.rpc('search_exercise_library', { q: a.query, lim }))
    },
  },

  list_goals: {
    description: 'Objetivos de entrenamiento de la persona usuaria, cumplidos incluidos. `start_value` es de dónde partió: el progreso se mide (actual − start_value) / (objetivo − start_value), así que una meta sin él se cuenta desde cero. `completed_at` no nulo significa cumplida y archivada. `target_date` es la fecha límite, si tiene.',
    inputSchema: obj({}),
    handler: async (_a, { supabase, userId }) =>
      unwrap(await supabase.from('goals').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false })),
  },

  get_nutrition_day: {
    description: 'Comidas registradas de un día, con los totales (macros y micros) y los objetivos. Los objetivos son de SOLO LECTURA: se fijan en la app, donde se calculan a partir del peso, la grasa corporal y la fase. Si `targets.protein_locked` es true, esa persona ha fijado su proteína a mano y no quiere que se la recalculen: no le propongas otra cifra. `micros_coverage` dice de cuántas comidas se conocen micros — sin ese dato, un total de micros bajo puede ser falta de información y no falta de nutrientes.',
    inputSchema: obj({ date: str('Fecha YYYY-MM-DD. Por defecto, hoy.') }),
    handler: async (a, { supabase, userId }) => {
      const day = a.date || localDay(await userTimezone(supabase, userId))
      const [entries, targets] = await Promise.all([
        supabase.from('nutrition_entries').select('*')
          .eq('user_id', userId).eq('eaten_on', day).order('created_at'),
        supabase.from('nutrition_targets').select('*').eq('user_id', userId).maybeSingle(),
      ])
      const rows = unwrap(entries) as any[]
      const sum = (k: string) => rows.reduce((t, r) => t + Number(r[k] || 0), 0)
      return {
        date: day,
        entries: rows,
        totals: {
          kcal: sum('kcal'), protein_g: sum('protein_g'),
          carbs_g: sum('carbs_g'), fat_g: sum('fat_g'),
          micros: sumMicros(rows.map(r => r.micros)),
        },
        micros_coverage: { with_micros: countCovered(rows.map(r => r.micros)), total: rows.length },
        targets: unwrap(targets),
      }
    },
  },

  list_nutrition_foods: {
    description: 'Alimentos guardados por la persona usuaria, con sus macros y micros por porción de referencia. Reutilízalos al registrar comidas para no inventar valores.',
    inputSchema: obj({ query: str('Filtra por nombre'), limit: num('Máximo (por defecto 30, máximo 100)') }),
    handler: async (a, { supabase, userId }) => {
      let q = supabase.from('nutrition_foods').select('*').eq('user_id', userId)
        .order('times_used', { ascending: false }).limit(clamp(a.limit, 30, 100))
      if (a.query) q = q.ilike('name', `%${a.query}%`)
      return unwrap(await q)
    },
  },

  get_body_weight: {
    description: 'Registros de peso corporal, del más reciente al más antiguo.',
    inputSchema: obj({ limit: num('Máximo (por defecto 60, máximo 365)') }),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('body_weight_logs').select('*').eq('user_id', userId)
        .order('logged_at', { ascending: false }).limit(clamp(a.limit, 60, 365))),
  },

  list_exercises: {
    description: 'Los ejercicios de esta persona, con su grupo muscular. `muscle_group` nulo significa SIN CLASIFICAR: ese ejercicio cae en «Otros» y su volumen no se reparte en el balance muscular, así que clasificarlo con update_exercise mejora las estadísticas. `custom_name` es el nombre que ella le puso encima; `name` es la clave con la que se resuelve y no se toca.',
    inputSchema: obj({
      unclassified_only: bool('Si es true, solo los que no tienen grupo muscular'),
    }),
    handler: async (a, { supabase, userId }) => {
      let q = supabase.from('exercises')
        .select('id,name,custom_name,muscle_group,library_id,created_at')
        .eq('user_id', userId).order('name')
      if (a.unclassified_only) q = q.is('muscle_group', null)
      return unwrap(await q)
    },
  },

  list_supplements: {
    description: 'El stack de suplementos, con su dosis y en qué momentos se toma. `taken_today` dice si ya se marcó hoy.',
    inputSchema: obj({ include_inactive: bool('Incluir los desactivados') }),
    handler: async (a, { supabase, userId }) => {
      const today = localDay(await userTimezone(supabase, userId))
      let q = supabase.from('supplements')
        .select('id,name,dose,timing,note,is_active,sort_order')
        .eq('user_id', userId).order('sort_order')
      if (!a.include_inactive) q = q.eq('is_active', true)
      const rows = unwrap(await q) as any[]
      const logs = unwrap(await supabase.from('supplement_logs')
        .select('supplement_id').eq('user_id', userId).eq('taken_on', today)) as any[]
      const taken = new Set((logs || []).map(l => l.supplement_id))
      return { date: today, supplements: (rows || []).map(r => ({ ...r, taken_today: taken.has(r.id) })) }
    },
  },

  list_bloodwork: {
    description: 'Analíticas de sangre por marcador, de la más reciente a la más antigua. `ref_low` y `ref_high` son el rango de referencia del laboratorio, que cambia entre laboratorios: compara siempre contra el que venga en la propia fila y no contra un rango de memoria. Esta sección NO tiene pantalla en la app todavía, así que esto es lo único que la lee.',
    inputSchema: obj({
      marker: str('Filtra por marcador, p. ej. "Ferritina"'),
      limit: num('Máximo (por defecto 100, máximo 500)'),
    }),
    handler: async (a, { supabase, userId }) => {
      let q = supabase.from('bloodwork_results')
        .select('id,panel_date,marker,value,unit,ref_low,ref_high,note')
        .eq('user_id', userId)
        .order('panel_date', { ascending: false })
        .limit(clamp(a.limit, 100, 500))
      if (a.marker) q = q.ilike('marker', a.marker)
      return unwrap(await q)
    },
  },

  list_schedule: {
    description: 'El calendario de entrenamiento entre dos fechas: qué hay planeado y qué se cumplió. `kind` es "strength" (fuerza), "cardio", "mobility" (movilidad), "rest" (descanso), "deload" (semana de descarga) o "note". `status` es "planned", "done" o "skipped". En cardio y movilidad, duration_min / distance_km / rpe son lo que de verdad se hizo — un nulo significa "no se sabe", no cero. OJO: esto es la capa de PLANIFICACIÓN, no el historial. Los entrenos de fuerza registrados de verdad, con sus series, están en list_workouts; una sesión de fuerza aquí solo dice que se pensaba hacer.',
    inputSchema: obj({
      from: str('Desde (YYYY-MM-DD). Por defecto, hace 30 días.'),
      to: str('Hasta (YYYY-MM-DD). Por defecto, dentro de 60 días.'),
      kind: { ...str('Filtra por tipo de sesión'), enum: SESSION_KINDS },
      status: { ...str('Filtra por estado'), enum: SESSION_STATUSES },
    }),
    handler: async (a, { supabase, userId }) => {
      // La ventana por defecto se ancla al hoy LOCAL de la persona; cerca de
      // medianoche el hoy UTC ya es otro día y se caían sesiones del borde.
      const tz = (isoDate(a.from) && isoDate(a.to)) ? null : await userTimezone(supabase, userId)
      const day = (offset: number) => localDay(tz, offset)
      let q = supabase.from('scheduled_sessions')
        .select('id,date,kind,title,status,notes,routine_id,routine_day_id,series_id,duration_min,distance_km,rpe')
        .eq('user_id', userId)
        .gte('date', isoDate(a.from) || day(-30))
        .lte('date', isoDate(a.to) || day(60))
        .order('date', { ascending: true })
      if (a.kind) q = q.eq('kind', a.kind)
      if (a.status) q = q.eq('status', a.status)
      return unwrap(await q)
    },
  },

  list_recent_changes: {
    description: 'Cambios hechos por asistentes de IA en esta cuenta, del más reciente al más antiguo. Cada uno se puede revertir con undo_change.',
    inputSchema: obj({ limit: num('Máximo (por defecto 20, máximo 100)') }),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('agent_writes')
        .select('id,table_name,op,row_id,undone_at,created_at').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(clamp(a.limit, 20, 100))),
  },

  list_routine_revisions: {
    description: 'Versiones guardadas de una rutina. Cada edición guarda una antes de cambiar nada, así que se puede volver atrás con restore_routine_revision.',
    inputSchema: obj({ routine_id: str('ID de la rutina') }, ['routine_id']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('routine_revisions')
        .select('id,reason,actor,created_at')
        .eq('routine_id', a.routine_id).eq('user_id', userId)
        .order('created_at', { ascending: false })),
  },

  // ── ESCRITURA ───────────────────────────────────────────────────────────

  create_routine: {
    description: 'Crea una rutina completa (ciclo de varios días o rutina de un día) en una sola operación atómica. Devuelve "normalized": cómo quedó guardado cada nombre de ejercicio, y sugerencias cuando el nombre era ambiguo. Revisa ese campo y cuéntale a la persona cualquier nombre que no coincidiera. La rutina se crea SIEMPRE inactiva; usa set_active_cycle si quiere empezarla.',
    inputSchema: obj({
      name: str('Nombre de la rutina'),
      type: { ...str('"cycle" para varios días, "single_day" para una sesión suelta'), enum: ['cycle', 'single_day'] },
      description: str('Descripción o resumen del plan'),
      goal: str('Objetivo: "Hipertrofia", "Fuerza", "Resistencia"…'),
      level: str('Nivel: "Principiante", "Intermedio", "Avanzado"'),
      days_per_week: num('Días por semana'),
      days: { type: 'array', items: DAY_ITEM, description: 'Días en orden, cada uno con sus ejercicios' },
    }, ['name', 'type', 'days']),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.rpc('create_routine_tree', {
        p: {
          name: a.name, type: a.type, source: 'manual',
          description: a.description ?? null, goal: a.goal ?? null,
          level: a.level ?? null, days_per_week: a.days_per_week ?? null,
          days: a.days ?? [],
        },
      })),
  },

  update_routine: {
    description: 'Reemplaza los días y ejercicios de una rutina existente. Guarda una versión anterior antes de cambiar nada, así que siempre se puede deshacer. Los días que ya tienen entrenos registrados se conservan para no perder el historial (lo indica "kept_days").',
    inputSchema: obj({
      routine_id: str('ID de la rutina'),
      name: str('Nuevo nombre, opcional'),
      description: str('Nueva descripción, opcional'),
      goal: str('Nuevo objetivo, opcional'),
      level: str('Nuevo nivel, opcional'),
      days_per_week: num('Nuevos días por semana, opcional'),
      days: { type: 'array', items: DAY_ITEM, description: 'Días completos en orden. Reemplazan a los actuales.' },
    }, ['routine_id', 'days']),
    handler: async (a, { supabase, userId }) => {
      await assertOwnRoutine(supabase, userId, a.routine_id)
      return unwrap(await supabase.rpc('update_routine_tree', {
        p_routine_id: a.routine_id,
        p: {
          name: a.name ?? null, description: a.description ?? null,
          goal: a.goal ?? null, level: a.level ?? null,
          days_per_week: a.days_per_week ?? null, days: a.days ?? [],
        },
      }))
    },
  },

  rename_routine: {
    description: 'Cambia solo los datos de cabecera de una rutina (nombre, descripción, objetivo, nivel) sin tocar los días ni los ejercicios.',
    inputSchema: obj({
      routine_id: str('ID de la rutina'),
      name: str('Nuevo nombre'), description: str('Nueva descripción'),
      goal: str('Nuevo objetivo'), level: str('Nuevo nivel'),
    }, ['routine_id']),
    handler: async (a, { supabase, userId }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of ['name', 'description', 'goal', 'level']) if (a[k] != null) patch[k] = a[k]
      return unwrap(await supabase.from('routines').update(patch)
        .eq('id', a.routine_id).eq('user_id', userId)
        .select('id,name,description,goal,level').maybeSingle())
    },
  },

  delete_routine: {
    description: 'Borra una rutina con todos sus días y ejercicios. Requiere confirm=true de forma explícita. Confírmalo con la persona antes de llamarla.',
    inputSchema: obj({
      routine_id: str('ID de la rutina'),
      confirm: bool('Debe ser true. Sirve para que un borrado nunca ocurra por accidente.'),
    }, ['routine_id', 'confirm']),
    handler: async (a, { supabase, userId }) => {
      if (a.confirm !== true) throw new Error('Para borrar una rutina hay que pasar confirm=true.')
      unwrap(await supabase.from('routines').delete()
        .eq('id', a.routine_id).eq('user_id', userId))
      return { deleted: true, routine_id: a.routine_id }
    },
  },

  set_active_cycle: {
    description: 'Marca un ciclo como activo (desactiva el anterior). Pasa routine_id=null para quedarse sin ciclo activo. Solo los ciclos pueden activarse.',
    inputSchema: obj({ routine_id: { type: ['string', 'null'], description: 'ID del ciclo, o null para desactivar' } }, ['routine_id']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.rpc('set_active_routine', {
        p_routine_id: a.routine_id ?? null, p_user_id: userId,
      })),
  },

  create_goal: {
    // Los tipos que anunciaba ("strength", "bodyweight") no existen en la
    // tabla: el check de `goals` solo acepta los cuatro de abajo, así que toda
    // meta creada siguiendo esta descripción moría con un error de
    // restricción. Ahora van como enum, que además los valida antes de llegar
    // a la base.
    description: 'Crea un objetivo de entrenamiento. `start_value` es el punto de partida (lo que la persona levanta o pesa HOY): sin él el progreso se mide desde cero y una meta de sentadilla 90 → 100 nace al 90 %. Búscalo antes con get_exercise_history; en body_weight se toma solo de la báscula si no lo mandas. `target_date` (YYYY-MM-DD) añade plazo y permite decir si va a tiempo. Las metas de constancia (days_trained, sessions_per_week) se miden contra su ventana y no llevan ni inicio ni plazo.',
    inputSchema: obj({
      type: {
        ...str('Tipo: "exercise_weight" (peso en un ejercicio), "body_weight" (peso corporal), "sessions_per_week" (días por semana) o "days_trained" (días al mes)'),
        enum: GOAL_TYPES,
      },
      label: str('Texto que describe el objetivo'),
      target_value: num('Valor a alcanzar'),
      exercise_name: str('Ejercicio asociado, obligatorio en exercise_weight'),
      unit: str('Unidad: "kg" o "lb". En metas de constancia se ignora'),
      target_reps: num('Repeticiones objetivo, si aplica'),
      start_value: num('Punto de partida en la misma unidad, para medir el tramo propuesto'),
      target_date: str('Fecha límite YYYY-MM-DD, opcional'),
      is_monthly: bool('Si es un objetivo mensual'),
    }, ['type', 'label', 'target_value']),
    handler: async (a, { supabase, userId }) => {
      if (!GOAL_TYPES.includes(a.type)) {
        throw new Error(`\`type\` debe ser uno de: ${GOAL_TYPES.join(', ')}.`)
      }
      // Sin ejercicio, una meta de peso en ejercicio se queda clavada en 0 %
      // para siempre y nada explica por qué.
      if (a.type === 'exercise_weight' && !a.exercise_name) {
        throw new Error('`exercise_name` es obligatorio en las metas de tipo exercise_weight.')
      }

      const recurring = a.type === 'days_trained' || a.type === 'sessions_per_week'
      const unit = recurring ? 'días' : (a.unit ?? 'kg')

      // En peso corporal el inicio no es un adorno: es lo que da DIRECCIÓN. Sin
      // él no se sabe si 76 kg es bajar o subir, así que si no viene se toma de
      // la última pesada.
      let startValue = a.start_value ?? null
      if (!recurring && startValue == null && a.type === 'body_weight') {
        const last = unwrap(await supabase.from('body_weight_logs')
          .select('weight, unit')
          .eq('user_id', userId)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle()) as any
        if (last?.weight != null) {
          const kg = last.unit === 'lb' ? last.weight * 0.453592 : last.weight
          startValue = unit === 'lb'
            ? Math.round((kg / 0.453592) * 10) / 10
            : Math.round(kg * 10) / 10
        }
      }

      return unwrap(await supabase.from('goals').insert({
        user_id: userId, type: a.type, label: a.label, target_value: a.target_value,
        exercise_name: a.type === 'exercise_weight' ? (a.exercise_name ?? null) : null,
        unit,
        target_reps: a.target_reps ?? null,
        start_value: recurring ? null : startValue,
        target_date: recurring ? null : (a.target_date ?? null),
        is_monthly: a.is_monthly ?? (a.type === 'days_trained'),
      }).select().maybeSingle())
    },
  },

  // Faltaba entera: el conector sabía crear y borrar metas, pero no tocarlas.
  // Subir el objetivo de una meta que ya casi está, ponerle una fecha o darla
  // por cumplida obligaba a borrarla y crearla de nuevo — y eso pierde su
  // fecha de creación y su punto de partida, que son justo lo que mide el
  // progreso.
  update_goal: {
    description: 'Edita un objetivo existente. Manda solo los campos que cambian; lo que no mandes se queda como está. `completed: true` la da por cumplida y la archiva (false la reabre). El TIPO no se puede cambiar: cada tipo mide una cosa distinta y su unidad y su punto de partida dejarían de tener sentido — para eso, borra y crea otra.',
    inputSchema: obj({
      goal_id: str('ID del objetivo'),
      label: str('Nuevo texto que describe el objetivo'),
      target_value: num('Nuevo valor a alcanzar'),
      target_reps: num('Nuevas repeticiones objetivo. 0 lo deja vacío (comparar 1RM estimado)'),
      exercise_name: str('Nuevo ejercicio asociado, solo en metas de tipo exercise_weight'),
      unit: str('Nueva unidad: "kg" o "lb". No se aplica a metas de constancia'),
      start_value: num('Nuevo punto de partida, en la misma unidad que el objetivo'),
      target_date: str('Nueva fecha límite YYYY-MM-DD. Cadena vacía la quita'),
      completed: bool('true la marca cumplida y la archiva; false la reabre'),
    }, ['goal_id']),
    handler: async (a, { supabase, userId }) => {
      // Se lee primero para saber de qué tipo es y para poder fallar con un
      // mensaje claro en vez de con un update de cero filas.
      const goal = unwrap(await supabase.from('goals')
        .select('*').eq('id', a.goal_id).eq('user_id', userId).maybeSingle()) as any
      if (!goal) throw new Error(`No existe un objetivo tuyo con id ${a.goal_id}.`)

      const recurring = goal.type === 'days_trained' || goal.type === 'sessions_per_week'
      const patch: Record<string, unknown> = {}

      if (a.label !== undefined) patch.label = a.label
      if (a.target_value !== undefined) {
        if (!(a.target_value > 0)) throw new Error('`target_value` tiene que ser mayor que cero.')
        patch.target_value = a.target_value
      }
      if (a.target_reps !== undefined) patch.target_reps = a.target_reps || null
      if (a.exercise_name !== undefined) {
        if (goal.type !== 'exercise_weight') {
          throw new Error('`exercise_name` solo aplica a los objetivos de tipo exercise_weight.')
        }
        patch.exercise_name = a.exercise_name || null
      }
      if (a.unit !== undefined) {
        if (recurring) throw new Error('Los objetivos de constancia se miden en días; no llevan unidad de peso.')
        if (a.unit !== 'kg' && a.unit !== 'lb') throw new Error('`unit` debe ser "kg" o "lb".')
        patch.unit = a.unit
      }
      // En las recurrentes el inicio y el plazo no existen: su ventana (la
      // semana o el mes) ya es las dos cosas.
      if (a.start_value !== undefined) {
        if (recurring) throw new Error('Los objetivos de constancia parten de cero cada ventana; no llevan start_value.')
        patch.start_value = a.start_value
      }
      if (a.target_date !== undefined) {
        if (recurring) throw new Error('Los objetivos de constancia no llevan fecha límite: su ventana ya lo es.')
        if (a.target_date && !isoDate(a.target_date)) {
          throw new Error('`target_date` debe ser una fecha YYYY-MM-DD.')
        }
        patch.target_date = a.target_date || null
      }
      if (a.completed !== undefined) {
        patch.completed_at = a.completed ? new Date().toISOString() : null
      }

      if (Object.keys(patch).length === 0) {
        throw new Error('No mandaste ningún campo que cambiar.')
      }

      return unwrap(await supabase.from('goals').update(patch)
        .eq('id', a.goal_id).eq('user_id', userId).select().maybeSingle())
    },
  },

  delete_goal: {
    description: 'Borra un objetivo. Para una meta ya lograda, prefiere update_goal con `completed: true`: la archiva y conserva el logro en vez de perderlo.',
    inputSchema: obj({ goal_id: str('ID del objetivo') }, ['goal_id']),
    handler: async (a, { supabase, userId }) => {
      unwrap(await supabase.from('goals').delete()
        .eq('id', a.goal_id).eq('user_id', userId))
      return { deleted: true, goal_id: a.goal_id }
    },
  },

  plan_sessions: {
    description: 'Pone sesiones en el calendario. Es la capa de PLANIFICACIÓN: dice qué se piensa hacer, no registra un entreno (eso se hace en la app, serie a serie). `repeat_every_weeks` con `repeat_count` crea una serie — "cardio cada semana durante 8" es repeat_every_weeks 1 y repeat_count 8; "una descarga cada 4 semanas, 6 veces" es 4 y 6. Para varios días distintos de la semana, llama una vez por día: una serie repite SIEMPRE en el mismo día de la semana. Vincular una sesión de fuerza a un día de rutina (routine_day_id) deja empezar el entreno desde el calendario: busca antes el id con get_routine o get_active_cycle.',
    inputSchema: obj({
      date: str('Primer día, YYYY-MM-DD (fecha local de la persona)'),
      kind: { ...str('Tipo de sesión'), enum: SESSION_KINDS },
      title: str('Título corto, opcional: "Bici 40 min", "Upper A"'),
      notes: str('Nota breve, opcional'),
      routine_day_id: str('Día de rutina al que se vincula, solo para kind "strength"'),
      repeat_count: num(`Cuántas ocurrencias crear (por defecto 1, máximo ${MAX_SERIES_OCCURRENCES})`),
      repeat_every_weeks: num('Cada cuántas semanas se repite (por defecto 1)'),
    }, ['date', 'kind']),
    handler: async (a, { supabase, userId }) => {
      const start = isoDate(a.date)
      if (!start) throw new Error('`date` debe ser una fecha YYYY-MM-DD.')
      if (!SESSION_KINDS.includes(a.kind)) {
        throw new Error(`\`kind\` debe ser uno de: ${SESSION_KINDS.join(', ')}.`)
      }

      // Vincular a un día de rutina que no es tuyo revelaría por rebote la
      // rutina de un cliente: se comprueba el dueño antes de guardar el id.
      let routineId: string | null = null
      if (a.routine_day_id) {
        const day = unwrap(await supabase.from('routine_days')
          .select('id, routine_id, routines!inner(id, user_id)')
          .eq('id', a.routine_day_id)
          .eq('routines.user_id', userId)
          .maybeSingle()) as any
        if (!day) throw new Error('Día de rutina no encontrado.')
        routineId = day.routine_id
      }

      const count = Math.max(1, Math.min(MAX_SERIES_OCCURRENCES, Math.floor(Number(a.repeat_count) || 1)))
      const step = Math.max(1, Math.floor(Number(a.repeat_every_weeks) || 1))
      const seriesId = count > 1 ? crypto.randomUUID() : null

      // Fechas en UTC a mediodía: sumar semanas sobre una fecha suelta no
      // puede cruzar un cambio de horario y devolver el día anterior.
      const rows = []
      for (let i = 0; i < count; i++) {
        const d = new Date(`${start}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + i * step * 7)
        rows.push({
          date: d.toISOString().slice(0, 10),
          kind: a.kind,
          title: a.title?.trim() || null,
          notes: a.notes?.trim() || null,
          routine_id: routineId,
          routine_day_id: routineId ? a.routine_day_id : null,
          status: 'planned',
          series_id: seriesId,
        })
      }

      // El dueño se sella aquí, pegado al insert, y no dentro del bucle: es
      // donde el guardrail de guardrails.test.js puede verlo, y es donde tiene
      // que estar para que nadie construya filas sin dueño más arriba.
      const created = unwrap(await supabase.from('scheduled_sessions')
        .insert(rows.map(r => ({ ...r, user_id: userId })))
        .select('id,date,kind,title,status,series_id'))
      return { created, series_id: seriesId }
    },
  },

  update_session: {
    description: 'Cambia una sesión del calendario: su estado, su título, su nota, o lo que de verdad se hizo (duración, distancia, esfuerzo). Marcar "done" un cardio o una movilidad sin decir cuánto duró deja la sesión sin dato, que es peor que no marcarla: manda duration_min si lo sabes. Los datos de duración/distancia/esfuerzo NO aplican a la fuerza — un entreno de fuerza se mide serie a serie en la app.',
    inputSchema: obj({
      session_id: str('ID de la sesión'),
      status: { ...str('Nuevo estado'), enum: SESSION_STATUSES },
      title: str('Nuevo título'),
      notes: str('Nueva nota'),
      duration_min: num('Minutos que duró (cardio y movilidad)'),
      distance_km: num('Kilómetros recorridos (solo cardio)'),
      rpe: num('Esfuerzo percibido, 1–10'),
    }, ['session_id']),
    handler: async (a, { supabase, userId }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (a.status !== undefined) {
        if (!SESSION_STATUSES.includes(a.status)) {
          throw new Error(`\`status\` debe ser uno de: ${SESSION_STATUSES.join(', ')}.`)
        }
        patch.status = a.status
      }
      if (a.title !== undefined) patch.title = a.title?.trim() || null
      if (a.notes !== undefined) patch.notes = a.notes?.trim() || null
      if (a.duration_min !== undefined) patch.duration_min = optNum(a.duration_min, 1440)
      if (a.distance_km !== undefined) patch.distance_km = optNum(a.distance_km, 1000)
      if (a.rpe !== undefined) {
        const r = optNum(a.rpe, 10)
        patch.rpe = r === null ? null : Math.round(r)
      }

      const row = unwrap(await supabase.from('scheduled_sessions').update(patch)
        .eq('id', a.session_id).eq('user_id', userId)
        .select('id,date,kind,title,status,duration_min,distance_km,rpe').maybeSingle())
      if (!row) throw new Error('Sesión no encontrada.')
      return row
    },
  },

  delete_sessions: {
    description: 'Quita sesiones del calendario. Con `session_id` quita una; con `series_id` quita toda una serie. Al borrar una serie, las ocurrencias ya cerradas (hechas o saltadas) se CONSERVAN a propósito: son pasado registrado, y dejar de hacer cardio los martes no debería reescribir los martes que sí lo hiciste.',
    inputSchema: obj({
      session_id: str('ID de una sesión suelta'),
      series_id: str('ID de una serie: quita sus ocurrencias pendientes'),
    }),
    handler: async (a, { supabase, userId }) => {
      if (!a.session_id && !a.series_id) {
        throw new Error('Hace falta `session_id` o `series_id`.')
      }
      if (a.series_id) {
        const gone = unwrap(await supabase.from('scheduled_sessions').delete()
          .eq('series_id', a.series_id).eq('user_id', userId).eq('status', 'planned')
          .select('id'))
        return { deleted: (gone as any[]).length, series_id: a.series_id, kept_closed: true }
      }
      const gone = unwrap(await supabase.from('scheduled_sessions').delete()
        .eq('id', a.session_id).eq('user_id', userId).select('id'))
      return { deleted: (gone as any[]).length, session_id: a.session_id }
    },
  },

  log_nutrition_entry: {
    description: 'Registra una comida, con macros y micronutrientes. Consulta antes list_nutrition_foods para reutilizar valores ya guardados en vez de estimarlos. Después, save_nutrition_food deja el alimento en la biblioteca personal para la próxima vez.',
    inputSchema: obj({
      name: str('Nombre de la comida o alimento'),
      meal: { ...str('Momento del día'), enum: MEALS },
      kcal: num('Calorías'), protein_g: num('Proteína en gramos'),
      carbs_g: num('Carbohidratos en gramos'), fat_g: num('Grasa en gramos'),
      micros: MICROS_ARG,
      date: str('Fecha YYYY-MM-DD. Por defecto, hoy.'),
      note: str('Nota opcional'),
    }, ['name', 'meal']),
    handler: async (a, { supabase, userId }) =>
      // eaten_on siempre explícito: el default de la columna es current_date
      // en UTC, que desde las 7pm de Bogotá ya es "mañana".
      unwrap(await supabase.from('nutrition_entries').insert({
        user_id: userId, name: a.name, meal: a.meal,
        kcal: a.kcal ?? 0, protein_g: a.protein_g ?? 0,
        carbs_g: a.carbs_g ?? 0, fat_g: a.fat_g ?? 0,
        micros: sanitizeMicros(a.micros),
        note: a.note ?? null,
        eaten_on: a.date || localDay(await userTimezone(supabase, userId)),
      }).select().maybeSingle()),
  },

  update_nutrition_entry: {
    description: 'Modifica una comida ya registrada. Ojo con `micros`: REEMPLAZA el objeto entero, no lo fusiona — manda todos los micros que quieras conservar, no solo los que cambian.',
    inputSchema: obj({
      entry_id: str('ID de la comida'),
      name: str('Nuevo nombre'),
      meal: { ...str('Nuevo momento del día'), enum: MEALS },
      kcal: num('Calorías'), protein_g: num('Proteína'),
      carbs_g: num('Carbohidratos'), fat_g: num('Grasa'),
      micros: MICROS_ARG,
      note: str('Nota'),
    }, ['entry_id']),
    handler: async (a, { supabase, userId }) => {
      const patch: Record<string, unknown> = {}
      for (const k of ['name', 'meal', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'note']) {
        if (a[k] != null) patch[k] = a[k]
      }
      if (a.micros != null) patch.micros = sanitizeMicros(a.micros)
      if (!Object.keys(patch).length) throw new Error('No hay nada que cambiar.')
      return unwrap(await supabase.from('nutrition_entries').update(patch)
        .eq('id', a.entry_id).eq('user_id', userId).select().maybeSingle())
    },
  },

  save_nutrition_food: {
    description: 'Guarda un alimento en la biblioteca personal con su porción de referencia, para reutilizarlo sin volver a estimar valores. Si ya existe uno con ese nombre, lo actualiza. Úsalo después de registrar una comida nueva: si no, la próxima vez la app no la recordará y habrá que estimarla otra vez.',
    inputSchema: obj({
      name: str('Nombre del alimento'),
      serving_qty: num('Cantidad de la porción de referencia (por defecto 1)'),
      serving_unit: str('Unidad de la porción: "g", "unidad", "taza"… (por defecto "porción")'),
      kcal: num('Calorías de esa porción'), protein_g: num('Proteína'),
      carbs_g: num('Carbohidratos'), fat_g: num('Grasa'),
      micros: MICROS_ARG,
    }, ['name']),
    handler: async (a, { supabase, userId }) => {
      // Misma normalización que la app (useNutrition.js): el índice único es
      // (user_id, name_norm), así que separarse de ese criterio haría reventar
      // el insert en vez de actualizar la fila que ya existe.
      const name = String(a.name).trim()
      const norm = name.toLowerCase()
      const patch = {
        name,
        serving_qty: a.serving_qty ?? 1,
        serving_unit: a.serving_unit ?? 'porción',
        kcal: a.kcal ?? 0, protein_g: a.protein_g ?? 0,
        carbs_g: a.carbs_g ?? 0, fat_g: a.fat_g ?? 0,
        micros: sanitizeMicros(a.micros),
        last_used_at: new Date().toISOString(),
      }
      const existing = unwrap(await supabase.from('nutrition_foods')
        .select('id,times_used').eq('user_id', userId).eq('name_norm', norm).maybeSingle()) as any
      if (existing) {
        return unwrap(await supabase.from('nutrition_foods')
          .update({ ...patch, times_used: existing.times_used + 1 })
          .eq('id', existing.id).eq('user_id', userId).select().maybeSingle())
      }
      return unwrap(await supabase.from('nutrition_foods')
        .insert({ user_id: userId, name_norm: norm, ...patch }).select().maybeSingle())
    },
  },

  delete_nutrition_entry: {
    description: 'Borra una comida registrada.',
    inputSchema: obj({ entry_id: str('ID de la comida') }, ['entry_id']),
    handler: async (a, { supabase, userId }) => {
      unwrap(await supabase.from('nutrition_entries').delete()
        .eq('id', a.entry_id).eq('user_id', userId))
      return { deleted: true, entry_id: a.entry_id }
    },
  },

  // ── Perfil, cuerpo y Longevidad ─────────────────────────────────────────
  // Lo que sigue SIN poder escribirse, y no por descuido: los entrenos y las
  // series registradas (el outbox offline puede reenviar una escritura vieja y
  // pisar lo que se escriba desde fuera), la biblioteca global de ejercicios
  // (es compartida entre todas las cuentas) y el rastro de auditoría. La
  // garantía no está en que falte la herramienta —eso es una omisión, no una
  // garantía— sino en que Postgres los rechaza: ver agent_writable_tables().

  update_profile: {
    description: 'Cambia el perfil. Manda solo los campos que cambian. Peso, grasa corporal, nivel de actividad y fase son los INSUMOS con los que la app calcula los objetivos de macros: cambiarlos no recalcula los objetivos sola — si quieres moverlos, usa set_nutrition_targets después. El plan, el rol de administrador y el acceso beta NO se pueden tocar desde aquí; los blinda la base de datos.',
    inputSchema: obj({
      name: str('Nombre'),
      level: { ...str('Nivel de entrenamiento'), enum: LEVELS },
      goal: { ...str('Objetivo principal'), enum: PROFILE_GOALS },
      days_per_week: num('Días que entrena por semana, 1–7'),
      sex: { ...str('Sexo'), enum: SEXES },
      birth_date: str('Fecha de nacimiento YYYY-MM-DD'),
      height: num('Altura'),
      height_unit: { ...str('Unidad de altura'), enum: HEIGHT_UNITS },
      weight: num('Peso de referencia del perfil. Para registrar una pesada usa log_body_weight'),
      weight_unit: { ...str('Unidad de peso'), enum: WEIGHT_UNITS },
      body_fat_pct: num('Grasa corporal en %, 3–70'),
      body_fat_source: { ...str('Cómo se obtuvo'), enum: BODY_FAT_SOURCES },
      activity_level: { ...str('Nivel de actividad diaria'), enum: ACTIVITY_LEVELS },
      nutrition_phase: { ...str('Fase de nutrición'), enum: NUTRITION_PHASES },
      exercise_lang: { ...str('Idioma de los nombres de ejercicio'), enum: LANGS },
      app_lang: { ...str('Idioma de la interfaz'), enum: LANGS },
    }),
    handler: async (a, { supabase, userId }) => {
      const ENUMS: Record<string, string[]> = {
        level: LEVELS, goal: PROFILE_GOALS, sex: SEXES,
        activity_level: ACTIVITY_LEVELS, nutrition_phase: NUTRITION_PHASES,
        body_fat_source: BODY_FAT_SOURCES, exercise_lang: LANGS, app_lang: LANGS,
        weight_unit: WEIGHT_UNITS, height_unit: HEIGHT_UNITS,
      }
      const FIELDS = [
        'name', 'level', 'goal', 'days_per_week', 'sex', 'birth_date',
        'height', 'height_unit', 'weight', 'weight_unit',
        'body_fat_pct', 'body_fat_source', 'activity_level', 'nutrition_phase',
        'exercise_lang', 'app_lang',
      ]

      const patch: Record<string, unknown> = {}
      for (const k of FIELDS) {
        if (a[k] === undefined) continue
        if (ENUMS[k] && !ENUMS[k].includes(a[k])) {
          throw new Error(`\`${k}\` debe ser uno de: ${ENUMS[k].join(', ')}.`)
        }
        patch[k] = a[k]
      }
      if (a.days_per_week !== undefined && !(a.days_per_week >= 1 && a.days_per_week <= 7)) {
        throw new Error('`days_per_week` va de 1 a 7.')
      }
      if (a.body_fat_pct !== undefined && !(a.body_fat_pct >= 3 && a.body_fat_pct <= 70)) {
        throw new Error('`body_fat_pct` va de 3 a 70.')
      }
      if (a.birth_date !== undefined && !isoDate(a.birth_date)) {
        throw new Error('`birth_date` debe ser una fecha YYYY-MM-DD.')
      }
      if (!Object.keys(patch).length) throw new Error('No mandaste ningún campo que cambiar.')

      patch.updated_at = new Date().toISOString()
      return unwrap(await supabase.from('profiles').update(patch)
        .eq('id', userId)
        .select('id,name,level,goal,days_per_week,sex,birth_date,height,height_unit,weight,weight_unit,body_fat_pct,body_fat_source,activity_level,nutrition_phase,exercise_lang,app_lang')
        .maybeSingle())
    },
  },

  update_exercise: {
    description: 'Clasifica o renombra un ejercicio propio. `muscle_group` es lo que hace que su volumen entre en el balance muscular. `custom_name` es un nombre encima, que alcanza a todo el historial; el `name` interno no se toca porque es la clave con la que se resuelve el ejercicio y moverla partiría el seguimiento del progreso. Cadena vacía en custom_name devuelve el nombre original.',
    inputSchema: obj({
      exercise_id: str('ID del ejercicio (de list_exercises)'),
      muscle_group: { ...str('Grupo muscular principal'), enum: MUSCLE_GROUPS },
      custom_name: str('Nombre propio. Cadena vacía lo quita'),
    }, ['exercise_id']),
    handler: async (a, { supabase, userId }) => {
      const patch: Record<string, unknown> = {}
      if (a.muscle_group !== undefined) {
        if (!MUSCLE_GROUPS.includes(a.muscle_group)) {
          throw new Error(`\`muscle_group\` debe ser uno de: ${MUSCLE_GROUPS.join(', ')}.`)
        }
        patch.muscle_group = a.muscle_group
      }
      if (a.custom_name !== undefined) patch.custom_name = a.custom_name?.trim() || null
      if (!Object.keys(patch).length) throw new Error('No mandaste ningún campo que cambiar.')

      const row = unwrap(await supabase.from('exercises').update(patch)
        .eq('id', a.exercise_id).eq('user_id', userId)
        .select('id,name,custom_name,muscle_group').maybeSingle())
      if (!row) throw new Error('Ejercicio no encontrado.')
      return row
    },
  },

  log_body_weight: {
    description: 'Registra una pesada. Una por día es lo normal: si ya hay una de ese día, la reemplaza en vez de duplicarla. `date` por defecto es hoy en la zona horaria de la persona.',
    inputSchema: obj({
      weight: num('Peso'),
      unit: { ...str('Unidad'), enum: WEIGHT_UNITS },
      date: str('Fecha YYYY-MM-DD. Por defecto, hoy'),
      note: str('Nota opcional'),
    }, ['weight']),
    handler: async (a, { supabase, userId }) => {
      if (!(a.weight > 0)) throw new Error('`weight` tiene que ser mayor que cero.')
      const unit = a.unit ?? 'kg'
      if (!WEIGHT_UNITS.includes(unit)) throw new Error('`unit` debe ser "kg" o "lb".')

      const tz = await userTimezone(supabase, userId)
      const day = isoDate(a.date) || localDay(tz)
      if (a.date && !isoDate(a.date)) throw new Error('`date` debe ser una fecha YYYY-MM-DD.')

      // Se pesa una vez al día: dos filas del mismo día harían que la curva
      // contara dos veces ese día y que "el peso de hoy" dependiera del orden.
      unwrap(await supabase.from('body_weight_logs').delete()
        .eq('user_id', userId)
        .gte('logged_at', `${day}T00:00:00`)
        .lte('logged_at', `${day}T23:59:59.999`))

      return unwrap(await supabase.from('body_weight_logs').insert({
        user_id: userId, weight: a.weight, unit,
        note: a.note ?? null,
        logged_at: `${day}T12:00:00Z`,
      }).select().maybeSingle())
    },
  },

  set_nutrition_targets: {
    description: 'Fija los objetivos diarios de macros a mano. Normalmente los calcula la app a partir del peso, la grasa corporal y la fase — cámbialos solo si esa persona lo pide. Si `protein_locked` es true, ha fijado su proteína a propósito: no se la muevas sin que lo diga. Manda solo lo que cambie.',
    inputSchema: obj({
      kcal: num('Calorías diarias'),
      protein_g: num('Proteína en gramos'),
      carbs_g: num('Carbohidratos en gramos'),
      fat_g: num('Grasa en gramos'),
      protein_locked: bool('Fijar la proteína para que la app no la recalcule'),
      micros: MICROS_ARG,
    }),
    handler: async (a, { supabase, userId }) => {
      const cur = unwrap(await supabase.from('nutrition_targets')
        .select('*').eq('user_id', userId).maybeSingle()) as any

      const patch: Record<string, unknown> = {}
      for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g']) {
        if (a[k] === undefined) continue
        if (!(a[k] >= 0)) throw new Error(`\`${k}\` no puede ser negativo.`)
        patch[k] = Math.round(a[k])
      }
      if (patch.kcal !== undefined && !((patch.kcal as number) > 0)) {
        throw new Error('`kcal` tiene que ser mayor que cero.')
      }
      if (a.protein_locked !== undefined) patch.protein_locked = a.protein_locked
      if (a.micros !== undefined) patch.micros = sanitizeMicros(a.micros)
      if (!Object.keys(patch).length) throw new Error('No mandaste ningún campo que cambiar.')

      if (!cur) {
        throw new Error('Todavía no hay objetivos de nutrición: ábrelos una vez en la app y luego se pueden ajustar desde aquí.')
      }
      patch.updated_at = new Date().toISOString()
      return unwrap(await supabase.from('nutrition_targets').update(patch)
        .eq('user_id', userId).select().maybeSingle())
    },
  },

  create_supplement: {
    description: 'Añade un suplemento al stack.',
    inputSchema: obj({
      name: str('Nombre'),
      dose: str('Dosis, texto libre: "5 g", "2 cápsulas"'),
      timing: { type: 'array', items: { type: 'string', enum: SUPPLEMENT_TIMING }, description: 'Momentos del día' },
      note: str('Nota opcional'),
    }, ['name']),
    handler: async (a, { supabase, userId }) => {
      const timing = Array.isArray(a.timing) ? a.timing : []
      for (const t of timing) {
        if (!SUPPLEMENT_TIMING.includes(t)) {
          throw new Error(`\`timing\` debe ser uno de: ${SUPPLEMENT_TIMING.join(', ')}.`)
        }
      }
      const last = unwrap(await supabase.from('supplements').select('sort_order')
        .eq('user_id', userId).order('sort_order', { ascending: false })
        .limit(1).maybeSingle()) as any
      return unwrap(await supabase.from('supplements').insert({
        user_id: userId, name: a.name, dose: a.dose ?? null,
        timing, note: a.note ?? null,
        sort_order: (last?.sort_order ?? 0) + 1,
      }).select().maybeSingle())
    },
  },

  update_supplement: {
    description: 'Cambia un suplemento del stack. `is_active` en false lo aparta sin borrar su historial de tomas.',
    inputSchema: obj({
      supplement_id: str('ID del suplemento'),
      name: str('Nuevo nombre'),
      dose: str('Nueva dosis'),
      timing: { type: 'array', items: { type: 'string', enum: SUPPLEMENT_TIMING }, description: 'Nuevos momentos' },
      note: str('Nueva nota'),
      is_active: bool('Activo o apartado'),
    }, ['supplement_id']),
    handler: async (a, { supabase, userId }) => {
      const patch: Record<string, unknown> = {}
      if (a.name !== undefined) patch.name = a.name
      if (a.dose !== undefined) patch.dose = a.dose?.trim() || null
      if (a.note !== undefined) patch.note = a.note?.trim() || null
      if (a.is_active !== undefined) patch.is_active = a.is_active
      if (a.timing !== undefined) {
        const timing = Array.isArray(a.timing) ? a.timing : []
        for (const t of timing) {
          if (!SUPPLEMENT_TIMING.includes(t)) {
            throw new Error(`\`timing\` debe ser uno de: ${SUPPLEMENT_TIMING.join(', ')}.`)
          }
        }
        patch.timing = timing
      }
      if (!Object.keys(patch).length) throw new Error('No mandaste ningún campo que cambiar.')

      const row = unwrap(await supabase.from('supplements').update(patch)
        .eq('id', a.supplement_id).eq('user_id', userId).select().maybeSingle())
      if (!row) throw new Error('Suplemento no encontrado.')
      return row
    },
  },

  delete_supplement: {
    description: 'Borra un suplemento y su historial de tomas. Para dejar de tomarlo conservando el historial, mejor update_supplement con is_active=false.',
    inputSchema: obj({ supplement_id: str('ID del suplemento') }, ['supplement_id']),
    handler: async (a, { supabase, userId }) => {
      unwrap(await supabase.from('supplements').delete()
        .eq('id', a.supplement_id).eq('user_id', userId))
      return { deleted: true, supplement_id: a.supplement_id }
    },
  },

  log_supplement: {
    description: 'Marca (o desmarca) un suplemento como tomado en un día. Por defecto hoy, en la zona horaria de la persona.',
    inputSchema: obj({
      supplement_id: str('ID del suplemento'),
      taken: bool('true lo marca tomado, false lo desmarca. Por defecto true'),
      date: str('Fecha YYYY-MM-DD. Por defecto, hoy'),
    }, ['supplement_id']),
    handler: async (a, { supabase, userId }) => {
      if (a.date && !isoDate(a.date)) throw new Error('`date` debe ser una fecha YYYY-MM-DD.')
      const day = isoDate(a.date) || localDay(await userTimezone(supabase, userId))
      const taken = a.taken !== false

      const own = unwrap(await supabase.from('supplements').select('id')
        .eq('id', a.supplement_id).eq('user_id', userId).maybeSingle())
      if (!own) throw new Error('Suplemento no encontrado.')

      if (!taken) {
        unwrap(await supabase.from('supplement_logs').delete()
          .eq('user_id', userId).eq('supplement_id', a.supplement_id).eq('taken_on', day))
        return { supplement_id: a.supplement_id, date: day, taken: false }
      }

      // Idempotente: marcar dos veces el mismo día no crea dos filas.
      const already = unwrap(await supabase.from('supplement_logs').select('id')
        .eq('user_id', userId).eq('supplement_id', a.supplement_id)
        .eq('taken_on', day).maybeSingle())
      if (!already) {
        unwrap(await supabase.from('supplement_logs').insert({
          user_id: userId, supplement_id: a.supplement_id, taken_on: day,
        }))
      }
      return { supplement_id: a.supplement_id, date: day, taken: true }
    },
  },

  log_bloodwork: {
    description: 'Guarda el resultado de un marcador de una analítica. Manda `ref_low` y `ref_high` tal como vengan en el informe del laboratorio: los rangos cambian entre laboratorios y sin ellos el valor no se puede interpretar después. Un marcador por llamada.',
    inputSchema: obj({
      panel_date: str('Fecha de la analítica YYYY-MM-DD'),
      marker: str('Marcador, p. ej. "Ferritina", "HDL", "TSH"'),
      value: num('Valor medido'),
      unit: str('Unidad tal cual la da el laboratorio: "ng/mL", "mg/dL"…'),
      ref_low: num('Límite bajo del rango de referencia'),
      ref_high: num('Límite alto del rango de referencia'),
      note: str('Nota opcional'),
    }, ['panel_date', 'marker', 'value']),
    handler: async (a, { supabase, userId }) => {
      if (!isoDate(a.panel_date)) throw new Error('`panel_date` debe ser una fecha YYYY-MM-DD.')
      if (!String(a.marker || '').trim()) throw new Error('`marker` no puede ir vacío.')
      return unwrap(await supabase.from('bloodwork_results').insert({
        user_id: userId,
        panel_date: a.panel_date,
        marker: String(a.marker).trim(),
        value: a.value,
        unit: a.unit?.trim() || null,
        ref_low: a.ref_low ?? null,
        ref_high: a.ref_high ?? null,
        note: a.note?.trim() || null,
      }).select().maybeSingle())
    },
  },

  delete_bloodwork: {
    description: 'Borra un resultado de analítica.',
    inputSchema: obj({ result_id: str('ID del resultado') }, ['result_id']),
    handler: async (a, { supabase, userId }) => {
      unwrap(await supabase.from('bloodwork_results').delete()
        .eq('id', a.result_id).eq('user_id', userId))
      return { deleted: true, result_id: a.result_id }
    },
  },

  undo_change: {
    description: 'Revierte un cambio hecho por IA. Usa list_recent_changes para ver los IDs disponibles.',
    inputSchema: obj({ change_id: num('ID del cambio a revertir') }, ['change_id']),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.rpc('undo_agent_write', { p_id: a.change_id })),
  },

  restore_routine_revision: {
    description: 'Devuelve una rutina a una versión anterior. La versión actual se guarda antes, así que restaurar también se puede deshacer.',
    inputSchema: obj({ revision_id: str('ID de la versión') }, ['revision_id']),
    handler: async (a, { supabase, userId }) => {
      const rev = unwrap(await supabase.from('routine_revisions').select('id')
        .eq('id', a.revision_id).eq('user_id', userId).maybeSingle())
      if (!rev) throw new Error('Versión no encontrada.')
      return unwrap(await supabase.rpc('restore_routine_revision', { p_revision_id: a.revision_id }))
    },
  },
}

export const toolList = () =>
  Object.entries(TOOLS).map(([name, t]) => ({
    name, description: t.description, inputSchema: t.inputSchema,
  }))
