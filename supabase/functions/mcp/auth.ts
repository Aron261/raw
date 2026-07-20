// Autenticación del servidor MCP.
//
// ⚠️ REGLA QUE SOSTIENE TODA LA SEGURIDAD DE ESTE SERVIDOR ⚠️
//
// Aquí hay UNA sola llamada a createClient, y usa la ANON KEY más el token del
// usuario final. Nunca la service_role key. La service_role salta RLS por
// completo: si entrara en este archivo, se caerían de golpe el aislamiento
// entre usuarios, la puerta beta, el overlay de entrenador y la guardia de
// escritura de agentes de supabase/agent_audit.sql.
//
// Al usar el token del usuario, Postgres concede exactamente los permisos que
// esa persona ya tiene dentro de la app. El servidor MCP no puede excederlos ni
// por error ni por un bug en el enrutado de herramientas.
//
// Si alguna vez hace falta service_role para algo, la respuesta correcta es una
// RPC SECURITY DEFINER con su propia comprobación de autorización, no una
// segunda credencial aquí.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

// URL pública del conector: NO es la URL de la función, es la del dominio
// propio, que hace de proxy (ver rewrites en vercel.json).
//
// Por qué el rodeo: el descubrimiento OAuth (RFC 9728) manda buscar los
// metadatos del recurso en la RAÍZ del origen, en
// /.well-known/oauth-protected-resource/<ruta-del-recurso>. En *.supabase.co
// esa ruta la contesta el gateway con 401 y nunca llega hasta aquí, así que el
// cliente no descubre el servidor de autorización y falla al registrarse
// ("no se pudo registrar con el servicio de inicio de sesión"). En nuestro
// dominio sí controlamos la raíz del origen.
//
// Este valor tiene que coincidir EXACTAMENTE con la URL que el cliente pidió,
// o rechazará los metadatos por no corresponder con el recurso.
export const RESOURCE_URL = 'https://raw-red.vercel.app/mcp'

// El servidor de autorización sigue siendo Supabase. Sus metadatos sí se
// descubren bien: /.well-known/oauth-authorization-server/auth/v1 responde 200.
export const AUTH_SERVER  = `${SUPABASE_URL}/auth/v1`

export class Unauthorized extends Error {}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('Authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() || null : null
}

// Cliente con el token del usuario final. RLS decide todo lo demás.
export function userClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Valida el token contra el servidor de auth y devuelve cliente + usuario.
export async function authenticate(req: Request) {
  const token = bearerFrom(req)
  if (!token) throw new Unauthorized('Falta el token')

  const supabase = userClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Unauthorized('Token inválido')

  return { supabase, user: data.user, token }
}

// ── Descubrimiento OAuth ──────────────────────────────────────────────────
// Los clientes MCP averiguan dónde autenticarse a partir de un 401 que lleva
// la cabecera WWW-Authenticate apuntando a estos metadatos. Si el 401 no la
// lleva, el descubrimiento falla en silencio y el conector nunca pasa de
// "no se pudo conectar". Por eso esta función se despliega con verify_jwt
// desactivado: el 401 por defecto de la plataforma no incluye la cabecera.

// Se apunta a la forma canónica de RFC 9728: los metadatos van en la raíz del
// origen con la ruta del recurso insertada después, no colgando del recurso.
export const WWW_AUTHENTICATE =
  'Bearer resource_metadata="https://raw-red.vercel.app/.well-known/oauth-protected-resource/mcp"'

export function protectedResourceMetadata() {
  return {
    resource: RESOURCE_URL,
    authorization_servers: [AUTH_SERVER],
    bearer_methods_supported: ['header'],
  }
}
