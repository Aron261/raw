# Media y ampliación de la librería de ejercicios

Herramientas para (a) ponerle una animación a cada ejercicio de la librería y
(b) ampliar la librería más allá de los 136 actuales, usando el tier gratuito de
ExerciseDB como fuente de candidatos.

Nada de esto corre en la app. Es un flujo de curación manual que termina en un
`.sql` que se aplica una vez.

## Por qué no se llama a la API desde la app

Se probó. El tier gratuito (`oss.exercisedb.dev`, sin API key) no sirve como
dependencia viva:

| | |
|---|---|
| Paginación | Rota. `limit` se topa en 25, `offset` se ignora, `nextCursor` devuelve siempre el mismo valor. |
| Búsqueda | `/exercises/search?q=` devuelve vacío para todo. No hay forma de resolver un nombre. |
| Rate limit | ~11 peticiones seguidas y Cloudflare corta (429 / error 1015). Sin API key, el límite es por IP: detrás de una edge function lo comparten todos los usuarios. |
| Cobertura | Anuncia 1500. Barriendo por un solo eje se alcanzan 544 (36%). |

Lo que sí funciona son los filtros de taxonomía, y **se pueden combinar**. Pedir
`bodyParts=chest` dice `total=191` y devuelve 25; pedir
`bodyParts=chest&equipments=barbell` dice `total=15` y devuelve los 15. De ahí
sale el harvest: producto cruzado zona × equipamiento (280 consultas), y una
segunda pasada que añade el músculo a las rebanadas que aún no caben.

Resultado: **1219 de 1500 (81%)**. Quedan 12 rebanadas por encima del tope —
`harvest.js` las lista al terminar, para que un corpus incompleto no se lea
como completo.

## Flujo

```bash
node scripts/edb/harvest.js    # ~20 min, una sola vez — cachea data/corpus.json
node scripts/edb/match.js      # instantáneo — genera review/*.tsv
node scripts/edb/review-ui.js  # genera review/review.html
#   ← abre review.html, decide viendo los gifs, y exporta encima de media.tsv
node scripts/edb/emit-sql.js   # genera supabase/exercises_library_media_data.sql
```

`review.html` es la forma práctica de revisar: el TSV sirve para editar en
bloque, pero decidir requiere ver la animación — "dumbbell rear fly" y
"aperturas con mancuernas" solo se distinguen mirando. Acepta con <kbd>A</kbd> y
descarta con <kbd>R</kbd> sobre la tarjeta que tengas bajo el ratón, filtra por
tier o grupo, y edita los nombres in situ. Todo se guarda en localStorage según
lo haces; al final, "Exportar TSV" y pegar sobre `review/media.tsv`.

### Rondas siguientes

Cuando el snapshot ya trae decisiones (`media_reviewed`), `match.js` deja de
tocar `media.tsv` —es el registro de lo curado y regenerarlo lo borraría— y
escribe `review/pendientes.tsv`: solo lo que sigue sin animación, y con hasta
**cuatro candidatos por ejercicio** en vez de uno.

Esa es la lección de la primera ronda: proponer uno solo hacía que rechazarlo
costara la ronda entera, aunque en el corpus hubiera otro que sí valía.

```bash
node scripts/edb/match.js             # → review/pendientes.tsv
node scripts/edb/review-pendientes.js # → review/pendientes.html
#   ← elige una miniatura por ejercicio, o "Ninguna"
node scripts/edb/emit-sql.js
```

`emit-sql` rechaza dos cosas antes de emitir nada: más de una animación
elegida para el mismo ejercicio, y una animación que **ya ilustra otro
ejercicio**. Lo segundo hace falta porque la página de pendientes solo ve lo
que falta —no la librería entera— y desde ahí se puede elegir tranquilamente
un gif que ya está en uso. La comprobación sale de `media_source_id` en el
snapshot, así que no consulta la base.

### Columnas que se editan a mano en media.tsv

`review.html` cubre `ok`, `nombre_nuevo` y `name_en_nuevo`. Dos más se escriben
directamente en el TSV, porque salen de revisar el conjunto y no una fila:

- **`grupo_nuevo`** — corrige `muscle_group` y `primary_muscles`. Hace falta
  cuando una fila se repropone a otro movimiento: "Woodchop en polea alta" pasó
  a ser un face pull pero seguía en Core, y la app agrupa por `muscle_group`.
- **`retirar_por`** — el `nombre` de la fila que la sustituye. No borra: pasa
  sus nombres a alias de la que manda y la marca `is_active = false`. Es para
  cuando dos filas acaban siendo el mismo ejercicio.

Antes de emitir nada, `emit-sql.js` comprueba que no haya dos filas que acaben
con el mismo `name` (es UNIQUE, reventaría la migración a medio aplicar) ni con
el mismo `name_en` (el RPC resolvería a dos filas). Si las hay, falla y las
lista.

### Renombrar

Los dos nombres, español e inglés, son editables en la tarjeta. Al emitir el
SQL, **cada nombre sustituido pasa a `aliases`**. No es cosmético: la identidad
es la fila, pero `get_or_create_exercise` resuelve lo tecleado contra `name`,
`name_en` y `aliases`. Si un nombre viejo desaparece del todo, lo que ya está
escrito en rutinas y en el histórico deja de resolver y se crea un ejercicio
"custom" duplicado — la misma división de historiales que arregló
`exercises_library_bilingual.sql`.

Después, aplicar en este orden:

1. `supabase/exercises_library_media.sql` (columnas — una vez)
2. `supabase/exercises_library_media_data.sql` (datos — cada vez que cures más)

## Los dos TSV

**`review/media.tsv`** — un candidato de gif por cada ejercicio existente.
Columna `ok`: pon `OK` para aceptar, cualquier otra cosa se ignora.

| tier | qué significa |
|---|---|
| `exact` | El nombre coincide literalmente y ningún eje desajusta. Pre-aprobado (`OK`). |
| `strong` | Mismo implemento declarado en ambos lados y buen solape. Revisar. |
| `weak` | Solape flojo, o hay un desajuste blando de agarre/lateralidad. Revisar con cuidado. |
| `(colisión)` | Dos ejercicios distintos apuntan al mismo gif — al menos uno está mal. Nunca pre-aprobado. |
| `sin candidato` | El corpus no tiene nada compatible. |

Con el corpus de 1219, sobre las 136 filas: 22 exact, 58 strong, 24 weak,
21 colisión, 11 sin candidato.

**`review/candidates.tsv`** — ejercicios del corpus que no están en la librería.
Para añadir uno: pon `OK`, escribe `nombre_es` y confirma `grupo`. Sin
`nombre_es` no se emite (la app exige que el idioma mande sobre el nombre).
La columna `encaja` marca si su equipamiento y músculo caben en nuestra
taxonomía; lo que dice `no` suele ser cardio o material que no tenemos.

## El filtro de ejes

Emparejar por parecido de texto produce errores que se leen bien y enseñan mal:
`Peso muerto piernas rígidas` contra `band straight leg deadlift` da 0.86 de
similitud y es otro ejercicio. `taxonomy.js` define cinco ejes en los que dos
nombres casi idénticos son movimientos distintos:

- **implemento** y **postura** son laxos: si un lado calla, no hay conflicto.
  ExerciseDB pone el equipamiento en un campo aparte y la postura casi nunca.
- **ángulo** descarta incluso en asimetría: la ausencia de ángulo *es* plano, y
  la librería tiene filas propias para las variantes inclinada y declinada. Sin
  esa regla, "Press de banca en Smith" se emparejaba con "smith decline bench
  press" a 0.86.
- **agarre** y **lateralidad** descartan solo si los dos lados declaran y no
  coinciden. Si únicamente uno lo dice, el candidato pasa pero baja a `weak`:
  una dominada a secas ya es prona y ExerciseDB no lo escribe, así que tratarlo
  como conflicto dejaba sin candidato a "Dominadas agarre prono" — pero
  ignorarlo colaba "barbell reverse preacher curl" como curl predicador normal.

`taxonomy.test.js` fija esos casos. Si tocas los ejes, corre `npx vitest run
scripts/edb/`.

## Sobre la procedencia

`gif_url` apunta al CDN de ExerciseDB en vez de copiar el archivo a nuestro
storage: enlazar no redistribuye, y los términos del tier gratuito no están
publicados (los que sí lo están cubren el dataset de pago). `media_source` y
`media_source_id` quedan en la fila para poder auditar o deshacer por ejercicio.
Si algún día se compra el dataset, se cambia `gif_url` y ya.

## Refrescar el snapshot de la librería

`data/library.json` es una instantánea de `exercises_library`, no una lectura en
vivo: la tabla exige rol `authenticated` y no vale la pena rebajar esa política
ni meter una service key en el repo. Para regenerarlo, en el SQL editor de
Supabase:

```sql
select json_agg(t order by t.muscle_group, t.name)
from (select name, name_en, aliases, muscle_group, equipment
      from exercises_library where is_active) t;
```
