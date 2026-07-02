-- Nutrición: comidas con macros + objetivos diarios

create table if not exists nutrition_entries (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  eaten_on   date        not null default current_date,
  meal       text        not null default 'snack' check (meal in ('desayuno', 'almuerzo', 'cena', 'snack')),
  name       text        not null,
  kcal       numeric(6,1) not null default 0 check (kcal >= 0),
  protein_g  numeric(5,1) not null default 0 check (protein_g >= 0),
  carbs_g    numeric(5,1) not null default 0 check (carbs_g >= 0),
  fat_g      numeric(5,1) not null default 0 check (fat_g >= 0),
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists nutrition_targets (
  user_id    uuid        primary key references auth.users,
  kcal       integer     not null default 2500 check (kcal > 0),
  protein_g  integer     not null default 160 check (protein_g >= 0),
  carbs_g    integer     not null default 280 check (carbs_g >= 0),
  fat_g      integer     not null default 80 check (fat_g >= 0),
  updated_at timestamptz not null default now()
);

alter table nutrition_entries enable row level security;
alter table nutrition_targets enable row level security;

create policy "Users manage own nutrition entries"
  on nutrition_entries for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own nutrition targets"
  on nutrition_targets for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists nutrition_entries_user_date
  on nutrition_entries (user_id, eaten_on desc);

-- Candado beta (ver beta_gate.sql)
create policy "Beta gate" on nutrition_entries as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on nutrition_targets as restrictive for all using (public.is_beta_approved());
