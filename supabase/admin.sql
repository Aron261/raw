-- =============================================================================
-- PANEL DE ADMINISTRACIÓN
-- =============================================================================
--
-- Modelo:
--   - profiles.is_admin marca a los administradores. NO es auto-asignable: un
--     trigger revierte cualquier cambio del cliente salvo que la sesión active
--     el flag app.allow_admin_change (solo lo hacen las RPC admin o SQL directo).
--   - Toda la lectura/escritura admin pasa por funciones SECURITY DEFINER que
--     verifican is_admin() primero. Ese es el candado real; ocultar la ruta en
--     el frontend es solo cosmético.
--
-- Ejecutar DESPUÉS de profiles.sql, trainers.sql, beta_gate.sql, etc.
-- Para conceder admin la primera vez, ver el bloque final.
-- =============================================================================

-- ── 1. Columna is_admin + protección ───────────────────────────────────────
alter table profiles add column if not exists is_admin boolean not null default false;

create or replace function public.protect_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_admin is distinct from old.is_admin
     and coalesce(current_setting('app.allow_admin_change', true), 'off') <> 'on'
  then
    new.is_admin := old.is_admin;
  end if;
  if tg_op = 'INSERT'
     and new.is_admin = true
     and coalesce(current_setting('app.allow_admin_change', true), 'off') <> 'on'
  then
    new.is_admin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_admin on profiles;
create trigger trg_protect_is_admin
  before insert or update on profiles
  for each row execute function public.protect_is_admin();

-- ── 2. Helper is_admin() ────────────────────────────────────────────────────
-- SECURITY INVOKER: el usuario puede leer su propia fila de profiles vía RLS,
-- así que no hace falta DEFINER (evita el lint 0029). Dentro de las funciones
-- DEFINER de abajo corre en su contexto y también funciona.
create or replace function public.is_admin()
returns boolean
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- ── 3. Vista general (métricas + series + salud + actividad reciente) ───────
create or replace function public.admin_overview()
returns json
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select json_build_object(
    'metrics', json_build_object(
      'total_users',          (select count(*) from auth.users),
      'beta_approved',        (select count(*) from profiles where beta_approved),
      'admins',               (select count(*) from profiles where is_admin),
      'trainers',             (select count(*) from profiles where is_trainer),
      'active_trainer_links', (select count(*) from trainer_clients where status = 'active'),
      'total_workouts',       (select count(*) from workouts),
      'workouts_7d',          (select count(*) from workouts where started_at >= now() - interval '7 days'),
      'workouts_30d',         (select count(*) from workouts where started_at >= now() - interval '30 days'),
      'total_sets',           (select count(*) from sets),
      'active_users_7d',      (select count(distinct user_id) from workouts where started_at >= now() - interval '7 days'),
      'active_users_30d',     (select count(distinct user_id) from workouts where started_at >= now() - interval '30 days'),
      'signups_7d',           (select count(*) from auth.users where created_at >= now() - interval '7 days'),
      'signups_30d',          (select count(*) from auth.users where created_at >= now() - interval '30 days'),
      'total_messages',       (select count(*) from messages)
    ),
    'signups_series', (
      select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from (
        select d::date as day,
               (select count(*) from auth.users u where u.created_at::date = d::date) as count
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      ) t
    ),
    'workouts_series', (
      select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from (
        select d::date as day,
               (select count(*) from workouts w where w.started_at::date = d::date) as count
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      ) t
    ),
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'health', (
      select coalesce(json_agg(row_to_json(h) order by h.bytes desc), '[]'::json) from (
        select c.relname as table,
               pg_total_relation_size(c.oid) as bytes,
               pg_size_pretty(pg_total_relation_size(c.oid)) as size,
               c.reltuples::bigint as est_rows
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ) h
    ),
    'recent_signups', (
      select coalesce(json_agg(row_to_json(s) order by s.created_at desc), '[]'::json) from (
        select u.id, u.email::text, u.created_at, p.name
        from auth.users u left join profiles p on p.id = u.id
        order by u.created_at desc limit 10
      ) s
    ),
    'recent_workouts', (
      select coalesce(json_agg(row_to_json(w2)), '[]'::json) from (
        select w.id, w.name, w.started_at, p.name as user_name, u.email::text
        from workouts w
        join auth.users u on u.id = w.user_id
        left join profiles p on p.id = w.user_id
        order by w.started_at desc limit 12
      ) w2
    )
  ) into result;

  return result;
end;
$$;

-- ── 4. Listado de usuarios (gestión) ────────────────────────────────────────
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz,
  beta_approved boolean, is_trainer boolean, is_admin boolean,
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
           (select count(*) from workouts w where w.user_id = u.id),
           (select max(w.started_at) from workouts w where w.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

-- ── 5. Mutaciones de gestión ────────────────────────────────────────────────
create or replace function public.admin_set_beta(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  perform set_config('app.allow_beta_change', 'on', true);
  insert into profiles (id, beta_approved) values (target, value)
  on conflict (id) do update set beta_approved = value;
end;
$$;

create or replace function public.admin_set_admin(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  -- No permitir quedarse sin ningún administrador
  if value = false
     and coalesce((select is_admin from profiles where id = target), false)
     and (select count(*) from profiles where is_admin) <= 1
  then
    raise exception 'No puedes quitar el último administrador';
  end if;
  perform set_config('app.allow_admin_change', 'on', true);
  insert into profiles (id, is_admin) values (target, value)
  on conflict (id) do update set is_admin = value;
end;
$$;

create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if target = auth.uid() then
    raise exception 'Usa "Eliminar cuenta" para tu propia cuenta';
  end if;
  delete from body_weight_logs   where user_id = target;
  delete from supplement_logs    where user_id = target;
  delete from supplements        where user_id = target;
  delete from bloodwork_results  where user_id = target;
  delete from nutrition_entries  where user_id = target;
  delete from nutrition_targets  where user_id = target;
  delete from auth.users where id = target;   -- cascade al resto
end;
$$;

-- ── 6. Permisos: solo authenticated puede invocar; el gate real es is_admin() ─
revoke execute on function public.admin_overview()                 from public, anon;
revoke execute on function public.admin_list_users()               from public, anon;
revoke execute on function public.admin_set_beta(uuid, boolean)    from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean)   from public, anon;
revoke execute on function public.admin_delete_user(uuid)          from public, anon;
grant  execute on function public.admin_overview()                 to authenticated;
grant  execute on function public.admin_list_users()               to authenticated;
grant  execute on function public.admin_set_beta(uuid, boolean)    to authenticated;
grant  execute on function public.admin_set_admin(uuid, boolean)   to authenticated;
grant  execute on function public.admin_delete_user(uuid)          to authenticated;

-- ── 7. Conceder admin la primera vez (manual) ───────────────────────────────
-- select set_config('app.allow_admin_change', 'on', true);
-- update profiles set is_admin = true where id = (select id from auth.users where email = 'TU_EMAIL');
