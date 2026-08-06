import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToPush, PUSH_ENABLED, NOTIFICATIONS_ENABLED } from '../lib/push'

/*
 * «¿Sigues entrenando?»
 *
 * Un entreno abierto no se cierra solo, y no debería: la app no sabe si has
 * terminado o si estás en la máquina de al lado. Pero dejarlo abierto toda la
 * tarde tampoco es lo que querías — el cronómetro sigue corriendo y la sesión
 * acaba guardándose con tres horas de duración.
 *
 * Son dos avisos, y uno de los dos siempre llega:
 *
 * · Al volver a la app. Es el que funciona en todas partes, porque no depende
 *   de que nadie despierte a nadie: se compara el reloj contra la última vez
 *   que la app estuvo delante y ya está.
 *
 * · La notificación, si se ha dado permiso. Esta es el mejor esfuerzo que
 *   permita la plataforma: un temporizador en segundo plano lo estrangula el
 *   navegador y, en una PWA de iOS, directamente lo congela hasta que se vuelve
 *   a abrir la app. Cuando no llega, el aviso de arriba lo recoge.
 *
 * El latido es lo que hace que esto aguante que maten la app: si solo se
 * apuntara la hora al pasar a segundo plano, cerrar la app de golpe no dejaría
 * marca y al volver no habría contra qué comparar.
 */

export const IDLE_MS = 20 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000
// El sello en el servidor va mucho más espaciado que el local: el local es
// gratis y el otro es una escritura por cada latido. Dos minutos de resolución
// sobran para un umbral de veinte.
const SERVER_HEARTBEAT_MS = 2 * 60 * 1000

const seenKey = (workoutId) => `raw_last_seen_${workoutId}`

export function useIdleWorkoutReminder({ workoutId, active, title, body, userId }) {
  // Milisegundos que se ha estado fuera, cuando pasan del umbral. 0 = no hay
  // nada que preguntar.
  const [awayMs, setAwayMs] = useState(0)
  const timer = useRef(null)
  const beat = useRef(null)
  const serverBeat = useRef(0)

  // El sello del servidor es lo que hace posible el push: sin él, nadie fuera de
  // este dispositivo sabe que el entreno lleva rato solo, y la notificación no
  // la puede mandar la propia página (que es justo la que está dormida).
  const stampServer = useCallback((force = false) => {
    // Con el push apagado nadie mira este sello: escribirlo sería una consulta
    // cada dos minutos para alimentar una consulta que no corre.
    if (!PUSH_ENABLED || !workoutId) return
    const now = Date.now()
    if (!force && now - serverBeat.current < SERVER_HEARTBEAT_MS) return
    serverBeat.current = now
    supabase.from('workouts')
      .update({ last_seen_at: new Date(now).toISOString() })
      .eq('id', workoutId)
      .then(() => {}, () => { /* sin red: el aviso local sigue en pie */ })
  }, [workoutId])

  const stamp = useCallback(() => {
    if (!workoutId) return
    try { localStorage.setItem(seenKey(workoutId), String(Date.now())) } catch {}
    stampServer()
  }, [workoutId, stampServer])

  const lastSeen = useCallback(() => {
    if (!workoutId) return 0
    try { return parseInt(localStorage.getItem(seenKey(workoutId)), 10) || 0 } catch { return 0 }
  }, [workoutId])

  // Programar la notificación. Sin permiso no se pide nada aquí: pedirlo sin
  // que se haya visto para qué sirve es la forma más rápida de que lo denieguen
  // para siempre. El permiso se ofrece en la hoja, después del primer aviso.
  const scheduleNotification = useCallback(() => {
    clearTimeout(timer.current)
    // Con los avisos apagados no se programa nada, ni siquiera si el permiso
    // quedó concedido de antes: apagarlo tiene que apagarlo de verdad, no solo
    // dejar de pedirlo.
    if (!NOTIFICATIONS_ENABLED) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    timer.current = setTimeout(async () => {
      try {
        const opts = {
          body,
          tag: `raw-workout-${workoutId}`,   // uno por entreno, no una pila
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        }
        const reg = await navigator.serviceWorker?.ready
        if (reg?.showNotification) await reg.showNotification(title, opts)
        else new Notification(title, opts)
      } catch { /* el aviso al volver lo recoge */ }
    }, IDLE_MS)
  }, [workoutId, title, body])

  const cancelNotification = useCallback(() => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!active || !workoutId) return

    // Volver: ¿cuánto se ha estado fuera? Sin marca previa es que el entreno
    // acaba de empezar en este dispositivo, así que no hay nada que preguntar.
    const onVisible = () => {
      cancelNotification()
      const seen = lastSeen()
      const away = seen ? Date.now() - seen : 0
      if (away >= IDLE_MS) setAwayMs(away)
      stamp()
    }

    // Al irse a segundo plano el sello del servidor se fuerza: es el último
    // momento en que se sabe con certeza que la app estaba delante, y es contra
    // ese instante contra el que el cron va a medir los veinte minutos.
    const onHidden = () => {
      stampServer(true)
      try { localStorage.setItem(seenKey(workoutId), String(Date.now())) } catch {}
      scheduleNotification()
    }

    const onVisibility = () => (document.visibilityState === 'visible' ? onVisible() : onHidden())

    document.addEventListener('visibilitychange', onVisibility)
    // `pagehide` cubre lo que visibilitychange se deja: cerrar la pestaña, y en
    // iOS el paso a segundo plano que a veces no dispara el otro evento.
    window.addEventListener('pagehide', onHidden)

    if (document.visibilityState === 'visible') {
      onVisible()
      beat.current = setInterval(stamp, HEARTBEAT_MS)
    } else {
      onHidden()
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHidden)
      clearInterval(beat.current)
      cancelNotification()
    }
  }, [active, workoutId, stamp, stampServer, lastSeen, scheduleNotification, cancelNotification])

  // Si ya se dio permiso en otro momento, este dispositivo puede no tener buzón
  // todavía (permiso concedido en otro entreno, app reinstalada, buzón caducado).
  // Registrarlo es idempotente y barato.
  useEffect(() => {
    if (!PUSH_ENABLED || !active || !userId) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    subscribeToPush(userId)
  }, [active, userId])

  // Al terminar o descartar el entreno la marca deja de tener sentido.
  const clear = useCallback(() => {
    cancelNotification()
    clearInterval(beat.current)
    try { localStorage.removeItem(seenKey(workoutId)) } catch {}
  }, [workoutId, cancelNotification])

  // «Sigo entrenando»: se vuelve a poner el reloj a cero, o preguntaría otra vez
  // en el siguiente parpadeo.
  const dismiss = useCallback(() => {
    stamp()
    setAwayMs(0)
  }, [stamp])

  const enableNotifications = useCallback(async () => {
    // Primero de todo: con los avisos apagados no se llama a
    // requestPermission ni para preguntar. Un permiso denegado por haberlo
    // pedido a destiempo no se recupera pidiéndolo mejor después.
    if (!NOTIFICATIONS_ENABLED) return 'disabled'
    if (typeof Notification === 'undefined') return 'unsupported'
    try {
      const res = await Notification.requestPermission()
      if (res === 'granted') {
        scheduleNotification()
        // Con el push encendido, además se registra el buzón y se pone el sello
        // en marcha —sin sello el servidor no sabe desde cuándo contar—. Con el
        // push apagado las dos llamadas se quedan en nada, y el permiso sigue
        // sirviendo para el aviso local, que es lo que hay hoy.
        await subscribeToPush(userId)
        stampServer(true)
      }
      return res
    } catch {
      return 'denied'
    }
  }, [scheduleNotification, userId, stampServer])

  return { awayMs, dismiss, clear, enableNotifications }
}
