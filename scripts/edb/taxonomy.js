/*
 * El puente entre dos vocabularios que no se hablan.
 *
 * ExerciseDB describe en inglés y con su propia taxonomía (28 equipamientos,
 * 50 músculos). La librería describe en español y con la nuestra (9
 * equipamientos, 10 grupos). Emparejar por parecido de texto sin traducir
 * primero es como se cuela "band straight leg deadlift" en el sitio de
 * "Peso muerto piernas rígidas".
 *
 * Los ejes discriminantes de abajo son la defensa. No son sinónimos: son las
 * dimensiones en las que dos ejercicios con nombres casi idénticos son
 * movimientos distintos. Si ambos lados declaran valor en un eje y no
 * coinciden, no es un emparejamiento flojo — es un emparejamiento falso.
 */

// Normaliza para comparar: sin acentos, sin puntuación, sin dobles espacios.
export function norm(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const tokens = text => norm(text).split(' ').filter(Boolean)

// ── Eje 1: implemento ────────────────────────────────────────────────────
// El banco no entra: acompaña a la mancuerna y a la barra sin distinguirlas.
const IMPLEMENT = {
  barra:         ['barbell', 'olympic barbell', 'barra', 'barbells'],
  ez:            ['ez barbell', 'ez', 'zbar'],
  mancuerna:     ['dumbbell', 'dumbbells', 'mancuerna', 'mancuernas'],
  polea:         ['cable', 'polea', 'poleas'],
  maquina:       ['leverage machine', 'hammer', 'machine', 'maquina'],
  smith:         ['smith machine', 'smith'],
  peso_corporal: ['body weight', 'bodyweight', 'peso corporal'],
  banda:         ['band', 'resistance band', 'banda', 'goma'],
  kettlebell:    ['kettlebell', 'kettlebells', 'pesa rusa'],
  asistido:      ['assisted', 'asistida', 'asistido'],
  trap:          ['trap bar'],
  barra_dominadas: ['pull up bar', 'barra dominadas'],
  rueda_abs:     ['wheel roller', 'ab wheel', 'rueda abs', 'rueda'],
}

// ── Eje 2: ángulo ────────────────────────────────────────────────────────
// "Plano" no está y es a propósito: la ausencia *es* plano, en los dos
// vocabularios. Cuando estaba, "Press de banca con barra" (alias "flat bench
// press") declaraba `plano`, "barbell bench press" no declaraba nada, y la
// regla estricta los daba por incompatibles — justo el emparejamiento correcto.
const ANGLE = {
  inclinado: ['incline', 'inclined', 'inclinado', 'inclinada', 'inclinadas'],
  declinado: ['decline', 'declined', 'declinado', 'declinada'],
}

// ── Eje 3: agarre ────────────────────────────────────────────────────────
const GRIP = {
  cerrado: ['close grip', 'close', 'cerrado', 'cerrada'],
  ancho:   ['wide grip', 'wide', 'ancho', 'ancha'],
  // "reverse" a secas cuenta: en ExerciseDB marca el agarre invertido
  // ("barbell reverse preacher curl") y sin él ese ejercicio se colaba como
  // buen candidato del curl predicador normal.
  supino:  ['underhand', 'supinated', 'supino', 'supina', 'reverse grip', 'reverse', 'inverso', 'inversa'],
  prono:   ['overhand', 'pronated', 'prono', 'prona'],
  neutro:  ['neutral', 'neutro', 'neutra'],
}

// ── Eje 4: lateralidad ───────────────────────────────────────────────────
const SIDE = {
  unilateral: ['single arm', 'single leg', 'one arm', 'one leg', 'single',
               'unilateral', 'a una mano'],
}

// ── Eje 5: postura ───────────────────────────────────────────────────────
const POSTURE = {
  de_pie:     ['standing', 'de pie'],
  sentado:    ['seated', 'sitting', 'sentado', 'sentada'],
  tumbado:    ['lying', 'supine', 'tumbado', 'tumbada', 'acostado'],
  arrodillado:['kneeling', 'arrodillado', 'arrodillada'],
}

export const AXES = { IMPLEMENT, ANGLE, GRIP, SIDE, POSTURE }

/*
 * Qué valores de un eje declara este texto. Se busca sobre la cadena
 * normalizada porque varias claves son multipalabra ("close grip").
 *
 * De más largo a más corto, tachando lo que ya casó: "barra dominadas" contiene
 * "barra", y sin este orden un ejercicio de dominadas declaraba también el
 * implemento `barra`, que luego chocaba con el "body weight" de ExerciseDB y
 * descartaba el candidato correcto.
 */
function axisValues(axis, haystack) {
  const pares = Object.entries(axis)
    .flatMap(([value, needles]) => needles.map(n => [value, norm(n)]))
    .sort((a, b) => b[1].length - a[1].length)

  const found = new Set()
  let resto = haystack
  for (const [value, needle] of pares) {
    const re = new RegExp(`(^| )${needle}( |$)`)
    if (!re.test(resto)) continue
    found.add(value)
    resto = resto.replace(re, '  ')   // tachado: no lo puede reclamar otro valor
  }
  return found
}

/*
 * El perfil de un ejercicio en los cinco ejes. `sources` son todos los textos
 * que lo describen (nombre, nombre en inglés, alias, equipamiento) — un eje se
 * declara si aparece en cualquiera de ellos.
 */
export function profile(...sources) {
  const hay = ' ' + norm(sources.flat().filter(Boolean).join(' ')) + ' '
  return {
    implement: axisValues(IMPLEMENT, hay),
    angle:     axisValues(ANGLE, hay),
    grip:      axisValues(GRIP, hay),
    side:      axisValues(SIDE, hay),
    posture:   axisValues(POSTURE, hay),
  }
}

/*
 * Conflicto duro: descarta el candidato.
 *
 * Si los dos lados declaran valor en un eje y no comparten ninguno, son
 * movimientos distintos y ya está. El *ángulo* descarta además cuando solo un
 * lado lo declara, porque ahí el silencio sí significa algo: la ausencia de
 * ángulo *es* plano, y la librería tiene filas propias para las variantes
 * inclinada y declinada. Sin esa regla, "Press de banca en Smith" se emparejaba
 * con "smith decline bench press" a 0.86 — mismo implemento, ángulo opuesto.
 *
 * Implemento y postura son laxos: ExerciseDB pone el equipamiento en un campo
 * aparte y la postura casi nunca, así que un hueco ahí es falta de dato.
 */
const EJES = ['implement', 'angle', 'grip', 'side', 'posture']
const declaran = (x, y) => x.size && y.size
const solapan = (x, y) => [...x].some(v => y.has(v))

export function conflicts(a, b) {
  const out = []
  for (const axis of EJES) {
    const x = a[axis], y = b[axis]
    if (declaran(x, y)) { if (!solapan(x, y)) out.push(axis); continue }
    // El ángulo descarta también en asimetría: ver el comentario de arriba.
    if (axis === 'angle' && (x.size || y.size)) out.push(axis)
  }
  return out
}

/*
 * Desajuste blando: no descarta, pero impide dar el emparejamiento por firme.
 *
 * En agarre y lateralidad el silencio no señala un valor concreto — una dominada
 * a secas ya es prona, y ExerciseDB no lo escribe. Tratar eso como conflicto
 * dejaba sin candidato a "Dominadas agarre prono", que sí está en el corpus.
 * Pero ignorarlo cuela "barbell reverse preacher curl" como el curl predicador
 * normal. Ni una cosa ni la otra: pasa, y baja a weak para que lo mire alguien.
 */
export function softMismatch(a, b) {
  const out = []
  for (const axis of ['grip', 'side']) {
    const x = a[axis], y = b[axis]
    if (!declaran(x, y) && (x.size || y.size)) out.push(axis)
  }
  return out
}

// ── Traducción de músculo y grupo ────────────────────────────────────────
// EDB → el vocabulario de la librería. Solo lo que mapea limpio; lo demás
// queda sin traducir y se marca para revisión.
export const MUSCLE_TO_GROUP = {
  pectorals: 'Pecho', chest: 'Pecho', 'upper chest': 'Pecho', serratus_anterior: 'Pecho',
  lats: 'Espalda', 'latissimus dorsi': 'Espalda', 'upper back': 'Espalda',
  rhomboids: 'Espalda', trapezius: 'Espalda', traps: 'Espalda', back: 'Espalda',
  'lower back': 'Espalda', spine: 'Espalda', 'levator scapulae': 'Espalda',
  biceps: 'Bíceps', brachialis: 'Bíceps',
  triceps: 'Tríceps',
  delts: 'Hombro', deltoids: 'Hombro', shoulders: 'Hombro',
  'rear deltoids': 'Hombro', 'rotator cuff': 'Hombro',
  quads: 'Cuádriceps', quadriceps: 'Cuádriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glúteo', abductors: 'Glúteo',
  calves: 'Gemelos', soleus: 'Gemelos',
  abs: 'Core', abdominals: 'Core', obliques: 'Core', core: 'Core',
  'lower abs': 'Core', 'hip flexors': 'Core',
}

export const EQUIP_TO_LIB = {
  barbell: 'barra', 'olympic barbell': 'barra', 'ez barbell': 'barra',
  dumbbell: 'mancuerna', cable: 'polea',
  'leverage machine': 'maquina', hammer: 'maquina',
  'smith machine': 'smith', 'body weight': 'peso_corporal',
  assisted: 'peso_corporal', 'wheel roller': 'rueda_abs',
  kettlebell: 'mancuerna', 'trap bar': 'barra', weighted: 'peso_corporal',
}
