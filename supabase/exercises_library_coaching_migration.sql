-- ============================================================
-- Migración: exercises_library → biblioteca base para coaching
-- Fecha: 2026-05-29
-- Descripción: Agrega columnas de enriquecimiento para soporte
--   de coaching, patrones de movimiento, músculos, dificultad
--   y sustituciones. No elimina ni renombra columnas existentes.
-- ============================================================


-- ── 1. NUEVAS COLUMNAS ────────────────────────────────────────────────────
-- Se usan IF NOT EXISTS para que sea seguro re-ejecutar la migración.
-- muscle_group ya existe — se conserva sin tocar.

alter table exercises_library
  add column if not exists category            text,
  add column if not exists primary_muscles     text[],
  add column if not exists secondary_muscles   text[],
  add column if not exists movement_pattern    text,
  add column if not exists equipment           text[],
  add column if not exists difficulty          text,
  add column if not exists is_compound         boolean,
  add column if not exists tracking_type       text,
  add column if not exists substitution_group  text,
  add column if not exists best_rep_min        integer,
  add column if not exists best_rep_max        integer,
  add column if not exists coaching_notes      text,
  add column if not exists is_active           boolean default true,
  add column if not exists updated_at          timestamptz default now();


-- ── 2. FUNCIÓN Y TRIGGER PARA updated_at ─────────────────────────────────
-- Patrón simple y reutilizable. Si ya existe la función de otro contexto,
-- CREATE OR REPLACE la actualiza sin error.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Crear el trigger solo si no existe ya para esta tabla
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_exercises_library_updated_at'
      and tgrelid = 'exercises_library'::regclass
  ) then
    create trigger trg_exercises_library_updated_at
      before update on exercises_library
      for each row execute function set_updated_at();
  end if;
end;
$$;


-- ── 3. ÍNDICES ────────────────────────────────────────────────────────────
-- Solo para columnas que se usarán en filtros frecuentes del agente y la UI.
-- El índice sobre `name` ya existe (UNIQUE constraint = B-tree implícito).

create index if not exists idx_exercises_library_category
  on exercises_library (category);

create index if not exists idx_exercises_library_movement_pattern
  on exercises_library (movement_pattern);

create index if not exists idx_exercises_library_substitution_group
  on exercises_library (substitution_group);

create index if not exists idx_exercises_library_is_active
  on exercises_library (is_active);


-- ── 4. RLS ────────────────────────────────────────────────────────────────
-- La tabla ya tenía RLS habilitado y una política "Public read" (using true).
-- La reemplazamos por una política que requiere usuario autenticado,
-- que es el modelo correcto para una biblioteca de coaching.
--
-- NOTA: El frontend actual (ActiveWorkout, useDashboard) usa el cliente
-- Supabase con sesión de usuario — la restricción a `authenticated` no
-- romperá ninguna consulta existente en producción.

drop policy if exists "Public read" on exercises_library;

create policy "Lectura para usuarios autenticados"
  on exercises_library
  for select
  using (auth.role() = 'authenticated');

-- INSERT / UPDATE / DELETE: sin política → bloqueados por defecto para
-- clientes normales. Solo el service_role puede escribir.
--
-- ⚠️  ADVERTENCIA: useWorkout.js (líneas ~316 y ~417) intenta hacer
-- un upsert a esta tabla desde el cliente con:
--   supabase.from('exercises_library').upsert({ name, muscle_group: 'Personalizado' }, { onConflict: 'name' })
-- Ese upsert ya estaba fallando silenciosamente ANTES de esta migración
-- porque no había política de INSERT/UPDATE.
--
-- Solución recomendada (paso posterior):
--   Crear una Supabase Edge Function `register-custom-exercise` que use
--   el service_role internamente, y llamarla desde useWorkout.js en lugar
--   del upsert directo. Esto también aplica al Chat y al agente Huberman.
