// Estas pruebas defienden la propiedad de seguridad de la que depende todo lo
// demás del servidor MCP. No prueban comportamiento, prueban que no se ha
// colado algo que rompería el aislamiento entre usuarios.
//
// Si alguna falla, no la ajustes para que pase: lo más probable es que el
// cambio que la rompió sea el problema.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const sources = readdirSync(DIR)
  .filter(f => f.endsWith('.ts'))
  .map(f => ({ file: f, code: readFileSync(join(DIR, f), 'utf8') }))

describe('guardas del servidor MCP', () => {
  it('hay archivos que revisar', () => {
    expect(sources.length).toBeGreaterThan(0)
  })

  // La service_role key salta RLS por completo. Si entra aquí, se caen de golpe
  // el aislamiento entre usuarios, la puerta beta y la guardia de escritura de
  // agentes: el servidor podría leer y escribir cualquier fila de cualquiera.
  it('no usa la service_role key en ningún archivo', () => {
    for (const { file, code } of sources) {
      // Se ignoran los comentarios: explican por qué NO se usa.
      const withoutComments = code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(withoutComments, `${file} menciona SERVICE_ROLE fuera de un comentario`)
        .not.toMatch(/SERVICE_ROLE/i)
      expect(withoutComments, `${file} menciona service_role fuera de un comentario`)
        .not.toMatch(/service[_-]?role/i)
    }
  })

  // Un solo punto de construcción del cliente hace que la regla de arriba sea
  // verificable de un vistazo. Varios createClient invitan a que uno se
  // construya con otras credenciales.
  it('solo construye un cliente Supabase, y en auth.ts', () => {
    const calls = sources.flatMap(({ file, code }) =>
      [...code.matchAll(/createClient\s*\(/g)].map(() => file))
    expect(calls).toEqual(['auth.ts'])
  })

  // El cliente tiene que llevar el token del usuario final.
  it('el cliente se construye con la anon key y el token del usuario', () => {
    const auth = sources.find(s => s.file === 'auth.ts')
    expect(auth).toBeTruthy()
    expect(auth.code).toMatch(/ANON_KEY/)
    expect(auth.code).toMatch(/Authorization:\s*`Bearer \$\{token\}`/)
  })

  // Sin esta cabecera en el 401, el cliente MCP no encuentra dónde
  // autenticarse y el conector nunca llega a conectar.
  it('el 401 devuelve WWW-Authenticate', () => {
    const index = sources.find(s => s.file === 'index.ts')
    expect(index.code).toMatch(/'WWW-Authenticate':\s*WWW_AUTHENTICATE/)
  })

  // Las herramientas son la superficie de capacidades. Ninguna debe permitir
  // SQL arbitrario ni recibir el nombre de una tabla como argumento.
  // Ojo: "query" como texto de búsqueda (search_exercise_library) es legítimo;
  // lo que no puede haber es SQL ni nombres de tabla dinámicos.
  it('no expone una herramienta de SQL genérico', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    expect(tools.code).not.toMatch(/execute_sql|raw_sql|run_query|\bsql\s*:/i)
    // .from() siempre con un literal, nunca con una variable.
    const dynamicFrom = [...tools.code.matchAll(/\.from\(([^'")]+)\)/g)]
    expect(dynamicFrom.map(m => m[1]), 'hay un .from() con tabla dinámica').toEqual([])
  })

  // Lo que sigue siendo intocable después de abrir perfil, ejercicios, peso,
  // macros y Longevidad. Cada una por una razón distinta:
  //
  //   · workouts / workout_exercises / sets — el outbox offline puede reenviar
  //     una escritura vieja y pisar lo que se escriba desde fuera.
  //   · exercises_library — es global: un mal edit lo ven todas las cuentas.
  //   · agent_writes — es el rastro de auditoría; escribirlo es borrar huellas.
  //   · trainer_clients / app_settings — conceden acceso, no son datos.
  it('ninguna herramienta escribe en las tablas que siguen protegidas', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    const protectedTables = [
      'workouts', 'workout_exercises', 'sets', 'exercises_library',
      'app_settings', 'trainer_clients', 'trainer_invites', 'agent_writes',
      'push_subscriptions', 'app_secrets',
    ]
    for (const table of protectedTables) {
      for (const op of ['insert', 'update', 'delete', 'upsert']) {
        const pattern = new RegExp(`from\\(['"]${table}['"]\\)[\\s\\S]{0,80}?\\.${op}\\(`)
        expect(tools.code, `tools.ts parece escribir en ${table} con .${op}()`)
          .not.toMatch(pattern)
      }
    }
  })

  // El perfil sí se puede editar, pero el plan, el rol de administrador y el
  // acceso beta no: los blindan triggers en Postgres. Que una herramienta ni
  // siquiera los OFREZCA es la segunda barrera — si alguien los añade al
  // esquema, el fallo se ve aquí y no en un intento silencioso contra la base.
  it('ninguna herramienta ofrece tocar plan, permisos ni acceso', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    for (const campo of ['is_admin', 'beta_approved', "plan:", "'plan'"]) {
      expect(tools.code, `tools.ts menciona ${campo}, que no debe poder escribirse`)
        .not.toContain(campo)
    }
  })

  // La pantalla de consentimiento es una promesa, y estuvo mintiendo: decía que
  // un agente no podía cambiar el perfil ni los macros cuando ya podía. Si se
  // abre otra tabla y no se actualiza esa lista, que falle aquí.
  it('el consentimiento no promete que el perfil y los macros sean intocables', () => {
    const consent = readFileSync(join(DIR, '../../../src/pages/OAuthConsent.jsx'), 'utf8')
    const cannot = consent.slice(consent.indexOf('const CANNOT'), consent.indexOf(']', consent.indexOf('const CANNOT')))
    expect(cannot).not.toMatch(/perfil|macros|suplement|peso corporal|ejercicios/i)
    // Y lo que de verdad sigue vetado sí tiene que seguir dicho.
    expect(cannot).toMatch(/entrenos y series/)
  })

  // La RLS de la app es MÁS ANCHA que este conector a propósito: un entrenador
  // puede leer y editar las rutinas, los entrenos y la nutrición de sus
  // clientes. Si una herramienta se apoya solo en la RLS, el conector de un
  // entrenador devuelve datos de gente que nunca autorizó la conexión — y la
  // pantalla de consentimiento promete lo contrario, en esas palabras. Por eso
  // cada consulta a una tabla con dueño lleva su propio filtro por user_id.
  it('toda consulta a una tabla con dueño se filtra por el usuario del token', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    const conDueno = [
      'routines', 'workouts', 'goals', 'nutrition_entries', 'nutrition_foods',
      'body_weight_logs', 'agent_writes', 'routine_revisions',
      'nutrition_targets', 'public_workout_summary', 'scheduled_sessions',
    ]
    const alcance = /\.eq\('user_id', userId\)|user_id:\s*userId/
    for (const m of tools.code.matchAll(/\.from\('(\w+)'\)/g)) {
      if (!conDueno.includes(m[1])) continue
      const cadena = tools.code.slice(m.index, m.index + 400)
      expect(cadena, `.from('${m[1]}') sin filtro por user_id`).toMatch(alcance)
    }
    // profiles se consulta por su clave primaria, que ES el id del usuario.
    for (const m of tools.code.matchAll(/\.from\('profiles'\)/g)) {
      expect(tools.code.slice(m.index, m.index + 400)).toMatch(/\.eq\('id', userId\)/)
    }
  })

  // Las RPC no admiten un .eq() encima, así que el alcance se comprueba antes
  // de llamarlas. Sin esto, update_routine_tree acepta el id de la rutina de un
  // cliente porque la función confía en la RLS del entrenador.
  it('las RPC que reciben un id ajeno comprueban antes de quién es', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    expect(tools.code, 'falta el helper de propiedad de rutina').toMatch(/async function assertOwnRoutine/)
    const conId = ['update_routine_tree', 'routine_snapshot', 'restore_routine_revision']
    for (const rpc of conId) {
      const i = tools.code.indexOf(`rpc('${rpc}'`)
      expect(i, `no se encuentra la llamada a ${rpc}`).toBeGreaterThan(-1)
      // La comprobación va en el mismo handler, justo antes de la llamada.
      const antes = tools.code.slice(Math.max(0, i - 600), i)
      expect(antes, `${rpc} se llama sin comprobar el dueño`)
        .toMatch(/assertOwnRoutine|\.eq\('user_id', userId\)/)
    }
  })

  // Interpolar texto del modelo en un .or() deja reescribir el filtro: en la
  // gramática de PostgREST la coma y los paréntesis son sintaxis, no texto.
  it('ningún filtro se construye interpolando argumentos de la herramienta', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    expect(tools.code, 'hay un filtro con texto interpolado').not.toMatch(/\.or\(`/)
  })

  // El CHECK de la base solo acepta estos cuatro. Sin el enum en el esquema de
  // la herramienta, un "breakfast" bien intencionado acababa en una violación
  // de restricción traducida a un «Los datos no son válidos» que no dice nada.
  it('el momento del día va restringido a los valores que acepta la base', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    const m = tools.code.match(/const MEALS = \[([^\]]+)\]/)
    expect(m, 'no se encuentra la lista MEALS en tools.ts').toBeTruthy()
    const valores = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
    expect(valores).toEqual(['desayuno', 'almuerzo', 'cena', 'snack'])

    for (const tool of ['log_nutrition_entry', 'update_nutrition_entry']) {
      const bloque = tools.code.slice(tools.code.indexOf(`${tool}: {`))
      expect(bloque.slice(0, 1200), `${tool} no restringe meal`).toMatch(/meal:\s*\{[^}]*enum:\s*MEALS/)
    }
  })
})

// La Edge Function no puede importar de src/, así que la lista de nutrientes
// existe dos veces. Esta prueba es lo ÚNICO que separa las dos copias de irse
// cada una por su lado en silencio: el día que se añada un nutriente a la app
// y no aquí, el servidor lo descartaría de toda escritura del agente sin decir
// una palabra, y la pantalla mostraría un hueco que nadie sabría explicar.
describe('paridad del registro de nutrientes', () => {
  const jsCode = readFileSync(join(DIR, '../../../src/lib/nutrients.js'), 'utf8')
  const tsCode = readFileSync(join(DIR, 'nutrients.ts'), 'utf8')

  const desdeJs = [...jsCode.matchAll(/\{\s*key:\s*'(\w+)',[^}]*?unit:\s*'(\w+)',[^}]*?max:\s*(\d+)/g)]
    .map(m => ({ key: m[1], unit: m[2], max: Number(m[3]) }))
  const desdeTs = [...tsCode.matchAll(/^\s{2}(\w+):\s*\{\s*unit:\s*'(\w+)',\s*max:\s*(\d+)/gm)]
    .map(m => ({ key: m[1], unit: m[2], max: Number(m[3]) }))

  it('las dos listas se han podido leer', () => {
    expect(desdeJs.length).toBe(17)
    expect(desdeTs.length).toBe(17)
  })

  it('mismas claves en los dos lados', () => {
    expect([...desdeTs.map(n => n.key)].sort()).toEqual([...desdeJs.map(n => n.key)].sort())
  })

  it('misma unidad y mismo máximo para cada clave', () => {
    const ts = Object.fromEntries(desdeTs.map(n => [n.key, n]))
    for (const n of desdeJs) {
      expect(ts[n.key].unit, `${n.key}: unidad distinta`).toBe(n.unit)
      expect(ts[n.key].max, `${n.key}: máximo distinto`).toBe(n.max)
    }
  })
})

// El calendario es la única tabla que se abrió a la escritura de agentes
// DESPUÉS de que existiera la guardia default-deny de agent_audit.sql. Lo que
// hace aceptable esa apertura no es que el plan sea poca cosa: es que cada
// escritura queda en agent_writes y se puede deshacer. Si un día alguien borra
// el trigger o saca la tabla de la lista, la app quedaría con un conector que
// escribe el calendario sin dejar rastro — o con unas herramientas que fallan
// contra Postgres sin que nada lo avise hasta que Pedro lo intente.
describe('el calendario escribible va de la mano de su auditoría', () => {
  const sql = readFileSync(join(DIR, '../../schedule_agent_writable.sql'), 'utf8')

  it('la migración existe y toma la lista de la fuente única', () => {
    // La lista dejó de estar copiada a mano aquí: vive en
    // public.agent_writable_tables(). Estuvo duplicada en cuatro sitios y se
    // desincronizó dos veces — re-ejecutar agent_audit.sql volvía a candar esta
    // misma tabla y tumbaba el calendario sin que nada avisara.
    expect(sql).toMatch(/writable text\[\]\s*:=\s*public\.agent_writable_tables\(\)/)
  })

  it('la fuente única declara escribible el calendario', () => {
    const audit = readFileSync(join(DIR, '../../agent_audit.sql'), 'utf8')
    const fn = audit.slice(audit.indexOf('function public.agent_writable_tables'))
    const lista = fn.slice(0, fn.indexOf('$$;', fn.indexOf('select array[')))
    expect(lista).toMatch(/'scheduled_sessions'/)
    // Y lo que nunca debe entrar en esa lista.
    for (const prohibida of ['workouts', 'sets', 'exercises_library', 'agent_writes', 'trainer_clients']) {
      expect(lista, `${prohibida} no puede ser escribible por un agente`)
        .not.toMatch(new RegExp(`'${prohibida}'`))
    }
  })

  it('y la audita con el mismo trigger que el resto', () => {
    expect(sql).toMatch(/create trigger trg_log_agent_write\s+after insert or update or delete on scheduled_sessions/)
  })

  it('la migración se niega a dejarla escribible sin auditar', () => {
    expect(sql).toMatch(/raise exception/)
  })

  it('las herramientas del calendario no tocan los entrenos registrados', () => {
    // Planear no es registrar: el historial de fuerza sigue siendo de lectura.
    const tools = sources.find(s => s.file === 'tools.ts')
    const i = tools.code.indexOf('plan_sessions: {')
    expect(i).toBeGreaterThan(-1)
    const bloque = tools.code.slice(i, tools.code.indexOf('log_nutrition_entry: {'))
    expect(bloque).not.toMatch(/from\('(workouts|sets|workout_exercises)'\)/)
  })
})
