-- Buscar un ejercicio en cualquiera de sus nombres.
--
-- El buscador de "Agregar ejercicio" consultaba `ilike` contra `name` y nada
-- más, o sea solo el nombre en español. Con la app en inglés, teclear "bench
-- press" no encontraba "Press de banca" — aunque el ejercicio esté ahí, aunque
-- la ficha lo llame así y aunque get_or_create_exercise lo resuelva sin
-- problema en cuanto lo escribes entero. Buscar sabía menos que resolver.
--
-- Y `ilike` tampoco es insensible a acentos: "jalon" no encontraba "Jalón".
--
-- Esto busca donde ya vive la identidad — nombre en español, nombre en inglés
-- y alias — normalizando las dos partes con exercise_norm, el mismo criterio
-- que usa resolve_library_exercise. Así lo que se puede escribir se puede
-- encontrar.
--
-- position() en vez de like: lo tecleado entra tal cual en la comparación, y
-- exercise_norm no escapa comodines — un '%' suelto habría hecho de comodín.
--
-- No es SECURITY DEFINER a propósito: exercises_library exige rol
-- `authenticated` y esta función debe respetar esa política igual que las
-- demás. Filtra is_active porque un ejercicio retirado ya no es canon:
-- ofrecerlo aquí crearía el duplicado que retirarlo venía a quitar.

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
set search_path = public
as $$
  with needle as (select exercise_norm(coalesce(q, '')) as n)
  select l.id, l.name, l.name_en, l.gif_url, l.media_reviewed
  from exercises_library l, needle
  where coalesce(l.is_active, true)
    and needle.n <> ''
    and (
      position(needle.n in exercise_norm(l.name)) > 0
      or position(needle.n in exercise_norm(coalesce(l.name_en, ''))) > 0
      or exists (
        select 1 from unnest(l.aliases) a
        where position(needle.n in exercise_norm(a)) > 0
      )
    )
  -- Lo que empieza por lo tecleado antes que lo que solo lo contiene: quien
  -- escribe "press" busca los press, no "Extensión en polea alta con barra"
  -- porque un alias suyo lleva la palabra dentro.
  order by
    (left(exercise_norm(l.name), length(needle.n)) = needle.n
     or left(exercise_norm(coalesce(l.name_en, '')), length(needle.n)) = needle.n) desc,
    l.name
  limit greatest(coalesce(lim, 12), 1)
$$;
