/*
 * Empareja la librería con el corpus de ExerciseDB y produce dos hojas para
 * curar a mano. No escribe en la base de datos: propone.
 *
 * Salidas:
 *   review/media.tsv       — gif candidato para cada uno de los 136 existentes
 *   review/candidates.tsv  — ejercicios del corpus que NO están en la librería,
 *                            para ampliarla
 *
 * Por qué no aplica nada solo: emparejar por parecido de texto produce errores
 * que se leen bien y enseñan mal. "Stiff-Leg Deadlift" contra "band straight
 * leg deadlift" da 0.86 de similitud y es otro ejercicio. El filtro de ejes
 * (taxonomy.js) mata esos casos, pero solo los que declaran su eje; el resto lo
 * decide una persona. Solo las filas marcadas OK llegan a emit-sql.js.
 *
 *   node scripts/edb/match.js
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { norm, tokens, profile, conflicts, softMismatch, MUSCLE_TO_GROUP, EQUIP_TO_LIB } from './taxonomy.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = join(HERE, 'data', 'corpus.json')
const LIBRARY = join(HERE, 'data', 'library.json')
const REVIEW = join(HERE, 'review')

// Umbrales. STRONG exige además que el implemento coincida explícitamente en
// ambos lados; WEAK es "mira esto", no "esto es".
const STRONG = 0.62
const WEAK = 0.42

// Palabras que aparecen en casi todos los nombres y no distinguen nada.
const STOP = new Set(['con', 'en', 'de', 'la', 'el', 'los', 'las', 'a', 'y',
  'the', 'with', 'on', 'to', 'and', 'for'])

const content = text => tokens(text).filter(t => !STOP.has(t) && t.length > 1)

// Dice sobre conjuntos de tokens: tolera orden distinto y palabras de más,
// que es exactamente cómo difieren "Barbell Curl" y "barbell curl standing".
function dice(a, b) {
  const A = new Set(a), B = new Set(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return (2 * shared) / (A.size + B.size)
}

function bestMatch(row, corpus) {
  const libProfile = profile(row.name, row.name_en, row.aliases ?? [], row.equipment ?? [])
  // Se puntúa contra el nombre español, el inglés y cada alias: el alias suele
  // ser justo la forma que usa ExerciseDB.
  const libTexts = [row.name_en, row.name, ...(row.aliases ?? [])].filter(Boolean)
  const libNorms = new Set(libTexts.map(norm))

  let best = null
  for (const ex of corpus) {
    const exProfile = profile(ex.name, ex.equipments ?? [])
    const bad = conflicts(libProfile, exProfile)
    if (bad.length) continue                       // eje incompatible: no es esto

    const exTokens = content(ex.name)
    let score = 0
    for (const text of libTexts) score = Math.max(score, dice(content(text), exTokens))

    const exact = libNorms.has(norm(ex.name))
    if (exact) score = 1

    if (!best || score > best.score) {
      const sharedImplement =
        libProfile.implement.size && exProfile.implement.size &&
        [...libProfile.implement].some(v => exProfile.implement.has(v))
      // Un desajuste blando (agarre o lateralidad que solo declara un lado) no
      // descarta, pero tampoco puede quedar como exact ni como strong: es justo
      // el caso que hay que mirar con ojo.
      const blando = softMismatch(libProfile, exProfile).length > 0
      best = {
        ex, score, exact: exact && !blando,
        tier: exact && !blando ? 'exact'
            : blando ? (score >= WEAK ? 'weak' : 'none')
            : score >= STRONG && sharedImplement ? 'strong'
            : score >= WEAK ? 'weak'
            : 'none',
      }
    }
  }
  return best && best.tier !== 'none' ? best : null
}

const tsv = rows => rows.map(r => r.map(c =>
  String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n') + '\n'

async function main() {
  const corpus = JSON.parse(await readFile(CORPUS, 'utf8'))
  // Instantánea de la librería, no lectura en vivo: exercises_library exige rol
  // `authenticated` y no vale la pena rebajar esa política ni meter una service
  // key en el repo para un script que se corre a mano. Además el snapshot va en
  // git, así que se ve en el diff qué había cuando se curó. Para refrescarlo,
  // ver el SQL en scripts/edb/README.md.
  const library = JSON.parse(await readFile(LIBRARY, 'utf8'))

  // ── Hoja 1: media para lo que ya existe ────────────────────────────────
  const hits = library.map(row => ({ row, hit: bestMatch(row, corpus) }))

  // Un gif no puede ilustrar dos ejercicios distintos. Si dos filas apuntan al
  // mismo id, al menos una está mal — se marcan ambas y no se pre-aprueba
  // ninguna, aunque una fuera idéntica.
  const veces = new Map()
  for (const { hit } of hits) {
    if (hit) veces.set(hit.ex.exerciseId, (veces.get(hit.ex.exerciseId) ?? 0) + 1)
  }

  const claimed = new Set()
  const mediaRows = []
  const counts = { exact: 0, strong: 0, weak: 0, none: 0, colision: 0 }

  for (const { row, hit } of hits) {
    if (!hit) {
      counts.none++
      mediaRows.push(['', row.muscle_group, row.name, row.name_en, 'sin candidato', '', '', '', '', ''])
      continue
    }
    const chocan = veces.get(hit.ex.exerciseId) > 1
    if (chocan) counts.colision++; else counts[hit.tier]++
    claimed.add(hit.ex.exerciseId)
    mediaRows.push([
      hit.tier === 'exact' && !chocan ? 'OK' : '?',   // idéntico y sin disputa
      row.muscle_group, row.name, row.name_en,
      chocan ? `${hit.tier} (colisión)` : hit.tier, hit.score.toFixed(2),
      hit.ex.name,
      (hit.ex.equipments ?? []).join('+'),
      hit.ex.gifUrl,
      hit.ex.exerciseId,
    ])
  }

  // ── Hoja 2: candidatos para ampliar la librería ────────────────────────
  // Se ordenan por si su equipamiento cabe en nuestro vocabulario: lo que no
  // mapea suele ser cardio o material que el gimnasio del usuario no tiene.
  const candidates = corpus
    .filter(ex => !claimed.has(ex.exerciseId))
    .map(ex => {
      const equip = [...new Set((ex.equipments ?? []).map(e => EQUIP_TO_LIB[e]).filter(Boolean))]
      const group = (ex.targetMuscles ?? []).map(m => MUSCLE_TO_GROUP[m]).find(Boolean) ?? ''
      return { ex, equip, group, fits: Boolean(equip.length && group) }
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.group.localeCompare(b.group) || a.ex.name.localeCompare(b.ex.name))

  await mkdir(REVIEW, { recursive: true })
  await writeFile(join(REVIEW, 'media.tsv'), tsv([
    ['ok', 'grupo', 'nombre', 'name_en', 'tier', 'score', 'edb_name', 'edb_equip', 'gif_url', 'edb_id'],
    ...mediaRows,
  ]))
  await writeFile(join(REVIEW, 'candidates.tsv'), tsv([
    ['ok', 'nombre_es', 'grupo', 'equipamiento', 'edb_name', 'edb_target', 'edb_equip', 'encaja', 'gif_url', 'edb_id'],
    ...candidates.map(c => [
      '', '', c.group, c.equip.join('+'),
      c.ex.name, (c.ex.targetMuscles ?? []).join('+'), (c.ex.equipments ?? []).join('+'),
      c.fits ? 'si' : 'no', c.ex.gifUrl, c.ex.exerciseId,
    ]),
  ]))

  const fits = candidates.filter(c => c.fits).length
  process.stderr.write(
    `librería: ${library.length} filas\n` +
    `  exact  ${counts.exact}  (pre-aprobado)\n` +
    `  strong ${counts.strong}  · weak ${counts.weak}\n` +
    `  colisión ${counts.colision}  · sin candidato ${counts.none}\n` +
    `candidatos nuevos: ${candidates.length} (${fits} encajan en la taxonomía)\n\n` +
    `Cura review/media.tsv y review/candidates.tsv, luego:\n` +
    `  node --env-file=.env scripts/edb/emit-sql.js\n`
  )
}

main().catch(err => { process.stderr.write(`\n${err.message}\n`); process.exit(1) })
