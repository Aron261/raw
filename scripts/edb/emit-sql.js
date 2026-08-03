/*
 * Convierte las hojas ya curadas en SQL idempotente.
 *
 * Solo mira la primera columna. Una fila entra si dice OK; cualquier otra cosa
 * ("?", vacío, "no") se ignora — así el archivo se puede curar en varias
 * sesiones sin que lo pendiente se cuele.
 *
 * De candidates.tsv además exige nombre_es y grupo: un ejercicio nuevo sin
 * nombre en español rompería la regla de la app de que el idioma manda sobre
 * el nombre del ejercicio.
 *
 *   node scripts/edb/emit-sql.js
 *   → supabase/exercises_library_media_data.sql
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REVIEW = join(HERE, 'review')
const OUT = join(HERE, '..', '..', 'supabase', 'exercises_library_media_data.sql')

const SOURCE = 'exercisedb-oss'

const q = v => `'${String(v).replace(/'/g, "''")}'`
const arr = vals => `array[${vals.filter(Boolean).map(q).join(', ')}]::text[]`

// Igual que exercise_norm en SQL: sin acentos, minúsculas, sin espacios de más.
const norm = s => String(s ?? '').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/*
 * Nombres a conservar como alias, sin repetidos. El filtro del SQL compara
 * contra los alias que ya existen, no contra la propia lista: sin este dedup,
 * "Superman" (que se llama igual en los dos idiomas) se añadía dos veces.
 */
const alias = nombres => {
  const vistos = new Set()
  return nombres.filter(n => {
    const k = norm(n)
    if (!k || vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

async function rows(file) {
  let text
  try { text = await readFile(join(REVIEW, file), 'utf8') }
  catch { return [] }
  const [head, ...body] = text.trim().split('\n')
  const cols = head.split('\t')
  return body.filter(Boolean).map(line => {
    const cells = line.split('\t')
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? '').trim()]))
  })
}

async function main() {
  const todas = await rows('media.tsv')
  const media = todas.filter(r => r.ok.toUpperCase() === 'OK' && r.gif_url)
  // Un renombrado es independiente de aceptar el gif: puedes querer arreglar el
  // nombre de un ejercicio cuya animación descartaste.
  const renombrados = todas.filter(r =>
    !r.retirar_por && (
      (r.nombre_nuevo && r.nombre_nuevo !== r.nombre) ||
      (r.name_en_nuevo && r.name_en_nuevo !== r.name_en)))
  const regrupados = todas.filter(r => r.grupo_nuevo && r.grupo_nuevo !== r.grupo)
  const retirados = todas.filter(r => r.retirar_por)
  const nuevos = (await rows('candidates.tsv')).filter(r =>
    r.ok.toUpperCase() === 'OK' && r.nombre_es && r.grupo)

  const skipped = (await rows('candidates.tsv'))
    .filter(r => r.ok.toUpperCase() === 'OK' && (!r.nombre_es || !r.grupo))

  /*
   * Antes de emitir nada: `exercises_library.name` es UNIQUE, y `name_en` es
   * clave de resolución en get_or_create_exercise aunque no tenga constraint.
   * Dos filas que acaban con el mismo nombre no son un detalle — el UNIQUE
   * revienta la migración a medio aplicar, y dos `name_en` iguales hacen que el
   * RPC resuelva a dos filas, que es la ambigüedad que parte los historiales.
   * Mejor fallar aquí, con los nombres delante, que en producción.
   */
  // Una fila retirada sale del reparto de nombres: deja de ser canon, sus
  // nombres pasan a la fila que la sustituye, y resolve_library_exercise ya no
  // la mira (ver exercises_library_retire.sql).
  const finales = todas.filter(r => !r.retirar_por).map(r => ({
    de: r.nombre,
    name: r.nombre_nuevo || r.nombre,
    name_en: r.name_en_nuevo || r.name_en,
  }))
  const choques = []
  for (const campo of ['name', 'name_en']) {
    const porValor = new Map()
    for (const f of finales) {
      const k = f[campo].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      if (!k) continue
      porValor.set(k, [...(porValor.get(k) ?? []), f.de])
    }
    for (const [k, quienes] of porValor) {
      if (quienes.length > 1) choques.push(`${campo} "${k}" ← ${quienes.join('  +  ')}`)
    }
  }
  if (choques.length) {
    throw new Error(
      `${choques.length} choque(s) de nombre; no se emite nada:\n  ` +
      choques.join('\n  ') +
      `\n\nDos filas no pueden acabar con el mismo name (es UNIQUE) ni con el` +
      `\nmismo name_en (get_or_create_exercise resolvería a dos filas).`)
  }

  const out = [
    '-- Generado por scripts/edb/emit-sql.js — no editar a mano.',
    '-- Solo contiene filas marcadas OK en scripts/edb/review/*.tsv.',
    '-- Requiere exercises_library_media.sql aplicado antes.',
    '',
    'begin;',
    '',
  ]

  // Un solo UPDATE contra una lista de valores en vez de 104 sentencias
  // iguales: mismo efecto, una pasada, y el archivo se puede leer de un vistazo.
  /*
   * Rondas posteriores: pendientes.tsv trae varios candidatos por ejercicio y
   * como mucho uno marcado. Se trata igual que media.tsv —misma columna, mismo
   * UPDATE— pero se filtra a la opción elegida, porque las otras tres siguen en
   * el archivo con su `ok` vacío.
   *
   * `nombre` aquí ya es el nombre actual de la fila (el snapshot se refresca
   * cada ronda), así que el WHERE no necesita traducción.
   */
  const pendientes = (await rows('pendientes.tsv'))
    .filter(r => r.ok.toUpperCase() === 'OK' && r.gif_url)
  for (const r of pendientes) media.push(r)

  const dobles = pendientes
    .map(r => r.nombre)
    .filter((n, i, a) => a.indexOf(n) !== i)
  if (dobles.length) {
    throw new Error(
      `Más de una animación elegida para: ${[...new Set(dobles)].join(', ')}.\n` +
      `Cada ejercicio admite una sola.`)
  }

  /*
   * Choques entre rondas: una animación ya asignada a otro ejercicio.
   *
   * La página de la primera ronda avisaba de esto porque veía la librería
   * entera; la de pendientes solo ve lo que falta, así que desde ahí se puede
   * elegir tranquilamente un gif que ya ilustra otra cosa. Y ilustra otra cosa
   * por algo: si "Sentadilla hack con barra" se queda con la animación de
   * "Sentadilla con barra", las dos filas enseñan el mismo movimiento y una de
   * las dos miente.
   *
   * El snapshot trae `media_source_id` de lo ya aprobado, así que se comprueba
   * sin salir a la base.
   */
  const ocupadas = new Map()
  try {
    const snapshot = JSON.parse(
      await readFile(join(HERE, 'data', 'library.json'), 'utf8'))
    for (const r of snapshot) {
      if (r.media_source_id) ocupadas.set(r.media_source_id, r.name)
    }
  } catch { /* sin snapshot no hay nada contra qué comprobar */ }

  const robos = pendientes
    .map(r => ({ r, duena: ocupadas.get(r.edb_id) }))
    .filter(x => x.duena && x.duena !== x.r.nombre)
  if (robos.length) {
    throw new Error(
      `${robos.length} animación(es) ya asignadas a otro ejercicio:\n  ` +
      robos.map(x => `${x.r.edb_id}  ${x.r.nombre}  ←ya la usa→  ${x.duena}`).join('\n  ') +
      `\n\nUn gif no puede ilustrar dos movimientos: elige otra opción, o` +
      `\nquita la que tiene el otro ejercicio si esa es la que estaba mal.`)
  }

  if (media.length) {
    out.push(
      `-- ── Media para ejercicios existentes (${media.length}) ──`,
      `update exercises_library l set`,
      `  gif_url = v.gif, media_source = ${q(SOURCE)}, media_source_id = v.src,`,
      `  media_reviewed = true, updated_at = now()`,
      `from (values`,
      media.map(r => `  (${q(r.nombre)}, ${q(r.gif_url)}, ${q(r.edb_id)})`).join(',\n'),
      `) as v(name, gif, src)`,
      `where l.name = v.name;`,
      '',
    )
  }

  /*
   * Renombrados, en español y/o en inglés.
   *
   * Cada nombre que se sustituye pasa a `aliases`, y esto no es cosmético: la
   * identidad de un ejercicio es su fila, pero `get_or_create_exercise` resuelve
   * lo que se teclea contra name, name_en y aliases. Si un nombre viejo
   * desaparece del todo, lo que ya está escrito en rutinas y en el histórico
   * deja de resolver y se crea un ejercicio "custom" duplicado — justo la
   * división de historiales que arregló exercises_library_bilingual.sql.
   *
   * El filtro por exercise_norm evita duplicar el alias al re-aplicar, y
   * compara sin acentos ni mayúsculas, que es como resuelve el RPC.
   */
  if (renombrados.length) {
    out.push(`-- ── Renombrados (${renombrados.length}) ──`)
    for (const r of renombrados) {
      const cambiaEs = r.nombre_nuevo && r.nombre_nuevo !== r.nombre
      const cambiaEn = r.name_en_nuevo && r.name_en_nuevo !== r.name_en
      const viejos = alias([cambiaEs && r.nombre, cambiaEn && r.name_en])

      out.push(
        `update exercises_library set`,
        ...(cambiaEs ? [`  name = ${q(r.nombre_nuevo)},`] : []),
        ...(cambiaEn ? [`  name_en = ${q(r.name_en_nuevo)},`] : []),
        `  aliases = aliases || (`,
        `    select coalesce(array_agg(n), '{}')`,
        `    from unnest(${arr(viejos)}) n`,
        `    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),`,
        `  updated_at = now()`,
        `where name = ${q(r.nombre)};`,
      )
    }
    out.push('')
  }

  if (nuevos.length) {
    out.push(`-- ── Ejercicios nuevos (${nuevos.length}) ──`)
    for (const r of nuevos) {
      const equip = r.equipamiento ? r.equipamiento.split('+').filter(Boolean) : []
      out.push(
        `insert into exercises_library`,
        `  (name, name_en, muscle_group, primary_muscles, equipment,`,
        `   gif_url, media_source, media_source_id, media_reviewed)`,
        `values (${q(r.nombre_es)}, ${q(r.edb_name)}, ${q(r.grupo)},`,
        `        ${arr([r.grupo])}, ${equip.length ? arr(equip) : 'null'},`,
        `        ${q(r.gif_url)}, ${q(SOURCE)}, ${q(r.edb_id)}, true)`,
        `on conflict (name) do update set`,
        `  gif_url = excluded.gif_url, media_source = excluded.media_source,`,
        `  media_source_id = excluded.media_source_id, media_reviewed = true,`,
        `  updated_at = now();`,
      )
    }
    out.push('')
  }

  /*
   * Grupo muscular corregido. Hace falta cuando una fila se ha repropuesto a
   * otro movimiento: "Woodchop en polea alta" pasó a ser un face pull, pero
   * seguía en Core, y la app agrupa por muscle_group — habría aparecido el
   * jalón a la cara entre los abdominales.
   */
  if (regrupados.length) {
    out.push(`-- ── Grupo muscular corregido (${regrupados.length}) ──`)
    for (const r of regrupados) {
      out.push(
        `update exercises_library`,
        `   set muscle_group = ${q(r.grupo_nuevo)},`,
        `       primary_muscles = ${arr([r.grupo_nuevo])},`,
        `       updated_at = now()`,
        ` where name = ${q(r.nombre_nuevo || r.nombre)};`,
      )
    }
    out.push('')
  }

  /*
   * Retiradas: no se borran, se fusionan.
   *
   * Estas filas quedaron duplicadas porque otra fila se repropuso a lo que
   * ellas eran. Borrarlas rompería cualquier `exercises.library_id` que ya
   * apunte ahí, así que en vez de eso: sus nombres pasan a ser alias de la fila
   * que manda —para que lo ya escrito siga resolviendo, ahora al sitio
   * correcto— y ellas se marcan is_active = false.
   *
   * Que desactivar baste depende de que resolve_library_exercise filtre por
   * is_active; eso lo añade exercises_library_retire.sql, que va antes.
   */
  if (retirados.length) {
    out.push(`-- ── Retiradas por duplicidad (${retirados.length}) ──`)
    for (const r of retirados) {
      const manda = todas.find(o => o.nombre === r.retirar_por)
      if (!manda) throw new Error(`retirar_por desconocido: ${r.retirar_por}`)
      const destino = manda.nombre_nuevo || manda.nombre
      const nombres = alias([r.nombre, r.name_en])
      out.push(
        `-- ${r.nombre} → ${destino}`,
        `update exercises_library set`,
        `  aliases = aliases || (`,
        `    select coalesce(array_agg(n), '{}')`,
        `    from unnest(${arr(nombres)}) n`,
        `    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),`,
        `  updated_at = now()`,
        `where name = ${q(destino)};`,
        `update exercises_library`,
        `   set is_active = false, updated_at = now()`,
        ` where name = ${q(r.nombre)};`,
      )
    }
    out.push('')
  }

  out.push('commit;', '')
  await writeFile(OUT, out.join('\n'))

  process.stderr.write(
    `${media.length} con media · ${renombrados.length} renombrados · ${nuevos.length} nuevos → ${OUT}\n` +
    (skipped.length ? `aviso: ${skipped.length} candidatos OK sin nombre_es o grupo, omitidos\n` : '') +
    (media.length + nuevos.length === 0 ? 'nada marcado OK todavía.\n' : '')
  )
}

main().catch(err => { process.stderr.write(`\n${err.message}\n`); process.exit(1) })
