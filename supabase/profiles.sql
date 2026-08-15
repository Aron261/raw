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

-- Zona horaria IANA del dispositivo, sellada por la app al cargar el perfil.
-- El conector MCP la usa para saber qué día es "hoy" para esta persona: con el
-- servidor en UTC, una cena registrada desde Claude a las 8pm de Bogotá caía
-- en el día siguiente.
alter table profiles add column if not exists timezone text;

-- Qué módulos de Estadísticas ve esta persona y en qué orden:
-- { enabled: string[], known: string[], order: string[] }.
--
-- Vivía solo en localStorage. Personalizar la página es un trabajo real —
-- ordenar seis módulos a dedo— y se perdía entero al cambiar de teléfono o al
-- limpiar el navegador, sin ningún aviso ni forma de recuperarlo.
alter table profiles add column if not exists stat_prefs jsonb;
