-- Un ejercicio retirado deja de ser canon.
--
-- `is_active` existía desde exercises_library_coaching_migration.sql, pero
-- resolve_library_exercise nunca lo miró: resolvía contra name, name_en y
-- aliases de *toda* la tabla. Mientras la librería solo crecía daba igual.
--
-- Deja de dar igual en cuanto una fila se repropone a lo que otra ya era. Al
-- curar la media, "Woodchop en polea alta" pasó a ser el face pull y "Face pull
-- en polea" quedó duplicada; con las dos activas, resolver "Face Pull"
-- encontraba dos filas y el `limit 1` elegía una de las dos sin criterio. Eso
-- es exactamente la ambigüedad que parte historiales.
--
-- El cambio es una línea: la fila retirada ya no resuelve. Lo que ya está
-- enlazado por `exercises.library_id` no se toca —no se borra ninguna fila—, y
-- los nombres de la retirada pasan a ser alias de la que la sustituye, así que
-- lo escrito en rutinas sigue resolviendo, ahora al ejercicio correcto.
--
-- coalesce porque is_active es `default true` pero admite null.

create or replace function resolve_library_exercise(txt text)
returns uuid
language sql
stable
parallel safe
set search_path = public
as $$
  select l.id
  from exercises_library l
  where coalesce(l.is_active, true)
    and (
      exercise_norm(l.name) = exercise_norm(txt)
      or exercise_norm(l.name_en) = exercise_norm(txt)
      or exists (
        select 1 from unnest(l.aliases) a
        where exercise_norm(a) = exercise_norm(txt)
      )
    )
  order by
    (exercise_norm(l.name) = exercise_norm(txt)) desc,
    (exercise_norm(l.name_en) = exercise_norm(txt)) desc
  limit 1
$$;
