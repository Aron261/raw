-- Ejercicios que la gente ya entrenaba y la librería no tenía.
--
-- Salieron de mirar `exercises` con `library_id is null`: filas que el RPC no
-- supo resolver contra ningún canon y acabaron como "custom". Funcionan, pero
-- quedan fuera de todo lo que cuelga de la librería — nombre bilingüe, grupo
-- muscular curado, y ahora el gif.
--
-- Dos casos distintos, y se arreglan distinto:
--
--   · El ejercicio YA estaba en la librería y solo faltaba el alias. "Plancha"
--     no resolvía a "Plancha frontal" porque los alias eran "plank" y "front
--     plank", ninguno en español corto. Se añade el alias y se borra la fila
--     custom, que era un duplicado sin historial.
--
--   · El ejercicio NO estaba. Se crea la fila de librería y se enlaza la custom
--     por `library_id`, que es lo que conserva el historial: la fila del usuario
--     no se toca ni se renombra, solo pasa a apuntar a su canon. A partir de ahí
--     `exerciseLabel` muestra el nombre de la librería en el idioma de la app.
--
-- Los borrados son solo de filas con 0 entrenos y 0 rutinas — comprobado antes,
-- y hace falta comprobarlo porque routine_exercises y workout_exercises borran
-- en cascada. `Curl femoral tumbado unilateral` y `Single Leg Curl` eran el
-- mismo ejercicio escrito en dos idiomas por la misma persona; se conserva el
-- que tiene historial y se borra el vacío, porque dejar los dos apuntando al
-- mismo canon haría que get_or_create_exercise eligiera uno sin criterio.
--
-- Fuera de aquí, a propósito: "Cable Crossed Extensions" y "Chest Supported
-- Row". El primero no se sabe qué movimiento es exactamente y tiene 9 entrenos
-- detrás; el segundo ya se dejó ambiguo en exercises_library_bilingual.sql
-- ("¿es un remo en máquina o un T-bar con pecho apoyado?"). Los dos siguen como
-- custom hasta que alguien decida; funcionan igual.

begin;

-- ── 1. Ya existía: solo faltaba el alias ────────────────────────────────
update exercises_library
   set aliases = array_append(aliases, 'Plancha'), updated_at = now()
 where name = 'Plancha frontal'
   and exercise_norm('Plancha') not in (select exercise_norm(a) from unnest(aliases) a);

delete from exercises
 where exercise_norm(name) = exercise_norm('Plancha')
   and library_id is null
   and not exists (select 1 from workout_exercises we where we.exercise_id = exercises.id)
   and not exists (select 1 from routine_exercises re where re.exercise_id = exercises.id);

-- ── 2. Filas nuevas de librería ─────────────────────────────────────────
insert into exercises_library
  (name, name_en, aliases, muscle_group, primary_muscles, secondary_muscles,
   category, movement_pattern, equipment, difficulty, is_compound, tracking_type,
   substitution_group, best_rep_min, best_rep_max, description,
   gif_url, media_source, media_source_id, media_reviewed)
values
  ('Peso muerto', 'Deadlift',
   array['deadlift','peso muerto convencional','conventional deadlift','barbell deadlift'],
   'Hamstrings', array['Hamstrings'], array['Glúteo','Espalda'],
   'legs', 'hinge', array['barra'], 'Intermedio', true, 'weight_reps',
   'bisagra_cadera', 3, 8, 'Levantamiento desde el suelo con bisagra de cadera y espalda neutra',
   'https://static.exercisedb.dev/media/ila4NZS.gif', 'exercisedb-oss', 'ila4NZS', true),

  ('Curl femoral tumbado unilateral', 'Single-Leg Lying Leg Curl',
   array['single leg curl','single-leg leg curl','curl femoral unilateral','one leg curl'],
   'Hamstrings', array['Hamstrings'], array['Gemelos'],
   'legs', 'leg_curl_iso', array['maquina'], 'Principiante', false, 'weight_reps',
   'curl_femoral', 8, 15, 'Curl femoral en máquina con una pierna cada vez',
   null, null, null, false),

  ('Hip thrust unilateral en Smith', 'Single-Leg Smith Machine Hip Thrust',
   array['smith hipthrust unilateral','single leg hip thrust','hip thrust unilateral'],
   'Glúteo', array['Glúteo'], array['Hamstrings'],
   'legs', 'hip_extension', array['smith','banco'], 'Intermedio', true, 'weight_reps',
   'empuje_cadera', 8, 12, 'Empuje de cadera en Smith apoyando una sola pierna',
   null, null, null, false),

  ('Remo unilateral en polea', 'Single-Arm Cable Row',
   array['single arm cable row','one arm cable row','remo a una mano en polea'],
   'Espalda', array['Espalda'], array['Bíceps'],
   'pull', 'horizontal_pull', array['polea'], 'Principiante', true, 'weight_reps',
   'remo_horizontal', 8, 12, 'Jale horizontal en polea con un brazo cada vez',
   null, null, null, false),

  ('Abducción unilateral', 'Single-Leg Hip Abduction',
   array['unilateral glute abduction','single leg hip abduction','abduccion unilateral'],
   'Glúteo', array['Glúteo'], null,
   'legs', 'abduction', array['maquina'], 'Principiante', false, 'weight_reps',
   'abduccion', 12, 20, 'Apertura de cadera con una pierna cada vez',
   null, null, null, false)
on conflict (name) do nothing;

-- ── 3. Enlazar lo que ya se entrenaba a su canon nuevo ───────────────────
-- El nombre del usuario no se toca: la identidad es library_id, y el nombre
-- pasa a ser solo la etiqueta que exerciseLabel resuelve según el idioma.
update exercises e
   set library_id = l.id,
       muscle_group = coalesce(e.muscle_group, l.muscle_group)
  from exercises_library l
 where e.library_id is null
   and (
     (exercise_norm(e.name) = exercise_norm('Deadlift')                    and l.name = 'Peso muerto') or
     (exercise_norm(e.name) = exercise_norm('Single Leg Curl')             and l.name = 'Curl femoral tumbado unilateral') or
     (exercise_norm(e.name) = exercise_norm('Smith Hipthrust Unilateral')  and l.name = 'Hip thrust unilateral en Smith') or
     (exercise_norm(e.name) = exercise_norm('Single arm cable row')        and l.name = 'Remo unilateral en polea') or
     (exercise_norm(e.name) = exercise_norm('Unilateral Glute Abduction')  and l.name = 'Abducción unilateral')
   );

-- ── 4. El duplicado vacío del curl femoral unilateral ───────────────────
-- Mismo ejercicio que "Single Leg Curl", escrito en el otro idioma. Sin
-- historial ni rutinas: se borra para que el usuario no acabe con dos filas
-- apuntando al mismo canon.
delete from exercises
 where exercise_norm(name) = exercise_norm('Curl femoral tumbado unilateral')
   and library_id is null
   and not exists (select 1 from workout_exercises we where we.exercise_id = exercises.id)
   and not exists (select 1 from routine_exercises re where re.exercise_id = exercises.id);

commit;
