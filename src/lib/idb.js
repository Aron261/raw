// Almacén clave-valor sobre IndexedDB, con respaldo en memoria.
//
// Existe porque dos cosas distintas tienen que sobrevivir a que el sistema
// mate la pestaña en mitad de un entreno: la cola de escrituras (outbox) y la
// foto de la sesión (sessionCache). Antes cada una traía su propia copia de
// este mismo código.
//
// IndexedDB y no localStorage: localStorage es síncrono —bloquea el hilo justo
// cuando alguien está tecleando una serie— y guarda solo texto, así que cada
// lectura costaría un JSON.parse del entreno entero.
//
// El respaldo en memoria no es solo para los tests: hay navegadores que niegan
// IndexedDB en modo privado o con almacenamiento bloqueado. Ahí la app pierde
// la persistencia entre recargas, que es justo lo que esto viene a dar, pero
// sigue funcionando en vez de reventar al abrir la base.

export function memoryStore(keyPath) {
  const map = new Map()
  return {
    async getAll() { return [...map.values()] },
    async get(key) { return map.get(key) ?? null },
    async put(value) { map.set(value[keyPath], value) },
    async delete(key) { map.delete(key) },
    async clear() { map.clear() },
  }
}

export function idbStore({ dbName, storeName, keyPath, version = 1 }) {
  let dbp = null
  const open = () => (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))

  // Se resuelve en `oncomplete`, no en `onsuccess` de la petición: una
  // escritura no está a salvo de un cierre repentino hasta que la transacción
  // entera se confirma, y ese es todo el punto de guardar esto.
  const run = async (mode, fn) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode)
      let value
      const req = fn(t.objectStore(storeName))
      if (req) req.onsuccess = () => { value = req.result }
      t.oncomplete = () => resolve(value)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }

  return {
    getAll: () => run('readonly', s => s.getAll()),
    get: async (key) => (await run('readonly', s => s.get(key))) ?? null,
    put: (value) => run('readwrite', s => { s.put(value); return null }),
    delete: (key) => run('readwrite', s => { s.delete(key); return null }),
    clear: () => run('readwrite', s => { s.clear(); return null }),
  }
}

export function openStore(opts) {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return idbStore(opts)
  } catch { /* entornos con el almacenamiento bloqueado */ }
  return memoryStore(opts.keyPath)
}
