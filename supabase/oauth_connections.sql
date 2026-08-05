-- Conexiones OAuth: verlas y poder cortarlas.
--
-- Raw deja conectar la cuenta a un asistente (el conector de Claude). Hasta
-- ahora esa autorización era de ida: no había ninguna pantalla que dijera qué
-- está conectado, ni forma de revocarlo desde la app. Quien autorizara por
-- error —y el registro dinámico de clientes OAuth hace que alguien pueda
-- registrar uno con un nombre creíble— no tenía manera de deshacerlo.
--
-- Los datos viven en el esquema `auth`, que PostgREST no expone, así que hacen
-- falta dos funciones SECURITY DEFINER en `public`. Cada una filtra por
-- auth.uid(): nadie ve ni corta las conexiones de otra persona.
--
-- Revocar tiene DOS pasos y los dos hacen falta:
--   1. Marcar revoked_at en el consentimiento — impide autorizaciones futuras.
--   2. Borrar la sesión OAuth — es lo que de verdad corta el acceso ya
--      concedido. auth.refresh_tokens cuelga de auth.sessions con ON DELETE
--      CASCADE, así que se van con ella. Sin este paso, marcar el
--      consentimiento sería un gesto cosmético: el token seguiría entrando.
--
-- Solo se borran sesiones con oauth_client_id, nunca la de la app: revocar un
-- conector no puede cerrarte la sesión que estás usando para revocarlo.

-- ── Listar ────────────────────────────────────────────────────────────────
create or replace function public.list_oauth_connections()
returns table (
  id uuid,
  client_name text,
  registration_type text,
  granted_at timestamptz,
  active_sessions int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oc.id,
    coalesce(nullif(btrim(c.client_name), ''), 'Aplicación sin nombre'),
    c.registration_type::text,
    oc.granted_at,
    (select count(*)::int
       from auth.sessions s
      where s.user_id = oc.user_id
        and s.oauth_client_id = oc.client_id)
  from auth.oauth_consents oc
  join auth.oauth_clients c on c.id = oc.client_id
  where oc.user_id = auth.uid()
    and oc.revoked_at is null
  order by oc.granted_at desc;
$$;

comment on function public.list_oauth_connections() is
  'Conexiones OAuth vivas de quien llama. Solo las propias.';

-- ── Revocar ───────────────────────────────────────────────────────────────
create or replace function public.revoke_oauth_connection(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  -- Cortar el acceso de un asistente es una acción de cuenta: no puede hacerla
  -- un asistente. Si no, un conector comprometido podría echar a los demás —
  -- o, peor, revocarse a sí mismo para borrar el rastro tras escribir.
  perform public.assert_app_actor('revocar una conexión');

  select oc.client_id into v_client
    from auth.oauth_consents oc
   where oc.id = p_consent_id
     and oc.user_id = auth.uid()
     and oc.revoked_at is null;

  if v_client is null then
    raise exception 'Conexión no encontrada';
  end if;

  update auth.oauth_consents
     set revoked_at = now()
   where id = p_consent_id
     and user_id = auth.uid();

  -- El paso que de verdad corta: sin esto el token ya emitido seguiría valiendo.
  delete from auth.sessions
   where user_id = auth.uid()
     and oauth_client_id = v_client;
end $$;

comment on function public.revoke_oauth_connection(uuid) is
  'Revoca una conexión OAuth propia y mata sus sesiones. Solo desde la app.';

-- ── Permisos ──────────────────────────────────────────────────────────────
-- Nada de esto tiene sentido sin sesión: anon no las necesita y el linter de
-- Supabase avisa de cualquier DEFINER que anon pueda llamar.
revoke all on function public.list_oauth_connections() from public, anon;
revoke all on function public.revoke_oauth_connection(uuid) from public, anon;
grant execute on function public.list_oauth_connections() to authenticated;
grant execute on function public.revoke_oauth_connection(uuid) to authenticated;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- drop function if exists public.revoke_oauth_connection(uuid);
-- drop function if exists public.list_oauth_connections();
