-- =============================================================================
-- CORRECCIONES DE SEGURIDAD — ejecutar en el SQL editor de Supabase DESPUÉS de
-- trainers.sql y beta_gate.sql. Es idempotente: se puede correr más de una vez.
-- =============================================================================
--
-- Cierra dos huecos de RLS:
--
--   1) Escalada de privilegios en trainer_clients (CRÍTICO)
--      Un usuario podía insertar un vínculo donde él es el cliente (permitido)
--      y luego ACTUALIZARLO para convertirse en ENTRENADOR de una víctima
--      arbitraria, porque la política UPDATE no fijaba trainer_id/client_id.
--      Al volverse "entrenador activo" de la víctima, is_active_trainer_of()
--      le daba lectura de su perfil/entrenos/series y CRUD de sus rutinas/metas.
--
--   2) Bypass del beta gate en profiles (BAJO)
--      La política "Users manage own profile" (FOR ALL) no restringía columnas,
--      así que el cliente podía `update profiles set beta_approved = true`.
--
-- =============================================================================


-- ── 1. trainer_clients: cerrar la escalada de privilegios ───────────────────

-- 1a. El cliente nunca necesita insertar vínculos directamente: el canje ocurre
--     vía redeem_invite() (SECURITY DEFINER, que ya evita el RLS de INSERT).
--     Quitamos la política de inserción directa para eliminar la "fila semilla"
--     que el ataque necesitaba.
drop policy if exists "Client creates own link" on trainer_clients;

-- 1b. Defensa en profundidad: aunque exista una fila, impedir que un UPDATE
--     cambie las partes del vínculo (trainer_id / client_id). Solo se puede
--     tocar `status` (p. ej. revocar). Un trigger es la forma robusta de
--     comparar contra la fila anterior (OLD), algo que WITH CHECK no permite.
create or replace function public.freeze_trainer_link_parties()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.trainer_id <> old.trainer_id or new.client_id <> old.client_id then
    raise exception 'No se pueden cambiar las partes de un vínculo entrenador-cliente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_trainer_link_parties on trainer_clients;
create trigger trg_freeze_trainer_link_parties
  before update on trainer_clients
  for each row execute function public.freeze_trainer_link_parties();


-- ── 2. profiles: impedir que el cliente se auto-apruebe la beta ─────────────

-- La única vía legítima para poner beta_approved = true es redeem_beta_code().
-- Marcamos esa transacción con un flag de sesión; el trigger solo deja pasar el
-- cambio de beta_approved cuando el flag está activo.
create or replace function public.protect_beta_approved()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.beta_approved is distinct from old.beta_approved
     and coalesce(current_setting('app.allow_beta_change', true), 'off') <> 'on'
  then
    -- Ignorar el intento de cambio en vez de fallar: preserva el valor anterior.
    new.beta_approved := old.beta_approved;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_beta_approved on profiles;
create trigger trg_protect_beta_approved
  before update on profiles
  for each row execute function public.protect_beta_approved();

-- redeem_beta_code() debe activar el flag antes de escribir. Recreamos la
-- función idéntica a beta_gate.sql pero con el set_config de la transacción.
create or replace function public.redeem_beta_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select value into v_code from app_settings where key = 'beta_code';
  if v_code is null then
    raise exception 'Beta no configurada';
  end if;
  if upper(trim(p_code)) <> upper(v_code) then
    raise exception 'Código beta inválido';
  end if;

  perform set_config('app.allow_beta_change', 'on', true);  -- solo esta transacción
  insert into profiles (id, beta_approved)
  values (auth.uid(), true)
  on conflict (id) do update set beta_approved = true;
end;
$$;
revoke execute on function public.redeem_beta_code(text) from public;
revoke execute on function public.redeem_beta_code(text) from anon;
grant  execute on function public.redeem_beta_code(text) to authenticated;
