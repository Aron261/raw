-- Rutinas: ciclos de entrenamiento y plantillas de un día
--
-- type:   formato de la rutina  → 'cycle' (varios días, puede ser activo)
--                                  'single_day' (un día, NO puede ser activo)
--
-- source: origen de la rutina   → 'manual'        (creada a mano por el usuario)
--                                  'recommended'   (generada por el algoritmo de RAW)
--                                  'from_workout'  (convertida desde un entreno registrado)
--                                  'shared'        (guardada desde el enlace de otra persona)
--
-- Reglas de producto:
--   - Solo los ciclos (type = 'cycle') pueden tener is_active = true.
--   - Las rutinas de un día (type = 'single_day') siempre tienen is_active = false.
--   - Solo un ciclo puede estar activo por usuario a la vez.

create table if not exists routines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  sort_order    integer not null default 0,
  type          text default 'cycle',          -- formato del plan
  source        text default 'manual',         -- origen del plan
  goal          text,                          -- ej: 'Hipertrofia', 'Fuerza'
  level         text,                          -- ej: 'Principiante', 'Intermedio', 'Avanzado'
  days_per_week integer,
  is_active     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Días de la semana dentro de la rutina
create table if not exists routine_days (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid references routines(id) on delete cascade not null,
  day_name   text not null,   -- "Lunes", "Martes", "Día 1", etc.
  day_order  int not null,
  focus      text,            -- "Upper", "Lower", "Push", "Pull", "Full Body", "Rest"
  created_at timestamptz default now()
);

-- Ejercicios dentro de cada día
create table if not exists routine_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  routine_day_id  uuid references routine_days(id) on delete cascade not null,
  exercise_name   text not null,
  exercise_order  int not null,
  sets            int,
  reps            text,          -- "8-12", "5x5", "Al fallo", etc.
  rest_seconds    int,
  notes           text,
  created_at      timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table routines             enable row level security;
alter table routine_days         enable row level security;
alter table routine_day_exercises enable row level security;

-- Nota: en producción existe también "Users manage own routines" (sin with_check).
-- Es un duplicado pendiente de eliminar. La política vigente es la siguiente:
create policy "Users can manage their own routines"
  on routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their routine days"
  on routine_days for all
  using (
    exists (
      select 1 from routines r
      where r.id = routine_days.routine_id
        and r.user_id = auth.uid()
    )
  );

create policy "Users can manage their routine day exercises"
  on routine_day_exercises for all
  using (
    exists (
      select 1 from routine_days rd
      join routines r on r.id = rd.routine_id
      where rd.id = routine_day_exercises.routine_day_id
        and r.user_id = auth.uid()
    )
  );
