-- =============================================================================
-- RAW App — Training Cycles Schema
-- Tables: training_cycles, cycle_days, cycle_exercises, cycle_weeks, cycle_memory
-- RLS: users can only access their own data
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. training_cycles
-- ---------------------------------------------------------------------------
create table if not exists training_cycles (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users not null,
  name                text        not null,
  goal                text        not null check (goal in ('Hipertrofia','Fuerza','Fuerza-Hipertrofia','Recomposición')),
  level               text        not null check (level in ('Principiante','Intermedio','Avanzado')),
  days_per_week       int         not null check (days_per_week between 2 and 6),
  duration_weeks      int         not null check (duration_weeks between 6 and 12),
  daily_time_minutes  int         not null check (daily_time_minutes in (45,60,90)),
  split_type          text        not null,
  status              text        not null default 'active' check (status in ('active','closed','extended')),
  start_date          date        not null default current_date,
  end_date            date,
  created_at          timestamptz not null default now()
);

alter table training_cycles enable row level security;

create policy "users_select_own_cycles"
  on training_cycles for select
  using (auth.uid() = user_id);

create policy "users_insert_own_cycles"
  on training_cycles for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_cycles"
  on training_cycles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_delete_own_cycles"
  on training_cycles for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_training_cycles_user_id  on training_cycles (user_id);
create index if not exists idx_training_cycles_status   on training_cycles (user_id, status);
create index if not exists idx_training_cycles_dates    on training_cycles (user_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- 2. cycle_days
-- ---------------------------------------------------------------------------
create table if not exists cycle_days (
  id             uuid    primary key default gen_random_uuid(),
  cycle_id       uuid    references training_cycles on delete cascade not null,
  day_number     int     not null,
  day_name       text    not null,
  muscle_groups  text[]  not null default '{}'
);

alter table cycle_days enable row level security;

-- Access via join to training_cycles.user_id
create policy "users_select_own_cycle_days"
  on cycle_days for select
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_days.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_insert_own_cycle_days"
  on cycle_days for insert
  with check (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_days.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_update_own_cycle_days"
  on cycle_days for update
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_days.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_delete_own_cycle_days"
  on cycle_days for delete
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_days.cycle_id
        and tc.user_id = auth.uid()
    )
  );

-- Indexes
create index if not exists idx_cycle_days_cycle_id    on cycle_days (cycle_id);
create index if not exists idx_cycle_days_day_number  on cycle_days (cycle_id, day_number);

-- ---------------------------------------------------------------------------
-- 3. cycle_exercises
-- ---------------------------------------------------------------------------
create table if not exists cycle_exercises (
  id                 uuid        primary key default gen_random_uuid(),
  cycle_day_id       uuid        references cycle_days on delete cascade not null,
  exercise_name      text        not null,
  sets               int         not null default 3,
  reps_min           int         not null,
  reps_max           int         not null,
  intensity_percent  int,
  week_override      int,
  created_at         timestamptz not null default now()
);

alter table cycle_exercises enable row level security;

-- Access via join through cycle_days → training_cycles
create policy "users_select_own_cycle_exercises"
  on cycle_exercises for select
  using (
    exists (
      select 1
      from cycle_days cd
      join training_cycles tc on tc.id = cd.cycle_id
      where cd.id = cycle_exercises.cycle_day_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_insert_own_cycle_exercises"
  on cycle_exercises for insert
  with check (
    exists (
      select 1
      from cycle_days cd
      join training_cycles tc on tc.id = cd.cycle_id
      where cd.id = cycle_exercises.cycle_day_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_update_own_cycle_exercises"
  on cycle_exercises for update
  using (
    exists (
      select 1
      from cycle_days cd
      join training_cycles tc on tc.id = cd.cycle_id
      where cd.id = cycle_exercises.cycle_day_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_delete_own_cycle_exercises"
  on cycle_exercises for delete
  using (
    exists (
      select 1
      from cycle_days cd
      join training_cycles tc on tc.id = cd.cycle_id
      where cd.id = cycle_exercises.cycle_day_id
        and tc.user_id = auth.uid()
    )
  );

-- Indexes
create index if not exists idx_cycle_exercises_cycle_day_id   on cycle_exercises (cycle_day_id);
create index if not exists idx_cycle_exercises_exercise_name  on cycle_exercises (exercise_name);

-- ---------------------------------------------------------------------------
-- 4. cycle_weeks
-- ---------------------------------------------------------------------------
create table if not exists cycle_weeks (
  id           uuid  primary key default gen_random_uuid(),
  cycle_id     uuid  references training_cycles on delete cascade not null,
  week_number  int   not null,
  status       text  not null default 'pending' check (status in ('pending','active','completed'))
);

alter table cycle_weeks enable row level security;

-- Access via join to training_cycles.user_id
create policy "users_select_own_cycle_weeks"
  on cycle_weeks for select
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_weeks.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_insert_own_cycle_weeks"
  on cycle_weeks for insert
  with check (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_weeks.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_update_own_cycle_weeks"
  on cycle_weeks for update
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_weeks.cycle_id
        and tc.user_id = auth.uid()
    )
  );

create policy "users_delete_own_cycle_weeks"
  on cycle_weeks for delete
  using (
    exists (
      select 1 from training_cycles tc
      where tc.id = cycle_weeks.cycle_id
        and tc.user_id = auth.uid()
    )
  );

-- Indexes
create index if not exists idx_cycle_weeks_cycle_id     on cycle_weeks (cycle_id);
create index if not exists idx_cycle_weeks_week_number  on cycle_weeks (cycle_id, week_number);
create index if not exists idx_cycle_weeks_status       on cycle_weeks (cycle_id, status);

-- ---------------------------------------------------------------------------
-- 5. cycle_memory
-- ---------------------------------------------------------------------------
create table if not exists cycle_memory (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users not null,
  cycle_id            uuid        references training_cycles not null,
  prioritized_groups  text[]      not null default '{}',
  volume_by_group     jsonb       not null default '{}',
  closed_at           timestamptz not null default now()
);

alter table cycle_memory enable row level security;

create policy "users_select_own_cycle_memory"
  on cycle_memory for select
  using (auth.uid() = user_id);

create policy "users_insert_own_cycle_memory"
  on cycle_memory for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_cycle_memory"
  on cycle_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_delete_own_cycle_memory"
  on cycle_memory for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_cycle_memory_user_id   on cycle_memory (user_id);
create index if not exists idx_cycle_memory_cycle_id  on cycle_memory (cycle_id);
create index if not exists idx_cycle_memory_closed_at on cycle_memory (user_id, closed_at desc);
