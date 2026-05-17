-- Tabla de registro de peso corporal
create table if not exists body_weight_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  weight     numeric     not null,
  unit       text        not null default 'kg' check (unit in ('kg', 'lb')),
  logged_at  timestamptz not null default now(),
  note       text
);

-- Row Level Security
alter table body_weight_logs enable row level security;

create policy "Users manage own weight logs"
  on body_weight_logs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índice para consultas por usuario ordenadas por fecha
create index if not exists body_weight_logs_user_date
  on body_weight_logs (user_id, logged_at desc);
