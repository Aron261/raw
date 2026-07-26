-- Compartir un ciclo o una rutina por enlace
--
-- Aplicar DESPUÉS de routine_tree.sql (usa routine_snapshot) y beta_gate.sql.
-- Orden: routines_invariants.sql → agent_audit.sql → routine_tree.sql → routine_shares.sql
--
-- ── Qué resuelve ──────────────────────────────────────────────────────────
-- Hasta ahora un plan solo llegaba a otra persona por el vínculo entrenador ↔
-- cliente (trainers.sql), que exige que esa persona canjee un código y quede
-- vinculada. Para "mándale el ciclo a un amigo" eso es demasiado: aquí el dueño
-- genera un enlace, quien lo abre ve el plan aunque no tenga cuenta, y si
-- quiere se lo guarda como rutina propia.
--
-- ── Modelo ────────────────────────────────────────────────────────────────
-- Un enlace es una CAPACIDAD: el token es el permiso. No hay lista de invitados
-- ni caducidad; quien tenga el enlace ve el plan hasta que el dueño lo desactive
-- (revoked_at). Como el token vale por sí solo, se generan 88 bits de aleatorio
-- y la respuesta es idéntica para un token inexistente y uno desactivado —
-- probar tokens no distingue "nunca existió" de "ya no vale".
--
-- El enlace muestra el plan EN VIVO, no una copia congelada: si el dueño
-- corrige una serie, quien abra el enlace ve la corrección. Lo que se comparte
-- es solo el plan (días, ejercicios, series/reps) y el nombre del dueño; nunca
-- su historial, sus cargas ni su perfil.
--
-- ── Seguridad ─────────────────────────────────────────────────────────────
-- Solo get_shared_routine es SECURITY DEFINER, y a propósito: es el único punto
-- por el que un usuario anónimo puede leer una rutina, es de solo lectura, y
-- exige el token. Todo lo demás (crear el enlace, desactivarlo, guardar la copia)
-- pasa por RLS como el usuario que llama. En particular, IMPORTAR no ocurre aquí:
-- el cliente vuelve a llamar a create_routine_tree con el plan que leyó, así la
-- copia se crea con los permisos de quien la guarda y pasa por la puerta beta y
-- la canonicalización de nombres como cualquier otra rutina.

-- ── 1. Tabla ──────────────────────────────────────────────────────────────

create table if not exists routine_shares (
  id             uuid primary key default gen_random_uuid(),
  routine_id     uuid references routines(id) on delete cascade not null,
  owner_id       uuid references auth.users(id) on delete cascade not null,
  token          text unique not null,
  import_count   int not null default 0,        -- cuántas veces se guardó
  last_import_at timestamptz,
  revoked_at     timestamptz,                   -- null = enlace vivo
  created_at     timestamptz default now()
);

create index if not exists idx_routine_shares_owner on routine_shares(owner_id);

-- Un solo enlace vivo por rutina: volver a pulsar "Compartir" devuelve el mismo
-- enlace en vez de sembrar enlaces huérfanos que el dueño ya no puede desactivar.
create unique index if not exists routine_shares_one_live_per_routine
  on routine_shares(routine_id) where revoked_at is null;

-- ── 2. RLS ────────────────────────────────────────────────────────────────

alter table routine_shares enable row level security;

-- El dueño gestiona sus propios enlaces. El with_check exige además que la
-- rutina sea suya: un entrenador puede editar las rutinas de su cliente
-- (trainers.sql), pero publicar el plan de otra persona en un enlace abierto es
-- una decisión de esa persona, no suya.
--
-- El drop previo mantiene el archivo re-ejecutable: Postgres no admite
-- "create policy if not exists".
drop policy if exists "Owners manage own routine shares" on routine_shares;
create policy "Owners manage own routine shares"
  on routine_shares for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from routines r
      where r.id = routine_shares.routine_id
        and r.user_id = auth.uid()
    )
  );

-- Mismo candado restrictivo que el resto de tablas de datos (beta_gate.sql).
-- No afecta a quien abre el enlace: esa lectura va por get_shared_routine,
-- que es SECURITY DEFINER y no pasa por RLS.
drop policy if exists "Beta gate" on routine_shares;
create policy "Beta gate" on routine_shares as restrictive for all using (public.is_beta_approved());

-- ── 3. source = 'shared' ──────────────────────────────────────────────────
-- Una rutina guardada desde un enlace no es 'manual' (no la escribió quien la
-- tiene) ni 'recommended' ni 'from_workout'. Se amplía el CHECK de
-- routines_invariants.sql; ese archivo ya crea la versión de tres valores en
-- instalaciones nuevas, así que aquí se recrea en vez de añadirse.

alter table routines drop constraint if exists routines_source_chk;
alter table routines add constraint routines_source_chk
  check (source in ('manual','recommended','from_workout','shared'));

-- ── 4. Token ──────────────────────────────────────────────────────────────
-- 22 hex de un uuid v4 ≈ 88 bits de entropía, sin depender de pgcrypto.

create or replace function public.new_share_token()
returns text
language sql
volatile
security invoker
set search_path = public
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 22);
$$;

revoke execute on function public.new_share_token() from public, anon;
grant  execute on function public.new_share_token() to authenticated;

-- ── 5. create_routine_share ───────────────────────────────────────────────
-- Idempotente: si la rutina ya tiene un enlace vivo, devuelve ese.

create or replace function public.create_routine_share(p_routine_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
  v_id    uuid;
  v_token text;
  v_try   int := 0;
begin
  select user_id into v_owner from routines where id = p_routine_id;   -- RLS
  if v_owner is null then
    raise exception 'Rutina no encontrada';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Solo el dueño de la rutina puede compartirla';
  end if;

  loop
    select id, token into v_id, v_token
      from routine_shares
     where routine_id = p_routine_id and revoked_at is null
     limit 1;
    exit when v_id is not null;

    v_try := v_try + 1;
    if v_try > 5 then
      raise exception 'No se pudo generar el enlace';
    end if;

    -- unique_violation cubre los dos empates posibles: token repetido (astronómico)
    -- y otra sesión creando el enlace de la misma rutina a la vez. En ambos casos
    -- se vuelve al select de arriba, que ya encontrará el enlace vivo.
    begin
      insert into routine_shares (routine_id, owner_id, token)
      values (p_routine_id, auth.uid(), public.new_share_token())
      returning id, token into v_id, v_token;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;

  return jsonb_build_object('share_id', v_id, 'token', v_token);
end $$;

revoke execute on function public.create_routine_share(uuid) from public, anon;
grant  execute on function public.create_routine_share(uuid) to authenticated;

-- ── 6. get_shared_routine ─────────────────────────────────────────────────
-- La única puerta de lectura anónima de la app. Devuelve el plan con la MISMA
-- forma que acepta create_routine_tree (routine_snapshot), más quién lo comparte.
--
-- SECURITY DEFINER porque quien abre el enlace normalmente no tiene sesión y
-- nunca tendrá permiso RLS sobre esa rutina; el token es su único permiso.
-- routine_snapshot es SECURITY INVOKER, y llamada desde aquí se ejecuta con los
-- privilegios del dueño de esta función, que es lo que le deja leer el árbol.
--
-- Devuelve null —no una excepción— cuando el token no existe o está desactivado:
-- misma respuesta para ambos casos.

create or replace function public.get_shared_routine(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_share routine_shares%rowtype;
  v_snap  jsonb;
  v_name  text;
begin
  select * into v_share
    from routine_shares
   where token = btrim(coalesce(p_token, ''))
     and revoked_at is null;

  if v_share.id is null then
    return null;
  end if;

  v_snap := public.routine_snapshot(v_share.routine_id);
  if v_snap is null then
    return null;                      -- rutina borrada entre medias
  end if;

  select nullif(btrim(coalesce(p.name, '')), '') into v_name
    from profiles p where p.id = v_share.owner_id;

  -- Del dueño solo sale el nombre visible. Ni id, ni email, ni nada más.
  return v_snap || jsonb_build_object(
    'token',        v_share.token,
    'shared_by',    v_name,
    'shared_at',    v_share.created_at,
    'import_count', v_share.import_count
  );
end $$;

revoke execute on function public.get_shared_routine(text) from public;
grant  execute on function public.get_shared_routine(text) to anon, authenticated;

-- ── 7. note_shared_routine_import ─────────────────────────────────────────
-- Contador para el dueño ("3 personas la guardaron"). Best-effort: se llama
-- después de guardar la copia, y si falla no debe deshacerla.
-- Solo cuenta; no registra quién la guardó.

create or replace function public.note_shared_routine_import(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update routine_shares
     set import_count   = import_count + 1,
         last_import_at = now()
   where token = btrim(coalesce(p_token, ''))
     and revoked_at is null;
end $$;

revoke execute on function public.note_shared_routine_import(text) from public, anon;
grant  execute on function public.note_shared_routine_import(text) to authenticated;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- drop function if exists public.note_shared_routine_import(text);
-- drop function if exists public.get_shared_routine(text);
-- drop function if exists public.create_routine_share(uuid);
-- drop function if exists public.new_share_token();
-- drop table    if exists routine_shares;
-- alter table routines drop constraint if exists routines_source_chk;
-- alter table routines add constraint routines_source_chk
--   check (source in ('manual','recommended','from_workout'));
