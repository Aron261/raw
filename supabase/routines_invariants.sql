-- Invariantes de rutinas a nivel de base de datos
--
-- Hasta ahora las "reglas de producto" documentadas en routines.sql (líneas 10-13)
-- solo se cumplían en JavaScript, dentro de setActiveRoutine (src/hooks/useRoutines.js).
-- Eso bastaba mientras la app era el único escritor. Al añadir un segundo escritor
-- (el conector de Claude) las reglas tienen que vivir en Postgres.
--
-- Reglas que se hacen cumplir aquí:
--   1. type   ∈ ('cycle','single_day')
--   2. source ∈ ('manual','recommended','from_workout')
--   3. Solo los ciclos pueden estar activos.
--   4. Solo un ciclo activo por usuario.
--
-- Pre-flight ejecutado antes de aplicar: 2 rutinas, 0 violaciones en las 4 reglas.
--
-- NO se añaden índices únicos sobre (routine_id, day_order) ni
-- (routine_day_id, exercise_order) a propósito: producción ya tiene un duplicado
-- de exercise_order, y addDay/addDayExercise derivan el orden de un read-then-insert
-- que compite. Un índice único convertiría un empate inofensivo de orden de
-- visualización en un fallo de inserción visible para el usuario. El orden denso se
-- garantiza dentro de create_routine_tree, que es donde corresponde.
--
-- Idempotente: se puede volver a ejecutar sin efecto.
-- Rollback: drop constraint / drop index (ver final del archivo).

-- ── 1. Backfill y NOT NULL ────────────────────────────────────────────────
-- No-ops hoy, pero dejan el archivo re-ejecutable sobre cualquier proyecto.

update routines set type      = 'cycle'  where type      is null;
update routines set source    = 'manual' where source    is null;
update routines set is_active = false    where is_active is null;

alter table routines alter column type      set not null;
alter table routines alter column source    set not null;
alter table routines alter column is_active set not null;
alter table routines alter column is_active set default false;

-- ── 2. CHECK constraints ──────────────────────────────────────────────────
-- Postgres no soporta "add constraint if not exists", de ahí los DO blocks.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routines_type_chk') then
    alter table routines add constraint routines_type_chk
      check (type in ('cycle','single_day'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routines_source_chk') then
    alter table routines add constraint routines_source_chk
      check (source in ('manual','recommended','from_workout'));
  end if;
end $$;

-- Regla 3: solo los ciclos pueden estar activos.
-- Antes solo se validaba en useRoutines.js:199-203.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routines_active_only_cycle_chk') then
    alter table routines add constraint routines_active_only_cycle_chk
      check (not is_active or type = 'cycle');
  end if;
end $$;

-- ── 3. Un solo ciclo activo por usuario ───────────────────────────────────
-- Antes solo se garantizaba por el orden de dos updates en useRoutines.js:208-227,
-- que además dejaba al usuario sin ciclo activo si fallaba entre medias.
-- set_active_routine() (routine_tree.sql) hace ambos updates en una transacción
-- para que este índice nunca vea el estado intermedio.

create unique index if not exists routines_one_active_per_user
  on routines (user_id) where is_active;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- drop index  if exists routines_one_active_per_user;
-- alter table routines drop constraint if exists routines_active_only_cycle_chk;
-- alter table routines drop constraint if exists routines_source_chk;
-- alter table routines drop constraint if exists routines_type_chk;
