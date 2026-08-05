// Catálogo de herramientas del servidor MCP de RAW.
//
// Reglas de diseño:
//   1. Verbos concretos. No hay herramienta de SQL genérico, ni argumentos que
//      nombren tablas o columnas. Una capacidad que no tiene herramienta
//      sencillamente no existe: no está bloqueada, no hay código que la escriba.
//   2. Nada que escriba en profiles, nutrition_targets, workouts, sets,
//      exercises_library, app_settings ni trainer_clients. Además de no existir
//      aquí, la guardia de supabase/agent_audit.sql lo rechaza en Postgres.
//      En particular los objetivos de macros y micros se fijan SOLO en la app,
//      que los calcula del peso, la grasa corporal y la fase: aquí se leen
//      (get_nutrition_day) y se leen sus insumos (get_profile), nada más.
//   3. Los entrenos registrados son de SOLO LECTURA. El outbox offline
//      (src/lib/outbox.js) puede reenviar una escritura vieja horas después y
//      pisar o resucitar filas; escribir sets desde fuera corrompería ese flujo.
//   4. Toda escritura pasa por RLS con el token del usuario, así que nunca
//      puede tocar datos de otra persona.

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
    description: 'Perfil de la persona usuaria: nombre, nivel, objetivo, días por semana, sexo, altura, peso y composición corporal (grasa, nivel de actividad, fase de nutrición). Solo lectura: el perfil no se puede modificar desde aquí. Estos son los INSUMOS con los que la app calcula los objetivos de macros; los objetivos ya aceptados están en get_nutrition_day.',
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
    handler: async (a, { supabase }) => {
      const cols = a.include_days
        ? 'id,name,description,type,source,goal,level,days_per_week,is_active,created_at,routine_days(day_name,day_order,focus,routine_day_exercises(exercise_name,exercise_order,sets,reps,rest_seconds,notes))'
        : 'id,name,description,type,source,goal,level,days_per_week,is_active,created_at'
      let q = supabase.from('routines').select(cols).order('created_at', { ascending: false })
      if (a.type) q = q.eq('type', a.type)
      return unwrap(await q)
    },
  },

  get_routine: {
    description: 'Devuelve una rutina completa con sus días y ejercicios en orden.',
    inputSchema: obj({ routine_id: str('ID de la rutina') }, ['routine_id']),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.rpc('routine_snapshot', { p_routine_id: a.routine_id })),
  },

  get_active_cycle: {
    description: 'Devuelve el ciclo activo con todos sus días y ejercicios. Es el plan que la persona está siguiendo ahora mismo.',
    inputSchema: obj({}),
    handler: async (_a, { supabase }) =>
      unwrap(await supabase.from('routines')
        .select('id,name,description,goal,level,days_per_week,routine_days(day_name,day_order,focus,routine_day_exercises(exercise_name,exercise_order,sets,reps,rest_seconds,notes))')
        .eq('is_active', true).maybeSingle()),
  },

  list_workouts: {
    description: 'Entrenos registrados, del más reciente al más antiguo, con sus ejercicios y series. SOLO LECTURA: los entrenos se registran desde la app, no desde aquí.',
    inputSchema: obj({
      since: str('Fecha inicial ISO (YYYY-MM-DD)'),
      until: str('Fecha final ISO (YYYY-MM-DD)'),
      limit: num('Máximo de entrenos (por defecto 30, máximo 200)'),
    }),
    handler: async (a, { supabase }) => {
      let q = supabase.from('workouts')
        .select('id,name,notes,started_at,ended_at,routine_id,routine_day_id,source,workout_exercises(sort_order,unit,exercises(name,muscle_group),sets(set_number,reps,weight))')
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
    handler: async (a, { supabase }) =>
      unwrap(await supabase.from('workouts')
        .select('id,name,notes,started_at,ended_at,source,workout_exercises(sort_order,unit,notes,exercises(name,muscle_group),sets(set_number,reps,weight))')
        .eq('id', a.workout_id).maybeSingle()),
  },

  get_exercise_history: {
    description: 'Historial de series de un ejercicio a lo largo del tiempo, con peso, repeticiones y 1RM estimado. Sirve para ver progresión antes de planificar.',
    inputSchema: obj({
      exercise_name: str('Nombre del ejercicio'),
      limit: num('Máximo de series (por defecto 100, máximo 500)'),
    }, ['exercise_name']),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.from('public_workout_summary')
        .select('*').ilike('exercise_name', a.exercise_name)
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
      return unwrap(await supabase.from('exercises_library')
        .select('id,name,name_en,muscle_group,equipment,difficulty,is_compound')
        .or(`name.ilike.%${a.query}%,name_en.ilike.%${a.query}%`).limit(lim))
    },
  },

  list_goals: {
    description: 'Objetivos de entrenamiento de la persona usuaria.',
    inputSchema: obj({}),
    handler: async (_a, { supabase }) =>
      unwrap(await supabase.from('goals').select('*').order('created_at', { ascending: false })),
  },

  get_nutrition_day: {
    description: 'Comidas registradas de un día, con los totales (macros y micros) y los objetivos. Los objetivos son de SOLO LECTURA: se fijan en la app, donde se calculan a partir del peso, la grasa corporal y la fase. Si `targets.protein_locked` es true, esa persona ha fijado su proteína a mano y no quiere que se la recalculen: no le propongas otra cifra. `micros_coverage` dice de cuántas comidas se conocen micros — sin ese dato, un total de micros bajo puede ser falta de información y no falta de nutrientes.',
    inputSchema: obj({ date: str('Fecha YYYY-MM-DD. Por defecto, hoy.') }),
    handler: async (a, { supabase, userId }) => {
      const day = a.date || new Date().toISOString().slice(0, 10)
      const [entries, targets] = await Promise.all([
        supabase.from('nutrition_entries').select('*').eq('eaten_on', day).order('created_at'),
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
    handler: async (a, { supabase }) => {
      let q = supabase.from('nutrition_foods').select('*')
        .order('times_used', { ascending: false }).limit(clamp(a.limit, 30, 100))
      if (a.query) q = q.ilike('name', `%${a.query}%`)
      return unwrap(await q)
    },
  },

  get_body_weight: {
    description: 'Registros de peso corporal, del más reciente al más antiguo.',
    inputSchema: obj({ limit: num('Máximo (por defecto 60, máximo 365)') }),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.from('body_weight_logs').select('*')
        .order('logged_at', { ascending: false }).limit(clamp(a.limit, 60, 365))),
  },

  list_recent_changes: {
    description: 'Cambios hechos por asistentes de IA en esta cuenta, del más reciente al más antiguo. Cada uno se puede revertir con undo_change.',
    inputSchema: obj({ limit: num('Máximo (por defecto 20, máximo 100)') }),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.from('agent_writes')
        .select('id,table_name,op,row_id,undone_at,created_at')
        .order('created_at', { ascending: false }).limit(clamp(a.limit, 20, 100))),
  },

  list_routine_revisions: {
    description: 'Versiones guardadas de una rutina. Cada edición guarda una antes de cambiar nada, así que se puede volver atrás con restore_routine_revision.',
    inputSchema: obj({ routine_id: str('ID de la rutina') }, ['routine_id']),
    handler: async (a, { supabase }) =>
      unwrap(await supabase.from('routine_revisions')
        .select('id,reason,actor,created_at').eq('routine_id', a.routine_id)
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
    handler: async (a, { supabase }) =>
      unwrap(await supabase.rpc('update_routine_tree', {
        p_routine_id: a.routine_id,
        p: {
          name: a.name ?? null, description: a.description ?? null,
          goal: a.goal ?? null, level: a.level ?? null,
          days_per_week: a.days_per_week ?? null, days: a.days ?? [],
        },
      })),
  },

  rename_routine: {
    description: 'Cambia solo los datos de cabecera de una rutina (nombre, descripción, objetivo, nivel) sin tocar los días ni los ejercicios.',
    inputSchema: obj({
      routine_id: str('ID de la rutina'),
      name: str('Nuevo nombre'), description: str('Nueva descripción'),
      goal: str('Nuevo objetivo'), level: str('Nuevo nivel'),
    }, ['routine_id']),
    handler: async (a, { supabase }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of ['name', 'description', 'goal', 'level']) if (a[k] != null) patch[k] = a[k]
      return unwrap(await supabase.from('routines').update(patch)
        .eq('id', a.routine_id).select('id,name,description,goal,level').maybeSingle())
    },
  },

  delete_routine: {
    description: 'Borra una rutina con todos sus días y ejercicios. Requiere confirm=true de forma explícita. Confírmalo con la persona antes de llamarla.',
    inputSchema: obj({
      routine_id: str('ID de la rutina'),
      confirm: bool('Debe ser true. Sirve para que un borrado nunca ocurra por accidente.'),
    }, ['routine_id', 'confirm']),
    handler: async (a, { supabase }) => {
      if (a.confirm !== true) throw new Error('Para borrar una rutina hay que pasar confirm=true.')
      unwrap(await supabase.from('routines').delete().eq('id', a.routine_id))
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
    description: 'Crea un objetivo de entrenamiento.',
    inputSchema: obj({
      type: str('Tipo de objetivo, p. ej. "strength" o "bodyweight"'),
      label: str('Texto que describe el objetivo'),
      target_value: num('Valor a alcanzar'),
      exercise_name: str('Ejercicio asociado, si aplica'),
      unit: str('Unidad: "kg" o "lb"'),
      target_reps: num('Repeticiones objetivo, si aplica'),
      is_monthly: bool('Si es un objetivo mensual'),
    }, ['type', 'label', 'target_value']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('goals').insert({
        user_id: userId, type: a.type, label: a.label, target_value: a.target_value,
        exercise_name: a.exercise_name ?? null, unit: a.unit ?? 'kg',
        target_reps: a.target_reps ?? null, is_monthly: a.is_monthly ?? false,
      }).select().maybeSingle()),
  },

  delete_goal: {
    description: 'Borra un objetivo.',
    inputSchema: obj({ goal_id: str('ID del objetivo') }, ['goal_id']),
    handler: async (a, { supabase }) => {
      unwrap(await supabase.from('goals').delete().eq('id', a.goal_id))
      return { deleted: true, goal_id: a.goal_id }
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
      unwrap(await supabase.from('nutrition_entries').insert({
        user_id: userId, name: a.name, meal: a.meal,
        kcal: a.kcal ?? 0, protein_g: a.protein_g ?? 0,
        carbs_g: a.carbs_g ?? 0, fat_g: a.fat_g ?? 0,
        micros: sanitizeMicros(a.micros),
        note: a.note ?? null,
        ...(a.date ? { eaten_on: a.date } : {}),
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
    handler: async (a, { supabase }) => {
      const patch: Record<string, unknown> = {}
      for (const k of ['name', 'meal', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'note']) {
        if (a[k] != null) patch[k] = a[k]
      }
      if (a.micros != null) patch.micros = sanitizeMicros(a.micros)
      if (!Object.keys(patch).length) throw new Error('No hay nada que cambiar.')
      return unwrap(await supabase.from('nutrition_entries').update(patch)
        .eq('id', a.entry_id).select().maybeSingle())
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
          .eq('id', existing.id).select().maybeSingle())
      }
      return unwrap(await supabase.from('nutrition_foods')
        .insert({ user_id: userId, name_norm: norm, ...patch }).select().maybeSingle())
    },
  },

  delete_nutrition_entry: {
    description: 'Borra una comida registrada.',
    inputSchema: obj({ entry_id: str('ID de la comida') }, ['entry_id']),
    handler: async (a, { supabase }) => {
      unwrap(await supabase.from('nutrition_entries').delete().eq('id', a.entry_id))
      return { deleted: true, entry_id: a.entry_id }
    },
  },

  log_body_weight: {
    description: 'Registra el peso corporal.',
    inputSchema: obj({
      weight: num('Peso'),
      unit: { ...str('Unidad'), enum: ['kg', 'lb'] },
      note: str('Nota opcional'),
    }, ['weight']),
    handler: async (a, { supabase, userId }) =>
      unwrap(await supabase.from('body_weight_logs').insert({
        user_id: userId, weight: a.weight, unit: a.unit ?? 'kg', note: a.note ?? null,
      }).select().maybeSingle()),
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
    handler: async (a, { supabase }) =>
      unwrap(await supabase.rpc('restore_routine_revision', { p_revision_id: a.revision_id })),
  },
}

export const toolList = () =>
  Object.entries(TOOLS).map(([name, t]) => ({
    name, description: t.description, inputSchema: t.inputSchema,
  }))
