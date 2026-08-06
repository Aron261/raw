import { supabase } from './supabase'

/*
 * Suscribir este dispositivo a las notificaciones push.
 *
 * La clave pública VAPID va en el bundle a propósito: es pública por
 * definición: el navegador la necesita para pedirle un buzón a su servicio de
 * push, y sirve para verificar la firma de quien envía, no para autorizar
 * envíos. La privada es la que firma, y esa no sale del servidor (vive en
 * app_secrets, que solo lee el rol de servicio).
 *
 * Lo que se guarda es un buzón, no un permiso: endpoint + dos claves con las
 * que se cifra cada aviso. Ni siquiera el servicio de push de Apple o Google
 * puede leer lo que se manda por ahí.
 */

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

/*
 * Los dos interruptores de los avisos del navegador.
 *
 * Están en el mismo sitio porque uno depende del otro y separarlos invita a
 * encender el de abajo olvidando el de arriba.
 *
 * NOTIFICATIONS_ENABLED — pedir permiso de notificaciones y mostrarlas. Apagado
 *   significa que la app NO pide el permiso: ni al entrar, ni tras un aviso, ni
 *   en ningún sitio. Un permiso que ya estuviera concedido de antes tampoco se
 *   usa, porque no se programa ninguna notificación.
 *
 * PUSH_ENABLED — además, avisos enviados desde el servidor con la app cerrada.
 *   Implica el anterior: un push tiene que acabar en una notificación visible,
 *   así que sin permiso no hay push que valga.
 *
 * Está todo construido y probado —claves VAPID, cifrado contra el vector de la
 * RFC, tabla de buzones, service worker, función de envío y cron—, pero dormido
 * a propósito. Con el push apagado tampoco se sella `workouts.last_seen_at`, y
 * como la consulta que busca a quién avisar exige ese sello, el lado del
 * servidor queda inerte aunque alguien despierte la edge function a mano.
 *
 * Para encenderlo:
 *   1. NOTIFICATIONS_ENABLED = true (esto solo ya da el aviso local)
 *   2. PUSH_ENABLED = true
 *   3. select cron.alter_job((select jobid from cron.job
 *        where jobname = 'raw-workout-reminder'), active := true);
 *
 * Mientras tanto el aviso de entreno abierto sigue funcionando por su otro
 * camino: la hoja que pregunta al volver a la app. Nunca dependió de ninguno de
 * estos dos, y por eso se montó así.
 */
export const NOTIFICATIONS_ENABLED = false
export const PUSH_ENABLED = false

export const pushSupported = () =>
  NOTIFICATIONS_ENABLED &&
  PUSH_ENABLED &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined' &&
  !!VAPID_PUBLIC

// applicationServerKey quiere los 65 bytes crudos, no el base64url.
const toBytes = (base64url) => {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export async function subscribeToPush(userId) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (!userId) return { ok: false, reason: 'no-user' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' }

  try {
    const reg = await navigator.serviceWorker.ready

    // Reutilizar el buzón que ya tenga este navegador. Pedir uno nuevo teniendo
    // otro vivo deja el anterior huérfano recibiendo avisos que nadie lee.
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        // Obligatorio en todos los navegadores actuales: cada push tiene que
        // acabar en algo visible. Encaja con lo que hace este aviso.
        userVisibleOnly: true,
        applicationServerKey: toBytes(VAPID_PUBLIC),
      })
    }

    const { endpoint, keys } = sub.toJSON()
    if (!endpoint || !keys?.p256dh || !keys?.auth) return { ok: false, reason: 'incompleta' }

    // El endpoint es la identidad del buzón: reinstalar la app da uno nuevo, y
    // el mismo navegador reutiliza el suyo. Por eso el conflicto se resuelve
    // por endpoint y no por usuario — una persona tiene tantos como dispositivos.
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: (navigator.userAgent || '').slice(0, 300),
    }, { onConflict: 'endpoint' })

    if (error) return { ok: false, reason: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) }
  }
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const { endpoint } = sub.toJSON()
    await sub.unsubscribe().catch(() => {})
    if (endpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  } catch { /* mejor esfuerzo */ }
}
