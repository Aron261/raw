-- Longevidad: stack de suplementos (+ registro diario) y bloodwork

create table if not exists supplements (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  name       text        not null,
  dose       text,
  timing     text[]      not null default '{}',  -- ej: {'AM','PM','Pre-entreno'}
  note       text,
  is_active  boolean     not null default true,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

-- Checklist diario: una fila = "hoy tomé este suplemento"
create table if not exists supplement_logs (
  id            uuid  primary key default gen_random_uuid(),
  user_id       uuid  references auth.users not null,
  supplement_id uuid  references supplements(id) on delete cascade not null,
  taken_on      date  not null default current_date,
  created_at    timestamptz not null default now(),
  unique (supplement_id, taken_on)
);

create table if not exists bloodwork_results (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  panel_date date        not null default current_date,
  marker     text        not null,
  value      numeric     not null,
  unit       text,
  ref_low    numeric,
  ref_high   numeric,
  note       text,
  created_at timestamptz not null default now()
);

alter table supplements       enable row level security;
alter table supplement_logs   enable row level security;
alter table bloodwork_results enable row level security;

create policy "Users manage own supplements"
  on supplements for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own supplement logs"
  on supplement_logs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own bloodwork"
  on bloodwork_results for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists supplements_user_order
  on supplements (user_id, sort_order);
create index if not exists supplement_logs_user_date
  on supplement_logs (user_id, taken_on desc);
create index if not exists bloodwork_user_marker_date
  on bloodwork_results (user_id, marker, panel_date desc);

-- Candado beta (ver beta_gate.sql)
create policy "Beta gate" on supplements       as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on supplement_logs   as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on bloodwork_results as restrictive for all using (public.is_beta_approved());
