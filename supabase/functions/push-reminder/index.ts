// Aviso de entreno abierto — el que llega con la app cerrada.
//
// La despierta el cron cada 5 minutos (ver supabase/push_notifications.sql).
// Busca entrenos vivos que lleven más de 20 minutos sin que nadie los mire y
// manda un push a los dispositivos de esa persona.
//
// OJO: hoy está dormido a propósito. El cron tiene active = false y el cliente
// no sella `last_seen_at` (NOTIFICATIONS_ENABLED / PUSH_ENABLED en
// src/lib/push.js), así que la consulta de abajo no encuentra a nadie aunque se
// despierte esta función a mano.
//
// Despliegue: verify_jwt DESACTIVADO a propósito. Quien llama es Postgres a
// través de pg_net, no una sesión de nadie, así que no hay JWT que validar. En
// su lugar exige un secreto compartido en la cabecera: sin él, esto sería un
// botón para que cualquiera dispare notificaciones a los usuarios.
//
// Las claves VAPID viven en la tabla app_secrets, no en variables de entorno:
// las variables de entorno de una edge function hay que ponerlas por el panel o
// por CLI, y este proyecto se despliega por MCP. La tabla no la alcanza ni anon
// ni authenticated (RLS sin políticas y sin grants); el rol de servicio, que es
// con el que corre esto, se salta RLS.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendPush, type VapidKeys } from './webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IDLE_MINUTES = 20

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Comparación en tiempo constante: comparar secretos con === filtra por dónde
// dejaron de parecerse.
const secretsMatch = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: secretRows, error: secretErr } = await admin
    .from('app_secrets').select('key,value')
    .in('key', ['vapid_public', 'vapid_private', 'vapid_subject', 'reminder_secret'])
  if (secretErr) return json({ error: 'no se pudieron leer los secretos' }, 500)

  const secrets = Object.fromEntries((secretRows ?? []).map(r => [r.key, r.value]))
  const expected = secrets.reminder_secret
  const given = req.headers.get('x-reminder-secret') ?? ''
  if (!expected || !secretsMatch(given, expected)) return json({ error: 'no autorizado' }, 401)

  const vapid: VapidKeys = {
    publicKey: secrets.vapid_public,
    privateKey: secrets.vapid_private,
    subject: secrets.vapid_subject ?? 'mailto:raw@raw-red.vercel.app',
  }
  if (!vapid.publicKey || !vapid.privateKey) return json({ error: 'faltan las claves VAPID' }, 500)

  // Modo prueba: manda un aviso a los dispositivos de una persona sin esperar a
  // que tenga un entreno desatendido. Es la única forma de comprobar que la
  // cadena entera funciona sin dejar un entreno abierto veinte minutos.
  const body = await req.json().catch(() => ({}))
  const dryRunUser: string | null = body?.test_user_id ?? null

  let targets: Array<{ workout_id: string | null; user_id: string; workout_name: string; idle_minutes: number }>
  if (dryRunUser) {
    targets = [{ workout_id: null, user_id: dryRunUser, workout_name: 'Prueba', idle_minutes: IDLE_MINUTES }]
  } else {
    const { data, error } = await admin.rpc('pending_workout_reminders', { p_idle_minutes: IDLE_MINUTES })
    if (error) return json({ error: error.message }, 500)
    targets = data ?? []
  }

  let sent = 0, failed = 0, dropped = 0

  for (const t of targets) {
    const { data: subs } = await admin
      .from('push_subscriptions').select('id,endpoint,p256dh,auth')
      .eq('user_id', t.user_id)
    if (!subs?.length) continue

    const payload = JSON.stringify({
      title: 'Tu entreno sigue abierto',
      body: `«${t.workout_name}» lleva ${t.idle_minutes} min sin tocarse. ¿Sigues entrenando?`,
      url: t.workout_id ? `/workout/${t.workout_id}` : '/',
      tag: `raw-workout-${t.workout_id ?? 'test'}`,
    })

    let anyOk = false
    for (const s of subs) {
      const res = await sendPush(s.endpoint, { p256dh: s.p256dh, auth: s.auth }, payload, vapid)
      if (res.ok) {
        anyOk = true
        sent++
        await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString(), failed_at: null, fail_reason: null }).eq('id', s.id)
      } else if (res.gone) {
        // El buzón ya no existe. Guardarlo solo haría que cada pasada del cron
        // reintente algo que nunca va a funcionar.
        dropped++
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        failed++
        await admin.from('push_subscriptions').update({ failed_at: new Date().toISOString(), fail_reason: res.error?.slice(0, 300) ?? null }).eq('id', s.id)
      }
    }

    // Solo se da por avisado si algún dispositivo lo recibió: marcarlo tras un
    // fallo dejaría el entreno sin aviso hasta que la persona vuelva a abrir la
    // app, que es exactamente lo que no va a pasar.
    if (anyOk && t.workout_id) await admin.rpc('mark_workout_reminded', { p_workout_id: t.workout_id })
  }

  return json({ ok: true, workouts: targets.length, sent, failed, dropped })
})
