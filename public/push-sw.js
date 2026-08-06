// Lo que hace el service worker cuando llega un push.
//
// Va aparte del service worker generado por vite-plugin-pwa y se engancha con
// `workbox.importScripts`. Podría haberse pasado el proyecto a `injectManifest`
// para escribir un service worker propio entero, pero eso significa hacerse
// cargo también de todo el precacheo y las reglas de red que hoy genera el
// plugin — mucho más que perder, y a cambio de nada: estos dos listeners no
// necesitan tocar nada de eso.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* sin cuerpo legible */ }

  // El permiso se concedió con `userVisibleOnly`, así que hay que enseñar algo
  // sí o sí: un push que no acaba en notificación se lo apunta el navegador y,
  // repetido, retira el permiso. Por eso hay texto de respaldo.
  const title = data.title || 'Raw'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Tienes un entreno abierto.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Uno por entreno: si el aviso se repite, reemplaza al anterior en vez de
    // apilar tres notificaciones de lo mismo.
    tag: data.tag || 'raw-workout',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  // Si la app ya está abierta en alguna ventana, se reutiliza y se lleva al
  // entreno. Abrir una pestaña nueva encima de una sesión en curso es la forma
  // más rápida de acabar con dos vistas del mismo entreno.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(url).catch(() => {})
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
