/*
 * Descarga el corpus alcanzable de la API gratuita de ExerciseDB.
 *
 * "Alcanzable" no es "todo". La API anuncia 1500 ejercicios y su paginación
 * está rota: `limit` se topa en 25 diga lo que diga, `offset` se ignora, y
 * `nextCursor` devuelve siempre el mismo valor — es un bucle infinito. La
 * búsqueda tampoco funciona (`/search?q=` devuelve vacío para todo).
 *
 * Lo único que sí filtra son los parámetros de taxonomía, y se pueden combinar.
 * Ahí está la salida: pedir "chest" devuelve 191 y solo vemos 25, pero pedir
 * "chest + barbell" devuelve 15 — la rebanada entera. Así que en vez de barrer
 * por un eje, se barre el producto cruzado zona × equipamiento (10 × 28): casi
 * todas las combinaciones caben por debajo del tope de 25 y se capturan
 * completas. Las que no, se avisan al final; ahí sí perdemos datos.
 *
 * Corta a los ~11 requests seguidos (Cloudflare 1015 / HTTP 429), de ahí el
 * throttle y el backoff. Son ~90 peticiones, unos 6 minutos. Se cachea en
 * disco: esto se corre una vez, no en cada emparejamiento.
 *
 *   node scripts/edb/harvest.js
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://oss.exercisedb.dev/api/v1'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'data', 'corpus.json')

const PAGE_MS = 4000   // por debajo de esto llega el 429
const PAGE_MAX = 25    // el techo duro del servidor; pedir más no sirve

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Un 429 no es un fallo del que haya que rendirse: es el ritmo del servidor.
// Backoff creciente y reintento; cualquier otra cosa sí es un error real.
async function get(path, attempt = 1) {
  const res = await fetch(`${API}${path}`)
  if (res.status === 429 || res.status === 403) {
    if (attempt > 5) throw new Error(`rate limited sin recuperación: ${path}`)
    const wait = attempt * 15000
    process.stderr.write(`  · límite alcanzado, esperando ${wait / 1000}s\n`)
    await sleep(wait)
    return get(path, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`)
  const body = await res.json()
  // El endpoint devuelve 200 con cuerpo de error de Cloudflare en algunos casos.
  if (!body || typeof body !== 'object') throw new Error(`respuesta ilegible en ${path}`)
  return body
}

async function taxonomy(name) {
  const { data } = await get(`/${name}`)
  await sleep(PAGE_MS)
  return (data ?? []).map(v => (typeof v === 'string' ? v : v.name ?? Object.values(v)[0]))
}

async function main() {
  process.stderr.write('Leyendo taxonomías…\n')
  const bodyParts = await taxonomy('bodyparts')
  const equipments = await taxonomy('equipments')

  const slices = bodyParts.flatMap(b => equipments.map(e => [b, e]))
  process.stderr.write(
    `${slices.length} combinaciones (~${Math.ceil(slices.length * PAGE_MS / 60000)} min)\n`)

  const byId = new Map()
  const truncadas = []
  for (const [body, equip] of slices) {
    const query = `bodyParts=${encodeURIComponent(body)}&equipments=${encodeURIComponent(equip)}`
    const { data, meta } = await get(`/exercises?${query}&limit=${PAGE_MAX}`)
    for (const ex of data ?? []) if (ex?.exerciseId) byId.set(ex.exerciseId, ex)
    // total > 25 significa que esta rebanada no cabe y estamos perdiendo el resto.
    if ((meta?.total ?? 0) > PAGE_MAX) truncadas.push({ body, equip, total: meta.total })
    if (data?.length) process.stderr.write(`  ${body}+${equip}: ${data.length} → ${byId.size}\n`)
    await sleep(PAGE_MS)
  }

  // Segunda pasada: las rebanadas que no cupieron se parten otra vez, añadiendo
  // el músculo. "upper arms + dumbbell" son 132 y solo vemos 25; separando por
  // bíceps / tríceps / antebrazo, cada trozo ya cabe. Los músculos a probar
  // salen de lo que la primera pasada vio en esa zona, así no se barren los 50.
  if (truncadas.length) {
    process.stderr.write(`\nRefinando ${truncadas.length} rebanadas incompletas…\n`)
    const musclesOf = body => [...new Set(
      [...byId.values()]
        .filter(e => (e.bodyParts ?? []).includes(body))
        .flatMap(e => e.targetMuscles ?? []))]

    const pendientes = truncadas.slice()
    truncadas.length = 0
    for (const { body, equip } of pendientes) {
      for (const muscle of musclesOf(body)) {
        const query = `bodyParts=${encodeURIComponent(body)}` +
                      `&equipments=${encodeURIComponent(equip)}` +
                      `&targetMuscles=${encodeURIComponent(muscle)}`
        const { data, meta } = await get(`/exercises?${query}&limit=${PAGE_MAX}`)
        for (const ex of data ?? []) if (ex?.exerciseId) byId.set(ex.exerciseId, ex)
        if ((meta?.total ?? 0) > PAGE_MAX) truncadas.push({ body, equip, muscle, total: meta.total })
        if (data?.length) process.stderr.write(`  ${body}+${equip}+${muscle}: ${data.length} → ${byId.size}\n`)
        await sleep(PAGE_MS)
      }
    }
  }

  const corpus = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(corpus, null, 2))

  const sinGif = corpus.filter(e => !e.gifUrl).length
  process.stderr.write(`\n${corpus.length} ejercicios únicos → ${OUT}\n`)
  if (sinGif) process.stderr.write(`aviso: ${sinGif} sin gifUrl\n`)
  // Sin esto, un corpus incompleto se lee como completo.
  if (truncadas.length) {
    process.stderr.write(`aviso: ${truncadas.length} rebanadas siguen sobre el tope de ${PAGE_MAX}:\n`)
    for (const t of truncadas) {
      process.stderr.write(`  ${[t.body, t.equip, t.muscle].filter(Boolean).join('+')} (${t.total})\n`)
    }
  }
}

main().catch(err => {
  process.stderr.write(`\n${err.message}\n`)
  process.exit(1)
})
