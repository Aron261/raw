-- Superseries dentro de un entreno.
--
-- Una superserie es una serie de un ejercicio, una del otro, y vuelta a
-- empezar. No cambia lo que se guarda —siguen siendo las mismas series de los
-- mismos ejercicios— así que no hay tabla nueva: solo hace falta saber qué
-- ejercicios van juntos y en qué orden dentro de la vuelta.
--
-- `group_id` nulo = ejercicio suelto, que es el caso normal y el que ya tenían
-- todas las filas existentes. Por eso la columna entra sin default y sin
-- backfill: lo que ya está guardado sigue significando exactamente lo mismo.
--
-- El grupo es del entreno, no del ejercicio: la misma pareja puede ir suelta la
-- semana que viene sin tocar el historial.

alter table public.workout_exercises
  add column if not exists group_id uuid,
  add column if not exists group_order integer not null default 0;

-- Se consulta siempre "los compañeros de este ejercicio en este entreno".
create index if not exists workout_exercises_group_idx
  on public.workout_exercises (workout_id, group_id)
  where group_id is not null;

comment on column public.workout_exercises.group_id is
  'Superserie: las filas que comparten group_id se alternan serie a serie. Nulo = ejercicio suelto.';
comment on column public.workout_exercises.group_order is
  'Posición dentro de la superserie (0 = primero de la vuelta). Sin sentido cuando group_id es nulo.';
