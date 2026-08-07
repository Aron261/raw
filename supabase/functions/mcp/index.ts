// Servidor MCP de RAW — Edge Function.
//
// Permite que cada persona conecte SU cuenta de RAW a SU cuenta de Claude y,
// desde un chat, lea sus datos y planifique rutinas que aparecen en la app.
//
// Qué NO puede hacer, por diseño:
//   - Tocar el código, la interfaz o el despliegue de la app. Un conector solo
//     puede llamar a las herramientas de tools.ts; no tiene sistema de
//     archivos, ni git, ni Vercel.
//   - Ver o modificar datos de otra persona. Cada petición usa el token del
//     usuario final y RLS decide (ver auth.ts).
//   - Escribir en perfil, objetivos de macros, entrenos registrados, series,
//     peso corporal, biblioteca global de ejercicios o ajustes. No hay
//     herramienta para ello y además Postgres lo rechaza
//     (supabase/agent_audit.sql).
//
// Despliegue: verify_jwt DESACTIVADO. La validación del token la hace
// authenticate() en auth.ts. Es necesario porque el 401 por defecto de la
// plataforma no lleva la cabecera WWW-Authenticate y sin ella el
// descubrimiento OAuth del cliente MCP falla en silencio.

import { authenticate, Unauthorized, WWW_AUTHENTICATE, protectedResourceMetadata } from './auth.ts'
import { TOOLS, toolList } from './tools.ts'
import { toSpanish, logError } from './errors.ts'

const PROTOCOL_VERSION = '2025-06-18'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })

// ── Envoltorio JSON-RPC ───────────────────────────────────────────────────

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: unknown, code: number, message: string) =>
  ({ jsonrpc: '2.0', id, error: { code, message } })

// Los errores de herramienta se devuelven DENTRO del resultado (isError), no
// como fallo de transporte: así el modelo puede leerlos y recuperarse hablando
// con la persona, en vez de ver la conexión romperse.
const toolFailure = (id: unknown, message: string) =>
  rpcResult(id, { content: [{ type: 'text', text: message }], isError: true })

const toolOk = (id: unknown, data: unknown) =>
  rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data ?? null, null, 2) }] })

// ── Manejo de un mensaje ──────────────────────────────────────────────────

async function handleMessage(msg: any, req: Request): Promise<unknown | null> {
  const { id, method, params } = msg ?? {}

  // Notificaciones (sin id): no llevan respuesta.
  if (id === undefined || id === null) return null

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'raw', title: 'RAW — entrenamiento', version: '1.0.0' },
      instructions: [
        'Datos de entrenamiento de RAW para esta persona usuaria.',
        'Puedes leer todo: entrenos, series, progreso, nutrición y perfil.',
        'Solo puedes escribir rutinas y ciclos, objetivos, comidas, alimentos y el calendario de entrenamiento.',
        'No puedes registrar entrenos ni series ni peso corporal (eso se hace en la app), ni cambiar el perfil o los objetivos de macros y micros, ni conceder permisos de administrador.',
        'El calendario (list_schedule, plan_sessions, update_session, delete_sessions) es la capa de PLANIFICACIÓN: dice qué se piensa hacer. Planear una sesión de fuerza no registra un entreno — el entreno se hace y se registra en la app, serie a serie, y entonces el plan de ese día se marca solo.',
        'En cardio y movilidad sí se registra lo que de verdad pasó (duración, distancia, esfuerzo) con update_session. Manda solo lo que sepas: un nulo significa "no lo sé", no cero.',
        'El peso corporal se lee con get_body_weight, pero no se escribe: es un dato que se registra en la báscula y en la app, no por conversación.',
        'Antes de crear o editar una rutina, busca los ejercicios con search_exercise_library: guardar un nombre que no está en la biblioteca rompe el seguimiento del progreso. Si un término es ambiguo ("sentadillas"), pregunta cuál variante quiere.',
        'Después de escribir una rutina, revisa el campo "normalized" y comenta cualquier nombre que se haya guardado distinto.',
        'Al registrar comidas, manda solo los micronutrientes que conozcas: una clave ausente significa "desconocido", no cero, y la app cuenta cuántas comidas traen datos para saber cuánto vale el total del día.',
      ].join(' '),
    })
  }

  if (method === 'ping') return rpcResult(id, {})

  if (method === 'tools/list') return rpcResult(id, { tools: toolList() })

  if (method === 'tools/call') {
    const name = params?.name
    const tool = TOOLS[name]
    if (!tool) return rpcError(id, -32602, `Herramienta desconocida: ${name}`)

    // La autenticación se hace por llamada: el servidor no guarda sesión.
    let ctx
    try {
      const { supabase, user } = await authenticate(req)
      ctx = { supabase, userId: user.id }
    } catch {
      throw new Unauthorized()
    }

    try {
      const data = await tool.handler(params?.arguments ?? {}, ctx)
      return toolOk(id, data)
    } catch (err) {
      logError(`tool:${name}`, err)
      return toolFailure(id, toSpanish(err))
    }
  }

  return rpcError(id, -32601, `Método no soportado: ${method}`)
}

// ── Servidor HTTP ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Metadatos de recurso protegido: así el cliente MCP sabe dónde autenticarse.
  // includes() y no endsWith(): la forma canónica de RFC 9728 lleva la ruta del
  // recurso DESPUÉS del .well-known, así que la petición puede llegar como
  // /.well-known/oauth-protected-resource/mcp.
  if (url.pathname.includes('/.well-known/oauth-protected-resource')) {
    return json(protectedResourceMetadata())
  }

  // Cierre de sesión: no guardamos estado, así que no hay nada que cerrar.
  if (req.method === 'DELETE') return new Response(null, { status: 204, headers: CORS })

  if (req.method === 'GET') {
    return json({ error: 'Este endpoint habla MCP sobre HTTP con POST.' }, 405)
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json(rpcError(null, -32700, 'JSON inválido'), 400)
  }

  try {
    // Un cliente puede mandar un lote de mensajes.
    if (Array.isArray(payload)) {
      const out = []
      for (const m of payload) {
        const r = await handleMessage(m, req)
        if (r) out.push(r)
      }
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS })
    }

    const result = await handleMessage(payload, req)
    return result ? json(result) : new Response(null, { status: 202, headers: CORS })
  } catch (err) {
    if (err instanceof Unauthorized) {
      // La cabecera WWW-Authenticate es lo que dispara el flujo OAuth en el
      // cliente. Sin ella, el conector se queda en "no se pudo conectar".
      return json(
        rpcError((payload as any)?.id ?? null, -32001, 'Autenticación requerida'),
        401,
        { 'WWW-Authenticate': WWW_AUTHENTICATE },
      )
    }
    logError('request', err)
    return json(rpcError((payload as any)?.id ?? null, -32603, 'Error interno'), 500)
  }
})
