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

-- Biblioteca personal de comidas: cada comida registrada se guarda aquí con
-- su porción base (ej. 100 g, 1 unidad) para reutilizarla sin volver a
-- escribir macros. name_norm = lower(trim(name)) — el cliente usa el mismo
-- criterio para el upsert.
create table if not exists nutrition_foods (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         references auth.users not null,
  name         text         not null,
  name_norm    text         not null,
  serving_qty  numeric(6,1) not null default 1 check (serving_qty > 0),
  serving_unit text         not null default 'porción',
  kcal         numeric(6,1) not null default 0 check (kcal >= 0),
  protein_g    numeric(5,1) not null default 0 check (protein_g >= 0),
  carbs_g      numeric(5,1) not null default 0 check (carbs_g >= 0),
  fat_g        numeric(5,1) not null default 0 check (fat_g >= 0),
  times_used   integer      not null default 1,
  last_used_at timestamptz  not null default now(),
  created_at   timestamptz  not null default now(),
  unique (user_id, name_norm)
);

alter table nutrition_foods enable row level security;

create policy "Users manage own nutrition foods"
  on nutrition_foods for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Beta gate" on nutrition_foods as restrictive for all using (public.is_beta_approved());

create index if not exists nutrition_foods_user_used
  on nutrition_foods (user_id, last_used_at desc);

-- Backfill una vez desde el historial: macros de la entrada más reciente
-- por nombre, frecuencia como times_used.
insert into nutrition_foods (user_id, name, name_norm, kcal, protein_g, carbs_g, fat_g, times_used, last_used_at, created_at)
select distinct on (user_id, lower(trim(name)))
  user_id, name, lower(trim(name)), kcal, protein_g, carbs_g, fat_g,
  (count(*) over (partition by user_id, lower(trim(name))))::int,
  max(created_at) over (partition by user_id, lower(trim(name))),
  min(created_at) over (partition by user_id, lower(trim(name)))
from nutrition_entries
order by user_id, lower(trim(name)), created_at desc
on conflict (user_id, name_norm) do nothing;
