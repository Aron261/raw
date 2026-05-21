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
