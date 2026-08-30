-- Buscar por palabras, no por subcadena literal.
--
-- El fallo, tal cual pasó: se teclea "Single Leg Seated Curl" en el gimnasio y
-- la lista sale VACÍA, aunque la biblioteca tiene "Curl femoral sentado" con
-- alias "seated leg curl". Como no hay resultados, el único botón que queda es
-- «+ Crear», y ahí nace un ejercicio nuevo con su historial en blanco. Al día
-- siguiente miras la lista y el ejercicio "ya existía". Lo mismo con "Machine
-- Chest Flyes" contra el alias "chest fly machine".
--
-- La causa es que search_exercise_library usaba position(): exigía que TODO lo
-- tecleado apareciera SEGUIDO y en ese orden dentro de un solo nombre o alias.
-- Tres cosas rompían la búsqueda, y las tres son lo normal al escribir:
--
--   · Una palabra de más    "single leg SEATED curl" vs alias "single leg curl"
--   · Otro orden            "machine chest fly" vs alias "chest fly machine"
--   · Un plural             "flyes" vs "fly"
--
-- Ahora se busca por palabras: cada palabra tecleada tiene que aparecer en
-- ALGÚN sitio de la fila —nombre español, inglés o cualquier alias, todo junto
-- en un mismo pajar—, sin importar el orden ni qué palabra vive en qué campo.
-- Y si aun así no hay nada, entra la semejanza por trigramas, que es la red que
-- recoge las erratas ("bench pres", "sentadila").
--
-- Sigue sin ser SECURITY DEFINER: exercises_library exige rol `authenticated` y
-- esta función respeta esa política. Sigue filtrando is_active, porque un
-- ejercicio retirado ya no es canon y ofrecerlo aquí recrearía el duplicado que
-- retirarlo venía a quitar.

-- ── Palabras de lo tecleado ─────────────────────────────────────────────────
-- exercise_norm ya baja a minúsculas, quita acentos y colapsa espacios; esto
-- solo parte por espacios y tira los huecos.
create or replace function exercise_words(txt text)
returns text[]
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select array_remove(string_to_array(exercise_norm(coalesce(txt, '')), ' '), '')
$$;

-- ── Singular aproximado ─────────────────────────────────────────────────────
-- No es un lematizador: es el mínimo para que un plural no vacíe la pantalla.
-- "flyes" → "fly", "curls" → "curl", "dominadas" → "dominada".
--
-- Se usa SOLO como subcadena, así que pasarse recortando no rompe nada: "press"
-- queda en "pres", que sigue estando dentro de "press de banca". Quedarse corto
-- sí rompería — por eso se recorta, y no al revés.
create or replace function exercise_singular(w text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when length(w) > 4 and right(w, 2) = 'es' then left(w, length(w) - 2)
    when length(w) > 3 and right(w, 1) = 's'  then left(w, length(w) - 1)
    else w
  end
$$;

-- ── Biblioteca ──────────────────────────────────────────────────────────────
create or replace function search_exercise_library(q text, lim int default 12)
returns table (
  id uuid,
  name text,
  name_en text,
  gif_url text,
  media_reviewed boolean
)
language sql
stable
parallel safe
set search_path = public, extensions
as $$
  with needle as (
    select exercise_norm(coalesce(q, '')) as n,
           exercise_words(q) as words
  ),
  hay as (
    select
      l.id, l.name, l.name_en, l.gif_url, l.media_reviewed,
      -- Un solo pajar por fila: así "machine" puede venir del nombre inglés y
      -- "flyes" de un alias, que es justo lo que escribe la gente.
      exercise_norm(
        l.name || ' ' || coalesce(l.name_en, '') || ' ' ||
        coalesce(array_to_string(l.aliases, ' '), '')
      ) as h,
      exercise_norm(l.name) as h_es,
      exercise_norm(coalesce(l.name_en, '')) as h_en
    from exercises_library l
    where coalesce(l.is_active, true)
  ),
  scored as (
    select
      hay.*,
      needle.n,
      (
        select bool_and(
          position(w in hay.h) > 0
          or position(exercise_singular(w) in hay.h) > 0
        )
        from unnest(needle.words) w
      ) as all_words,
      greatest(
        extensions.similarity(hay.h_es, needle.n),
        extensions.similarity(hay.h_en, needle.n)
      ) as sim
    from hay, needle
    where needle.n <> ''
  )
  select id, name, name_en, gif_url, media_reviewed
  from scored
  -- La semejanza es la red de abajo, no la puerta principal: 0.3 deja pasar la
  -- errata y deja fuera el ejercicio que no tiene nada que ver.
  where all_words or sim >= 0.3
  order by
    (h_es = n or h_en = n) desc,                                        -- exacto
    (left(h_es, length(n)) = n or left(h_en, length(n)) = n) desc,      -- empieza por
    all_words desc,                                                     -- todas las palabras
    sim desc,
    name
  limit greatest(coalesce(lim, 12), 1)
$$;

-- ── Los ejercicios de quien busca ───────────────────────────────────────────
-- El modal buscaba lo propio con `ilike '%q%'` sobre `exercises.name` y nada
-- más. Tres agujeros, y el tercero es el que de verdad duele:
--
--   · Subcadena literal, con los mismos tres fallos de arriba.
--   · Sin acentos: "jalon" no encontraba tu "Jalón a la Cara".
--   · Ciego al canon. Tu fila se llama "Curl femoral sentado"; si tecleas
--     "seated leg curl" —el nombre inglés de esa MISMA fila de biblioteca— no
--     aparecía, aunque el ejercicio es tuyo y lo llevas usando meses.
--
-- Ahora lo tuyo se busca por el mismo criterio que el canon, y el pajar incluye
-- el nombre que le pusiste, el de la biblioteca en los dos idiomas y sus alias.
create or replace function search_my_exercises(q text, lim int default 10)
returns table (
  id uuid,
  name text,
  custom_name text,
  library_id uuid,
  gif_url text,
  media_reviewed boolean
)
language sql
stable
parallel safe
set search_path = public, extensions
as $$
  with needle as (
    select exercise_norm(coalesce(q, '')) as n,
           exercise_words(q) as words
  ),
  mine as (
    select
      e.id, e.name, e.custom_name, e.library_id,
      l.gif_url, l.media_reviewed,
      exercise_norm(
        e.name || ' ' || coalesce(e.custom_name, '') || ' ' ||
        coalesce(l.name, '') || ' ' || coalesce(l.name_en, '') || ' ' ||
        coalesce(array_to_string(l.aliases, ' '), '')
      ) as h,
      -- La etiqueta que ve la persona manda en el orden: es lo que cree que
      -- está escribiendo.
      exercise_norm(coalesce(nullif(btrim(e.custom_name), ''), e.name)) as h_label
    from exercises e
    left join exercises_library l on l.id = e.library_id
    where e.user_id = auth.uid()
  ),
  scored as (
    select
      mine.*,
      needle.n,
      (
        select bool_and(
          position(w in mine.h) > 0
          or position(exercise_singular(w) in mine.h) > 0
        )
        from unnest(needle.words) w
      ) as all_words,
      extensions.similarity(mine.h_label, needle.n) as sim
    from mine, needle
    where needle.n <> ''
  )
  select id, name, custom_name, library_id, gif_url, media_reviewed
  from scored
  where all_words or sim >= 0.3
  order by
    (h_label = n) desc,
    (left(h_label, length(n)) = n) desc,
    all_words desc,
    sim desc,
    name
  limit greatest(coalesce(lim, 10), 1)
$$;

revoke all on function search_my_exercises(text, int) from public;
grant execute on function search_my_exercises(text, int) to authenticated;
revoke all on function exercise_words(text) from public;
grant execute on function exercise_words(text) to authenticated;
revoke all on function exercise_singular(text) from public;
grant execute on function exercise_singular(text) to authenticated;
