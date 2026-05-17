-- Tabla de perfiles de usuario
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text,
  birth_date   date,
  sex          text check (sex in ('Masculino', 'Femenino', 'Otro')),
  weight       numeric,
  weight_unit  text default 'kg' check (weight_unit in ('kg', 'lb')),
  height       numeric,
  height_unit  text default 'cm' check (height_unit in ('cm', 'ft')),
  level        text check (level in ('Principiante', 'Intermedio', 'Avanzado')),
  goal         text check (goal in ('Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener')),
  days_per_week integer check (days_per_week between 1 and 7),
  updated_at   timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
