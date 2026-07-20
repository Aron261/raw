-- Estado de cuenta y privilegios: nunca desde un asistente conectado
--
-- Aplicar DESPUÉS de agent_audit.sql (usa current_actor()).
--
-- ── Por qué existe este archivo ───────────────────────────────────────────
-- La guardia de escritura de agent_audit.sql son políticas RLS restrictivas,
-- y RLS NO se aplica dentro de una función SECURITY DEFINER: esa función se
-- ejecuta como su dueño. Las funciones de abajo son todas SECURITY DEFINER y
-- tocan cosas que ningún asistente debería poder tocar:
--
--   admin_set_admin     — conceder o quitar administrador
--   admin_set_beta      — aprobar el acceso beta de alguien
--   admin_delete_user   — borrar la cuenta de otra persona
--   delete_own_account  — borrar la cuenta propia (irreversible)
--   redeem_beta_code    — autoaprobarse el acceso beta
--   redeem_invite       — vincular un entrenador, que gana acceso a tus datos
--
-- admin_set_admin además hace set_config('app.allow_admin_change','on'), que
-- desactiva a propósito el trigger trg_protect_is_admin. Es decir: la única
-- cosa que hoy impide que un asistente conectado a la cuenta de un admin
-- reparta permisos de administrador es que no le hemos escrito una
-- herramienta. Eso no es una garantía, es una omisión.
--
-- Aquí se convierte en garantía: estas acciones exigen actor 'app'. Un token
-- emitido por OAuth (el que usa un conector) lleva client_id, current_actor()
-- devuelve 'agent', y la función se niega — aunque quien esté detrás sea
-- administrador. Conceder administrador solo puede hacerse desde la app,
-- con una sesión normal.
--
-- Idempotente. Los cuerpos son los originales; lo único añadido es la primera
-- línea de cada uno.

-- ── Helper ────────────────────────────────────────────────────────────────

create or replace function public.assert_app_actor(p_action text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if public.current_actor() <> 'app' then
    raise exception
      'La acción "%" solo puede hacerse desde la app RAW, no desde un asistente conectado.', p_action
      using errcode = '42501';
  end if;
end $$;

comment on function public.assert_app_actor(text) is
  'Rechaza la llamada si el token proviene de un conector OAuth. Para acciones de cuenta y privilegios.';

-- ── Administración ────────────────────────────────────────────────────────

create or replace function public.admin_set_admin(target uuid, value boolean)
returns void language plpgsql security definer set search_path = 'public' as $function$
begin
  perform public.assert_app_actor('cambiar administrador');
  if not public.is_admin() then raise exception 'No autorizado'; end if;
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
$function$;

create or replace function public.admin_set_beta(target uuid, value boolean)
returns void language plpgsql security definer set search_path = 'public' as $function$
begin
  perform public.assert_app_actor('cambiar acceso beta');
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  perform set_config('app.allow_beta_change', 'on', true);
  insert into profiles (id, beta_approved) values (target, value)
  on conflict (id) do update set beta_approved = value;
end;
$function$;

create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = 'public' as $function$
begin
  perform public.assert_app_actor('borrar la cuenta de otra persona');
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
  delete from auth.users where id = target;
end;
$function$;

-- ── Cuenta propia ─────────────────────────────────────────────────────────

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = 'public' as $function$
declare
  uid uuid := auth.uid();
begin
  perform public.assert_app_actor('borrar tu cuenta');
  if uid is null then
    raise exception 'No autenticado';
  end if;

  delete from body_weight_logs   where user_id = uid;
  delete from supplement_logs    where user_id = uid;
  delete from supplements        where user_id = uid;
  delete from bloodwork_results  where user_id = uid;
  delete from nutrition_entries  where user_id = uid;
  delete from nutrition_targets  where user_id = uid;

  delete from auth.users where id = uid;
end;
$function$;

create or replace function public.redeem_beta_code(p_code text)
returns void language plpgsql security definer set search_path = 'public' as $function$
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
$function$;

-- Vincular un entrenador le da acceso de lectura a tus datos y CRUD sobre tus
-- rutinas. Es una decisión sobre quién entra en tu cuenta: se toma en la app.
create or replace function public.redeem_invite(p_code text)
returns uuid language plpgsql security definer set search_path = 'public' as $function$
declare
  v_invite trainer_invites%rowtype;
begin
  perform public.assert_app_actor('vincular un entrenador');

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
$function$;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- Quitar la línea "perform public.assert_app_actor(...)" de cada función y
-- volver a crearla; después: drop function if exists public.assert_app_actor(text);
