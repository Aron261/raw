-- Users handled by Supabase Auth

create table workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Workout',
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz default now(),
  routine_id     uuid references public.routines(id),
  routine_day_id uuid references public.routine_days(id),
  source         text default 'manual'
);

create table exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique(user_id, name)
);

create table workout_exercises (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references workouts(id) on delete cascade not null,
  exercise_id uuid references exercises(id) on delete cascade not null,
  sort_order integer not null default 0,
  notes text,
  unit text not null default 'lb' check (unit in ('lb', 'kg')),
  created_at timestamptz default now()
);

create table sets (
  id uuid default gen_random_uuid() primary key,
  workout_exercise_id uuid references workout_exercises(id) on delete cascade not null,
  set_number integer not null,
  reps integer not null,
  weight numeric(6,2) not null,
  created_at timestamptz default now()
);

-- Indexes
create index on workouts(user_id, started_at desc);
create index on workout_exercises(workout_id);
create index on sets(workout_exercise_id);

-- RLS
alter table workouts enable row level security;
alter table exercises enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

-- Policies: authenticated users manage their own data
create policy "Users manage own workouts" on workouts for all using (auth.uid() = user_id);
create policy "Users manage own exercises" on exercises for all using (auth.uid() = user_id);
create policy "Users manage own workout_exercises" on workout_exercises for all using (
  workout_id in (select id from workouts where user_id = auth.uid())
);
create policy "Users manage own sets" on sets for all using (
  workout_exercise_id in (
    select we.id from workout_exercises we
    join workouts w on w.id = we.workout_id
    where w.user_id = auth.uid()
  )
);

-- View for external agent: exposes workout data
-- security_invoker = true → la vista respeta el RLS del usuario que consulta
-- (cada usuario solo ve sus propios entrenos; anon no ve nada). service_role
-- omite RLS por diseño para acceso de backend. (linter 0010)
create view public_workout_summary
with (security_invoker = true) as
select
  w.id as workout_id,
  w.user_id,
  w.name as workout_name,
  w.started_at,
  w.ended_at,
  e.name as exercise_name,
  we.unit,
  s.set_number,
  s.reps,
  s.weight,
  round(s.weight * (1 + s.reps::numeric / 30), 2) as estimated_1rm
from workouts w
join workout_exercises we on we.workout_id = w.id
join exercises e on e.id = we.exercise_id
join sets s on s.workout_exercise_id = we.id;

-- El rol anónimo no necesita acceso a la vista.
revoke all on public_workout_summary from anon;
