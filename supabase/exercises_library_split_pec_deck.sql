-- El pec deck vuelve a ser un pec deck, y el press de máquina vuelve a existir.
--
-- ── Qué pasó ──────────────────────────────────────────────────────────────
-- En exercises_library_media_data.sql, dos updates seguidos se pisaron:
--
--   1. Se RENOMBRÓ "Pec deck / Mariposa" → "Press de Pecho en Máquina",
--      guardando su antiguo nombre como alias.
--   2. Después se fusionó "Press en máquina pecho" DENTRO de esa misma fila
--      (absorbiendo sus alias) y se le puso is_active = false.
--
-- El resultado es una sola fila que se llama press, responde a los alias del
-- press Y a los del pec deck, y cuyo cuerpo entero seguía siendo el de la
-- apertura: movement_pattern chest_iso, substitution_group aperturas_cruce,
-- is_compound false, 10-15 reps, "codos semiflexionados; junta y aprieta un
-- segundo al centro" y el gif de la máquina de aperturas — con media_reviewed
-- en true, o sea enseñándose. Mientras tanto el press de verdad, con sus datos
-- correctos, estaba apagado y no había forma de encontrarlo.
--
-- Son dos ejercicios distintos: uno es un empuje horizontal compuesto y el otro
-- una apertura de aislamiento. Tenerlos en una fila mezcla dos historiales, dos
-- PRs y dos rangos de repeticiones, y enseña la animación equivocada.
--
-- ── Qué hace esto ─────────────────────────────────────────────────────────
-- No inventa filas: deshace la fusión. La fila del pec deck recupera su nombre
-- (su cuerpo ya era el correcto, no se toca) y suelta los alias del press; la
-- fila del press se reactiva tal como estaba. Cada ejercicio de usuario se
-- reengancha al que de verdad hacía, leyendo el nombre con el que lo guardó.

begin;

-- ── 1. La fila del pec deck recupera su nombre y suelta lo que no es suyo ──
update exercises_library set
  name = 'Pec deck / Mariposa',
  name_en = 'Pec Deck',
  aliases = array['pec deck','pectoral fly machine','chest fly machine','butterfly',
                  'pec fly','machine chest fly','aperturas en maquina','mariposa'],
  updated_at = now()
where name = 'Press de Pecho en Máquina'
  and movement_pattern = 'chest_iso';   -- la señal de que esta es la de aperturas

-- ── 2. El press de máquina vuelve a estar disponible ──────────────────────
-- Su cuerpo ya era correcto (horizontal_push, press_plano, compuesto, 8-12).
-- Solo estaba apagado por la fusión.
update exercises_library set
  is_active = true,
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press de Pecho en Máquina']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press en máquina pecho';

-- ── 3. Quitar de en medio los cascarones vacíos ───────────────────────────
-- Hay un índice único (user_id, library_id): quien ya tenga una fila colgando
-- del press no puede recibir la suya del pec deck. Cuando esa fila que estorba
-- no tiene NADA detrás —ni un entreno, ni una serie, ni una rutina— es un
-- cascarón que la propia fusión dejó, y se va. La condición de las tres cuentas
-- a cero es la que hace esto seguro: nunca borra nada que alguien haya usado.
delete from exercises e
where e.library_id = (select id from exercises_library where name = 'Press en máquina pecho')
  and not exists (select 1 from workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from routine_exercises re where re.exercise_id = e.id)
  and exists (
    select 1 from exercises otra
    where otra.user_id = e.user_id
      and otra.library_id = (select id from exercises_library where name = 'Pec deck / Mariposa')
      and exercise_norm(otra.name) in (
        exercise_norm('Press de Pecho en Máquina'),
        exercise_norm('Press en máquina pecho'),
        exercise_norm('Machine Chest Press')));

-- ── 4. Cada quien a su ejercicio ──────────────────────────────────────────
-- Quien guardó su fila llamándola press estaba haciendo el press: se va a la
-- fila del press. Quien la llamó pec deck se queda donde está, que ahora ya es
-- el pec deck. El nombre con el que cada quien lo guardó es el único dato que
-- dice qué movimiento hacía de verdad.
update exercises e set
  library_id = (select id from exercises_library where name = 'Press en máquina pecho')
where e.library_id = (select id from exercises_library where name = 'Pec deck / Mariposa')
  and exercise_norm(e.name) in (
    exercise_norm('Press de Pecho en Máquina'),
    exercise_norm('Press en máquina pecho'),
    exercise_norm('Machine Chest Press')
  )
  -- Guarda por si quedara algún choque que el paso 3 no pudo limpiar: mejor
  -- dejar una fila mal enganchada que reventar la migración entera.
  and not exists (
    select 1 from exercises otra
    where otra.user_id = e.user_id
      and otra.library_id = (select id from exercises_library where name = 'Press en máquina pecho'));

commit;
