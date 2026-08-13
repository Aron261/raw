-- Metas de entrenamiento del usuario
-- type: 'exercise_weight' = peso objetivo en un ejercicio (meta abierta)
--       'days_trained'    = días entrenados en el mes (meta mensual, resetea cada mes)

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('exercise_weight', 'days_trained')),
  label text not null,
  exercise_name text,        -- solo para exercise_weight
  target_value numeric not null,
  unit text default 'kg',    -- 'kg', 'lb', 'días'
  is_monthly boolean default false,
  created_at timestamptz default now()
);

alter table goals enable row level security;

create policy "Users can manage their own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Repeticiones objetivo para exercise_weight: "X kg a Y reps" en vez de 1RM
-- estimado. Vivía solo en la BD viva (migración a mano) mientras el cliente y
-- el MCP ya la escribían: un entorno provisionado desde el repo no podía crear
-- metas. El esquema canónico es este archivo — que no vuelva a pasar.
alter table goals add column if not exists target_reps integer
  check (target_reps is null or target_reps between 1 and 100);
