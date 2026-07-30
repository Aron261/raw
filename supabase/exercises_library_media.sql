-- Media para la librería de ejercicios: una imagen por movimiento.
--
-- El problema: la librería describe cada ejercicio con palabras (description,
-- coaching_notes, primary_muscles) pero no lo muestra. Un nombre como
-- "Jalón en polea alta agarre supino" solo significa algo si ya sabes qué es.
--
-- La decisión de fondo: la imagen es un *atributo curado* de la fila, no una
-- llamada en caliente a un tercero. La API gratuita de ExerciseDB no sirve como
-- dependencia viva — su paginación no avanza (el cursor se repite), su búsqueda
-- devuelve vacío siempre, y corta a los ~11 requests seguidos. Solo alcanza a
-- 544 de los 1500 ejercicios que anuncia. Nada de eso importa si la usamos una
-- vez, a mano, para rellenar 136 filas que no cambian.
--
-- Por qué gif_url apunta al CDN de origen y no a nuestro storage: enlazar no
-- redistribuye. Los términos del tier gratuito no están publicados (los que sí
-- lo están cubren el dataset de pago), así que la opción reversible es
-- referenciar, no copiar. media_source/media_source_id existen para que esa
-- decisión sea auditable y se pueda deshacer o re-sincronizar por fila.
--
-- media_reviewed es la puerta: el emparejamiento automático confunde "band
-- straight leg deadlift" con "Peso muerto piernas rígidas" y "dumbbell front
-- raise" con "Elevaciones frontales con barra". Un gif equivocado enseña mal el
-- movimiento, así que la app solo muestra lo que un humano aprobó.

alter table exercises_library
  add column if not exists gif_url          text,
  add column if not exists media_source     text,
  add column if not exists media_source_id  text,
  add column if not exists media_reviewed   boolean not null default false;

comment on column exercises_library.gif_url is
  'URL de la animación del movimiento. Solo se muestra si media_reviewed = true.';
comment on column exercises_library.media_source is
  'Procedencia del medio (p. ej. "exercisedb-oss"). Null si es propio.';
comment on column exercises_library.media_source_id is
  'Id del ejercicio en la fuente, para re-sincronizar o auditar la fila.';
comment on column exercises_library.media_reviewed is
  'Un humano confirmó que el gif corresponde a este movimiento exacto.';

-- Solo se consulta el subconjunto aprobado, y siempre sobre filas activas.
create index if not exists idx_exercises_library_media_reviewed
  on exercises_library (media_reviewed)
  where media_reviewed and gif_url is not null;
