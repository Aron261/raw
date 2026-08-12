-- =============================================================================
-- PLANES — free / pro / coach
-- =============================================================================
--
-- Aplicar DESPUÉS de profiles.sql, admin.sql y agent_account_guard.sql (usa
-- is_admin() y assert_app_actor()).
--
-- Modelo:
--   - profiles.plan marca el nivel: 'free' (por defecto), 'pro' o 'coach'.
--     coach ⊇ pro ⊇ free: un coach tiene todo lo de pro.
--   - NO es auto-asignable, con el mismo patrón que is_admin y beta_approved:
--     un trigger revierte cualquier cambio salvo que la transacción lleve el
--     flag app.allow_plan_change, que solo activa admin_set_plan (RPC admin,
--     vetada para tokens de conector vía assert_app_actor).
--   - La línea de qué es premium vive en el cliente (candados de UI) y en el
--     conector MCP (gate server-side): el registro diario es gratis; el motor
--     de planes, la analítica avanzada, la proyección del ciclo, el motor de
--     nutrición y el conector Claude son pro; el panel de entrenador es coach.
-- =============================================================================

-- ── 1. Columna + protección ─────────────────────────────────────────────────
alter table profiles add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'coach'));

create or replace function public.protect_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.plan is distinct from old.plan
     and coalesce(current_setting('app.allow_plan_change', true), 'off') <> 'on'
  then
    new.plan := old.plan;
  end if;
  -- La fila de profiles la crea el cliente (no hay trigger de signup): sin la
  -- rama de INSERT, un alta directa con plan='coach' se saltaría el candado —
  -- la misma puerta que ya se cerró para is_admin y beta_approved.
  if tg_op = 'INSERT'
     and new.plan <> 'free'
     and coalesce(current_setting('app.allow_plan_change', true), 'off') <> 'on'
  then
    new.plan := 'free';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_plan on profiles;
create trigger trg_protect_plan
  before insert or update on profiles
  for each row execute function public.protect_plan();

-- ── 2. Helpers ──────────────────────────────────────────────────────────────
-- ¿`actual` cubre lo que exige `required`? coach ⊇ pro ⊇ free.
create or replace function public.plan_covers(required text, actual text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case required
    when 'free'  then true
    when 'pro'   then actual in ('pro', 'coach')
    when 'coach' then actual = 'coach'
    else false
  end;
$$;

-- El plan del usuario autenticado. SECURITY INVOKER: la RLS de profiles ya
-- deja leer la fila propia (mismo razonamiento que is_admin()).
create or replace function public.current_plan()
returns text
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce((select plan from profiles where id = auth.uid()), 'free');
$$;

-- ── 3. RPC admin ────────────────────────────────────────────────────────────
create or replace function public.admin_set_plan(target uuid, value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_app_actor('cambiar el plan de una cuenta');
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if value not in ('free', 'pro', 'coach') then
    raise exception 'Plan inválido: %', value;
  end if;
  perform set_config('app.allow_plan_change', 'on', true);
  insert into profiles (id, plan) values (target, value)
  on conflict (id) do update set plan = excluded.plan;
end;
$$;

revoke execute on function public.admin_set_plan(uuid, text) from public, anon;
grant  execute on function public.admin_set_plan(uuid, text) to authenticated;

-- ── 4. admin_list_users con el plan a la vista ──────────────────────────────
-- Cambia el tipo de retorno: hay que soltar la función antes de recrearla.
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz,
  beta_approved boolean, is_trainer boolean, is_admin boolean, plan text,
  workout_count bigint, last_workout_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return query
    select u.id, u.email::text, p.name, u.created_at, u.last_sign_in_at,
           coalesce(p.beta_approved, false), coalesce(p.is_trainer, false), coalesce(p.is_admin, false),
           coalesce(p.plan, 'free'),
           (select count(*) from workouts w where w.user_id = u.id),
           (select max(w.started_at) from workouts w where w.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant  execute on function public.admin_list_users() to authenticated;
