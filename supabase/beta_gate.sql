-- =============================================================================
-- BETA ACCESS GATE — código compartido + enforcement real vía RLS restrictiva
-- =============================================================================
--
-- Flujo:
--   - Cualquiera puede registrarse/iniciar sesión.
--   - Un usuario NO aprobado no puede leer ni escribir datos (RLS restrictiva).
--   - Canjea el código compartido con redeem_beta_code() → beta_approved = true.
--
-- Gestión:
--   - Cambiar código:     update app_settings set value='NUEVO' where key='beta_code';
--   - Aprobar a alguien:  update profiles set beta_approved=true where id='<uid>';
--   - Salir de beta:      ver bloque comentado al final.
--
-- Correr DESPUÉS de schema.sql / profiles.sql / routines.sql / goals.sql /
-- trainers.sql / body_weight_logs.sql.
-- =============================================================================

-- 1. Flag de aprobación
alter table profiles add column if not exists beta_approved boolean not null default false;

-- 2. Aprobar usuarios existentes para no dejarlos fuera
insert into profiles (id, beta_approved)
select id, true from auth.users
on conflict (id) do update set beta_approved = true;

-- 3. Código beta guardado server-side (sin políticas = solo accesible vía definer)
create table if not exists app_settings (
  key   text primary key,
  value text not null
);
-- El código REAL no vive en el repo (esto es público en GitHub) y este insert
-- no pisa el que ya esté configurado: DO NOTHING, no DO UPDATE — re-ejecutar
-- este archivo pisaba el código vivo con el del repo. Para fijarlo o rotarlo:
--   update app_settings set value = 'NUEVO' where key = 'beta_code';
insert into app_settings (key, value)
values ('beta_code', 'CAMBIA-ESTE-CODIGO')
on conflict (key) do nothing;

alter table app_settings enable row level security;

-- 4. Helper: ¿el usuario actual está aprobado?
create or replace function public.is_beta_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select beta_approved from profiles where id = auth.uid()), false);
$$;
revoke execute on function public.is_beta_approved() from public;
revoke execute on function public.is_beta_approved() from anon;
grant  execute on function public.is_beta_approved() to authenticated;

-- 5. Canjear el código beta
-- Cuerpo CANÓNICO, idéntico al de agent_account_guard.sql: lleva el
-- assert_app_actor (un conector no puede autoaprobarse) y el set_config que
-- exige el trigger de security_fixes.sql. Antes cada archivo tenía su propia
-- versión y re-ejecutar el más viejo borraba en silencio las guardas nuevas.
create or replace function public.redeem_beta_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  perform public.assert_app_actor('canjear el código beta');
  select value into v_code from app_settings where key = 'beta_code';
  if v_code is null then
    raise exception 'Beta no configurada';
  end if;
  if upper(trim(p_code)) <> upper(v_code) then
    raise exception 'Código beta inválido';
  end if;

  perform set_config('app.allow_beta_change', 'on', true);
  insert into profiles (id, beta_approved)
  values (auth.uid(), true)
  on conflict (id) do update set beta_approved = true;
end;
$$;
revoke execute on function public.redeem_beta_code(text) from public;
revoke execute on function public.redeem_beta_code(text) from anon;
grant  execute on function public.redeem_beta_code(text) to authenticated;

-- 6. Candado RLS RESTRICTIVO (AND con las políticas de propiedad existentes).
--    profiles NO se incluye: debe quedar accesible para poder canjear el código.
create policy "Beta gate" on workouts              as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on exercises             as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on workout_exercises     as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on sets                  as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on routines              as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on routine_days          as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on routine_day_exercises as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on goals                 as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on body_weight_logs      as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on trainer_clients       as restrictive for all using (public.is_beta_approved());
create policy "Beta gate" on trainer_invites       as restrictive for all using (public.is_beta_approved());

-- =============================================================================
-- SALIR DE BETA (abrir la app a todos) — ejecutar cuando termine la beta:
-- =============================================================================
-- -- a) Aprobar a todos los usuarios actuales y futuros por defecto:
-- alter table profiles alter column beta_approved set default true;
-- update profiles set beta_approved = true;
-- --
-- -- b) Quitar el candado restrictivo de todas las tablas:
-- drop policy "Beta gate" on workouts;
-- drop policy "Beta gate" on exercises;
-- drop policy "Beta gate" on workout_exercises;
-- drop policy "Beta gate" on sets;
-- drop policy "Beta gate" on routines;
-- drop policy "Beta gate" on routine_days;
-- drop policy "Beta gate" on routine_day_exercises;
-- drop policy "Beta gate" on goals;
-- drop policy "Beta gate" on body_weight_logs;
-- drop policy "Beta gate" on trainer_clients;
-- drop policy "Beta gate" on trainer_invites;
-- =============================================================================
