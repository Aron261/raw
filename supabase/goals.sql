-- Metas de entrenamiento del usuario
-- type: 'exercise_weight'    = peso objetivo en un ejercicio (meta abierta)
--       'days_trained'       = días entrenados en el mes (recurrente, resetea cada mes)
--       'sessions_per_week'  = días entrenados en la semana (recurrente, resetea el lunes)
--       'body_weight'        = peso corporal objetivo (sube o baja, según el inicio)

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

-- ── Tipos nuevos ─────────────────────────────────────────────────────────
-- El check va inline arriba, así que Postgres lo nombró `goals_type_check`.
-- Se reemplaza en vez de editarse porque `create table if not exists` no toca
-- una tabla que ya existe: en una BD viva la restricción vieja seguiría ahí.
alter table goals drop constraint if exists goals_type_check;
alter table goals add constraint goals_type_check check (
  type in ('exercise_weight', 'days_trained', 'sessions_per_week', 'body_weight')
);

-- ── De dónde partiste ────────────────────────────────────────────────────
-- Sin esto el progreso se medía desde cero y una meta de sentadilla 90 → 100
-- nacía al 90 %: el porcentaje contaba la fuerza que ya tenías en vez del
-- tramo que te propusiste. Nulo = meta anterior a la columna; el cliente cae
-- entonces al comportamiento viejo (desde cero) en vez de inventar un origen.
--
-- En body_weight es además lo que da DIRECCIÓN: sin inicio no se puede saber
-- si 76 kg es una bajada o una subida.
alter table goals add column if not exists start_value numeric;

-- ── Plazo ────────────────────────────────────────────────────────────────
-- Una meta sin fecha no se puede incumplir, y por lo tanto tampoco cumplir.
-- Con fecha hay ritmo: cuánto deberías llevar hoy si vas a tiempo.
alter table goals add column if not exists target_date date;

-- ── Cumplida ─────────────────────────────────────────────────────────────
-- Antes, llegar al 100 % solo cambiaba un texto ("Meta cumplida. Crea una
-- nueva.") y la única forma de quitarla de en medio era borrarla — es decir,
-- borrar el logro. Con esta marca una meta cumplida se archiva y se puede
-- seguir viendo: la señal ganada se conserva, que es justo lo que la app dice
-- que valora.
alter table goals add column if not exists completed_at timestamptz;

create index if not exists goals_user_open_idx
  on goals (user_id, completed_at);
