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

  // Los entrenos y series son de solo lectura: el outbox offline puede
  // reenviar una escritura vieja y pisar lo que se escriba desde fuera.
  it('ninguna herramienta escribe en tablas protegidas', () => {
    const tools = sources.find(s => s.file === 'tools.ts')
    const protectedTables = [
      'profiles', 'nutrition_targets', 'workouts', 'workout_exercises',
      'sets', 'exercises_library', 'app_settings', 'trainer_clients',
    ]
    for (const table of protectedTables) {
      for (const op of ['insert', 'update', 'delete', 'upsert']) {
        const pattern = new RegExp(`from\\(['"]${table}['"]\\)[\\s\\S]{0,80}?\\.${op}\\(`)
        expect(tools.code, `tools.ts parece escribir en ${table} con .${op}()`)
          .not.toMatch(pattern)
      }
    }
  })
})
