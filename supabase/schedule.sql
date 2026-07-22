-- Calendario de entrenamiento: sesiones planificadas (capa libre)
--
-- Raw es rotacional, no basado en fechas: el ciclo activo avanza de día en día
-- a medida que se registran entrenos (getNextRoutineDay). Esta tabla es una capa
-- de planificación INDEPENDIENTE — no toca la rotación. El usuario coloca en un
-- día del calendario lo que piensa hacer: fuerza, cardio, movilidad, descanso,
-- una semana de descarga (deload) o una nota.
--
-- kind:   tipo de sesión planificada
--   'strength' | 'cardio' | 'mobility' | 'rest' | 'deload' | 'note'
--   Cardio y deload son etiquetas (no se registran datos de cardio en v1).
--   Una semana de descarga se marca con una entrada 'deload' en un día; el
--   calendario deriva la franja de esa semana ISO.
--
-- status: 'planned' (por defecto) | 'done' | 'skipped'
--   El entreno REAL se registra en workouts; esto solo refleja la intención.
--   routine_id / routine_day_id vinculan (opcional) una sesión de fuerza a un
--   día de una rutina existente. on delete set null: borrar la rutina no borra
--   el plan del calendario, solo suelta el enlace.

create table if not exists scheduled_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  date           date not null,
  kind           text not null default 'strength'
                   check (kind in ('strength','cardio','mobility','rest','deload','note')),
  title          text,
  routine_id     uuid references routines(id)     on delete set null,
  routine_day_id uuid references routine_days(id) on delete set null,
  notes          text,
  status         text not null default 'planned'
                   check (status in ('planned','done','skipped')),
  sort_order     int  not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists scheduled_sessions_user_date
  on scheduled_sessions(user_id, date);

alter table scheduled_sessions enable row level security;

create policy "Users manage own scheduled_sessions"
  on scheduled_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
