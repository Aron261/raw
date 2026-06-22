-- =============================================================================
-- MÓDULO DE ENTRENADORES (trainer / cliente)
-- =============================================================================
--
-- Modelo:
--   - Cualquier usuario puede activar is_trainer en su perfil (roles combinables:
--     un entrenador puede seguir entrenando él mismo).
--   - El entrenador genera un CÓDIGO de invitación (trainer_invites). El cliente
--     lo canjea con la función redeem_invite() y se crea el vínculo en
--     trainer_clients con status = 'active'.
--   - Las rutinas y metas que el entrenador asigna se insertan en las tablas
--     PROPIAS del cliente (routines / goals), marcadas con assigned_by = trainer.
--     El cliente las ve junto a las suyas.
--
-- Seguridad (RLS):
--   - Las políticas existentes (owner-only) NO se tocan: se AÑADEN nuevas.
--   - Un entrenador con vínculo 'active' puede:
--       · leer el perfil, entrenos, ejercicios y series del cliente (solo lectura)
--       · gestionar (CRUD) las rutinas y metas del cliente
--   - Se usa el helper is_active_trainer_of() (SECURITY DEFINER) para evaluar el
--     vínculo sin recursión de RLS sobre trainer_clients.
--
-- Orden de ejecución: correr este archivo en el SQL editor de Supabase DESPUÉS
-- de schema.sql, profiles.sql, routines.sql y goals.sql.
-- =============================================================================


-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────

alter table profiles add column if not exists is_trainer boolean not null default false;

-- assigned_by = null  → lo creó el propio usuario
-- assigned_by = <uid> → lo asignó ese entrenador
alter table routines add column if not exists assigned_by uuid references auth.users(id) on delete set null;
alter table goals    add column if not exists assigned_by uuid references auth.users(id) on delete set null;


-- ── 2. Tabla de vínculos entrenador ↔ cliente ──────────────────────────────

create table if not exists trainer_clients (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references auth.users(id) on delete cascade not null,
  status      text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  created_at  timestamptz default now(),
  unique (trainer_id, client_id)
);

create index if not exists idx_trainer_clients_trainer on trainer_clients(trainer_id, status);
create index if not exists idx_trainer_clients_client  on trainer_clients(client_id, status);


-- ── 3. Tabla de códigos de invitación ──────────────────────────────────────

create table if not exists trainer_invites (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid references auth.users(id) on delete cascade not null,
  code        text unique not null,
  expires_at  timestamptz,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists idx_trainer_invites_trainer on trainer_invites(trainer_id);


-- ── 4. Helper: ¿el usuario actual es entrenador activo de <target>? ─────────
-- SECURITY DEFINER para saltar RLS sobre trainer_clients y evitar recursión
-- cuando se usa dentro de otras políticas.

create or replace function public.is_active_trainer_of(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from trainer_clients tc
    where tc.trainer_id = auth.uid()
      and tc.client_id  = target
      and tc.status     = 'active'
  );
$$;


-- ── 5. RLS: trainer_clients ────────────────────────────────────────────────

alter table trainer_clients enable row level security;

-- Ver: tanto el entrenador como el cliente ven sus propios vínculos.
create policy "View own trainer links"
  on trainer_clients for select
  using (trainer_id = auth.uid() or client_id = auth.uid());

-- Crear: solo el propio cliente puede crear un vínculo donde él es el cliente
-- (esto ocurre vía redeem_invite, pero la política protege inserciones directas).
create policy "Client creates own link"
  on trainer_clients for insert
  with check (client_id = auth.uid());

-- Actualizar (p. ej. revocar): cualquiera de las dos partes.
create policy "Either party updates link"
  on trainer_clients for update
  using (trainer_id = auth.uid() or client_id = auth.uid())
  with check (trainer_id = auth.uid() or client_id = auth.uid());

-- Eliminar: cualquiera de las dos partes.
create policy "Either party deletes link"
  on trainer_clients for delete
  using (trainer_id = auth.uid() or client_id = auth.uid());


-- ── 6. RLS: trainer_invites ────────────────────────────────────────────────

alter table trainer_invites enable row level security;

-- El entrenador gestiona (crea / lista / borra) sus propios códigos.
-- El cliente NO necesita leer esta tabla: canjea vía redeem_invite (definer).
create policy "Trainer manages own invites"
  on trainer_invites for all
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());


-- ── 7. Función para canjear un código (lado cliente) ───────────────────────
-- SECURITY DEFINER: permite leer el código y crear el vínculo sin exponer la
-- tabla trainer_invites al cliente. Retorna el trainer_id vinculado.

create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite trainer_invites%rowtype;
begin
  select * into v_invite
  from trainer_invites
  where code = upper(trim(p_code))
    and (expires_at is null or expires_at > now())
    and used_by is null
  limit 1;

  if v_invite.id is null then
    raise exception 'Código inválido, ya usado o expirado';
  end if;

  if v_invite.trainer_id = auth.uid() then
    raise exception 'No puedes vincularte contigo mismo';
  end if;

  insert into trainer_clients (trainer_id, client_id, status)
  values (v_invite.trainer_id, auth.uid(), 'active')
  on conflict (trainer_id, client_id) do update set status = 'active';

  update trainer_invites
     set used_by = auth.uid(), used_at = now()
   where id = v_invite.id;

  return v_invite.trainer_id;
end;
$$;


-- ── 8. RLS añadida para acceso del entrenador a datos del cliente ──────────
-- IMPORTANTE: estas políticas se SUMAN a las owner-only existentes (OR lógico).

-- Perfil del cliente — solo lectura
create policy "Trainers read client profiles"
  on profiles for select
  using (public.is_active_trainer_of(id));

-- Rutinas del cliente — CRUD completo (asignar / editar / activar / borrar)
create policy "Trainers manage client routines"
  on routines for all
  using (public.is_active_trainer_of(user_id))
  with check (public.is_active_trainer_of(user_id));

create policy "Trainers manage client routine days"
  on routine_days for all
  using (
    exists (
      select 1 from routines r
      where r.id = routine_days.routine_id
        and public.is_active_trainer_of(r.user_id)
    )
  );

create policy "Trainers manage client routine day exercises"
  on routine_day_exercises for all
  using (
    exists (
      select 1 from routine_days rd
      join routines r on r.id = rd.routine_id
      where rd.id = routine_day_exercises.routine_day_id
        and public.is_active_trainer_of(r.user_id)
    )
  );

-- Metas del cliente — CRUD completo
create policy "Trainers manage client goals"
  on goals for all
  using (public.is_active_trainer_of(user_id))
  with check (public.is_active_trainer_of(user_id));

-- Progreso del cliente — solo lectura (entrenos, ejercicios, series)
create policy "Trainers read client workouts"
  on workouts for select
  using (public.is_active_trainer_of(user_id));

create policy "Trainers read client exercises"
  on exercises for select
  using (public.is_active_trainer_of(user_id));

create policy "Trainers read client workout_exercises"
  on workout_exercises for select
  using (
    exists (
      select 1 from workouts w
      where w.id = workout_exercises.workout_id
        and public.is_active_trainer_of(w.user_id)
    )
  );

create policy "Trainers read client sets"
  on sets for select
  using (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id
        and public.is_active_trainer_of(w.user_id)
    )
  );
