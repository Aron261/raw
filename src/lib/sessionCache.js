// Foto persistente del entreno en curso.
//
// El outbox ya salva lo que se ESCRIBE sin conexión, pero no lo que se LEE: la
// caché de la app vive en un Map en memoria, así que si el sistema mata la
// pestaña —o alguien recarga— en un sótano sin señal, el shell arranca y el
// entreno no. Las series seguían a salvo en la cola, pero invisibles: no se
// podían ver ni seguir registrando. Esto guarda, tras cada cambio, lo que la
// pantalla está mostrando, para poder volver a pintarlo sin red.
//
// Se guarda el estado LOCAL, no la respuesta del servidor: incluye las series
// que aún están en la cola. Si se guardara lo último traído del servidor, una
// recarga sin conexión borraría de la vista justo las series que todavía no
// han podido sincronizarse, que son las que más falta hacen.
//
// Se borra al cerrar sesión, por lo mismo que el outbox: esto es el entreno de
// una persona en un dispositivo y no puede filtrarse a la siguiente cuenta.

import { openStore } from './idb'

const STORE = { dbName: 'raw-session', storeName: 'workouts', keyPath: 'workoutId' }

export function createSessionCache(store = openStore(STORE)) {
  return {
    async save(workoutId, { workout, workoutExercises }) {
      if (!workoutId || !workout) return
      await store.put({
        workoutId,
        savedAt: Date.now(),
        workout,
        workoutExercises: workoutExercises || [],
      })
    },

    async load(workoutId) {
      if (!workoutId) return null
      const snap = await store.get(workoutId)
      return snap?.workout ? snap : null
    },

    // Al finalizar: el entreno ya está cerrado en el servidor y su foto solo
    // ocuparía sitio. Sin esto, cada sesión dejaría una copia para siempre.
    async remove(workoutId) {
      if (!workoutId) return
      await store.delete(workoutId)
    },

    async clear() { await store.clear() },
  }
}

export const sessionCache = createSessionCache()
