-- Auditoría, deshacer y límite de capacidades para escritores tipo agente (Claude)
--
-- Aplicar ANTES de routine_tree.sql: ese archivo usa routine_revisions.
-- Orden: routines_invariants.sql → agent_audit.sql → routine_tree.sql
--
-- ── Por qué existe este archivo ───────────────────────────────────────────
-- Cuando un usuario conecta la app a su cuenta de Claude, aparece un segundo
-- escritor sobre los mismos datos. Este archivo garantiza tres cosas:
--
--   1. ATRIBUCIÓN  — se sabe qué escribió un agente y qué escribió la app,
--                    derivado en la base de datos y no reportado por el cliente.
--   2. DESHACER    — toda escritura de agente es reversible.
--   3. LÍMITE      — un token de agente solo puede escribir en las 7 tablas de
--                    contenido del usuario. En cualquier otra tabla, Postgres
--                    rechaza la escritura, independientemente de qué
--                    herramientas exponga el servidor MCP.
--
-- El punto 3 es la defensa que sobrevive a errores futuros: si alguien añade
-- una herramienta descuidada, o un bug deja pasar una sentencia inesperada,
-- la base de datos sigue diciendo que no.
--
-- Idempotente. Rollback al final del archivo.

-- ── 1. current_actor() ────────────────────────────────────────────────────
-- 'client_id' aparece en los tokens emitidos por el servidor OAuth y NO en los
-- tokens de sesión de la SPA. Ni la Edge Function ni el navegador pueden
-- falsificarlo, así que es una marca fiable.
--
-- Falla cerrado: cualquier token con client_id se trata como agente.

create or replace function public.current_actor()
returns text
language sql
stable
set search_path = public
as $$
  select case
           when nullif(auth.jwt() ->> 'client_id', '') is not null then 'agent'
           else 'app'
         end
$$;

comment on function public.current_actor() is
  'Devuelve ''agent'' si el token lleva client_id (emitido por OAuth), si no ''app''.';

-- ── 2. agent_writes: bitácora + deshacer por fila ─────────────────────────

create table if not exists agent_writes (
  id          bigserial primary key,
  user_id     uuid not null,
  client_id   text,
  table_name  text not null,
  op          text not null check (op in ('INSERT','UPDATE','DELETE')),
  row_id      uuid,
  before      jsonb,
  after       jsonb,
  undone_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists agent_writes_user_time
  on agent_writes (user_id, created_at desc);

alter table agent_writes enable row level security;

-- Solo lectura propia. Sin política de insert/update/delete a propósito:
-- las filas solo pueden aparecer por el trigger (security definer).
drop policy if exists "Users read own agent writes" on agent_writes;
create policy "Users read own agent writes"
  on agent_writes for select
  using (auth.uid() = user_id);

-- ── 3. Trigger de auditoría ───────────────────────────────────────────────
-- Sale inmediatamente para tráfico de la app: coste cero en uso normal.
-- Cubre el tráfico de agente venga por RPC o por PostgREST directo.

create or replace function public.log_agent_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid;
  v_row    jsonb;
  v_before jsonb;
  v_after  jsonb;
begin
  if public.current_actor() <> 'agent' then
    return null;              -- trigger AFTER: el valor de retorno se ignora
  end if;

  if tg_op = 'DELETE' then
    v_before := to_jsonb(old); v_after := null; v_row := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old); v_after := to_jsonb(new); v_row := to_jsonb(new);
  else
    v_before := null; v_after := to_jsonb(new); v_row := to_jsonb(new);
  end if;

  -- user_id directo si la tabla lo tiene; si no, se cae a auth.uid().
  v_user := coalesce(nullif(v_row ->> 'user_id','')::uuid, auth.uid());

  insert into agent_writes (user_id, client_id, table_name, op, row_id, before, after)
  values (v_user,
          auth.jwt() ->> 'client_id',
          tg_table_name,
          tg_op,
          nullif(v_row ->> 'id','')::uuid,
          v_before,
          v_after);

  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['routines','routine_days','routine_day_exercises',
                           'goals','nutrition_entries','nutrition_foods','body_weight_logs']
  loop
    execute format('drop trigger if exists trg_log_agent_write on %I', t);
    execute format(
      'create trigger trg_log_agent_write after insert or update or delete on %I
         for each row execute function public.log_agent_write()', t);
  end loop;
end $$;

-- Es una función de trigger: no debe poder invocarse por RPC.
-- Los triggers no requieren EXECUTE del usuario invocante, así que revocar es
-- seguro. Sin esto, el linter de Supabase la marca como SECURITY DEFINER
-- expuesta en /rest/v1/rpc/.
revoke execute on function public.log_agent_write() from anon, authenticated, public;

-- ── 4. Guardia de escritura de agentes (default-deny) ─────────────────────
--
-- Se enumeran las tablas ESCRIBIBLES y se deniega la escritura de agentes en
-- todas las demás. Default-deny en vez de lista de bloqueo: así quedan
-- cubiertas también las tablas heredadas (training_cycles, cycle_days,
-- routine_exercises, …) y cualquier tabla que no esté en la lista.
--
-- Solo INSERT/UPDATE/DELETE. La lectura NO se toca: Claude puede analizar todo
-- el historial de entrenamiento, simplemente no puede reescribirlo.
--
-- Como los tokens de sesión de la app no llevan client_id, current_actor()
-- devuelve 'app' y el comportamiento de la aplicación no cambia en absoluto.
--
-- NOTA: una tabla nueva creada más adelante NO queda protegida automáticamente.
-- Volver a ejecutar este bloque después de añadir tablas. Ya pasó una vez:
-- routine_shares y scheduled_sessions se crearon después y estuvieron sin guarda
-- hasta que una auditoría lo encontró. Por eso el bloque de comprobación del
-- final ahora falla en voz alta en vez de confiar en que alguien lea esta nota.

do $$
declare
  t text;
  -- body_weight_logs salió de aquí: el peso corporal se ve desde un conector
  -- pero no se escribe. Quitar la herramienta del MCP no bastaba —eso es una
  -- omisión, no una garantía—; fuera de esta lista lo rechaza Postgres.
  writable text[] := array[
    'routines','routine_days','routine_day_exercises',
    'goals','nutrition_entries','nutrition_foods'
  ];
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname <> all (writable)
  loop
    execute format('drop policy if exists "Sin escritura desde agentes ins" on %I', t);
    execute format('drop policy if exists "Sin escritura desde agentes upd" on %I', t);
    execute format('drop policy if exists "Sin escritura desde agentes del" on %I', t);

    execute format(
      'create policy "Sin escritura desde agentes ins" on %I
         as restrictive for insert
         with check (public.current_actor() = ''app'')', t);
    execute format(
      'create policy "Sin escritura desde agentes upd" on %I
         as restrictive for update
         using (public.current_actor() = ''app'')
         with check (public.current_actor() = ''app'')', t);
    execute format(
      'create policy "Sin escritura desde agentes del" on %I
         as restrictive for delete
         using (public.current_actor() = ''app'')', t);
  end loop;
end $$;

-- ── 5. routine_revisions: deshacer a nivel de árbol ───────────────────────
-- Deshacer fila a fila es la granularidad equivocada para una reescritura de
-- 22 ejercicios. Aquí se guarda el árbol completo, con la misma forma jsonb que
-- acepta create_routine_tree, así que restaurar es literalmente volver a pasar
-- el snapshot por el constructor.

create table if not exists routine_revisions (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  user_id    uuid not null,
  actor      text not null,
  client_id  text,
  reason     text,
  snapshot   jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists routine_revisions_routine_time
  on routine_revisions (routine_id, created_at desc);

alter table routine_revisions enable row level security;

drop policy if exists "Users read own routine revisions" on routine_revisions;
create policy "Users read own routine revisions"
  on routine_revisions for select
  using (auth.uid() = user_id);

-- ── 6. Deshacer ───────────────────────────────────────────────────────────
-- security invoker en ambas: RLS vuelve a aplicarse sobre la reversión, así que
-- nadie puede deshacer escrituras de otro usuario.

create or replace function public.undo_agent_write(p_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  w agent_writes%rowtype;
begin
  select * into w from agent_writes where id = p_id;      -- RLS: solo las propias
  if w.id is null then
    raise exception 'Cambio no encontrado';
  end if;
  if w.undone_at is not null then
    raise exception 'Ese cambio ya se deshizo';
  end if;

  -- INSERT  → borrar la fila creada.
  -- UPDATE  → borrar la fila actual y reinsertar el estado anterior.
  -- DELETE  → reinsertar el estado anterior.
  -- Borrar-y-reinsertar trata UPDATE y DELETE igual y evita SQL dinámico con
  -- listas de columnas. jsonb_populate_record reconstruye la fila completa,
  -- así que el id se conserva.
  if w.op in ('INSERT','UPDATE') then
    execute format('delete from %I where id = $1', w.table_name) using w.row_id;
  end if;

  if w.op in ('UPDATE','DELETE') then
    execute format('insert into %I select (jsonb_populate_record(null::%I, $1)).*',
                   w.table_name, w.table_name)
      using w.before;
  end if;

  -- Vía helper DEFINER: agent_writes no tiene política de UPDATE (a propósito)
  -- y el guard anti-agente además bloquearía el UPDATE desde un conector — que
  -- es justo desde donde se deshace. Con invoker este update tocaba 0 filas en
  -- silencio: el cambio quedaba revertido pero nunca sellado, el "ya se
  -- deshizo" de arriba jamás saltaba y un segundo undo re-ejecutaba la
  -- reversión (duplicando la fila reinsertada o muriendo por clave duplicada).
  perform public.mark_agent_write_undone(p_id);
  return jsonb_build_object('undone', true, 'table', w.table_name, 'op', w.op);
end $$;

-- Sella undone_at saltándose RLS, pero SOLO en filas propias: la comprobación
-- de user_id hace aquí el trabajo que la política no puede hacer.
create or replace function public.mark_agent_write_undone(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update agent_writes set undone_at = now()
  where id = p_id and user_id = auth.uid() and undone_at is null;
$$;

revoke execute on function public.mark_agent_write_undone(bigint) from public, anon;
grant  execute on function public.mark_agent_write_undone(bigint) to authenticated;

create or replace function public.restore_routine_revision(p_revision_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rev routine_revisions%rowtype;
begin
  select * into rev from routine_revisions where id = p_revision_id;  -- RLS
  if rev.id is null then
    raise exception 'Revisión no encontrada';
  end if;

  -- Restaurar es en sí mismo deshacible: se guarda el estado actual primero.
  perform public.record_routine_revision(rev.routine_id, 'restore');

  return public.update_routine_tree(rev.routine_id, rev.snapshot);
end $$;

-- ── Comprobación: ninguna tabla se queda sin guarda ───────────────────────
-- Un comentario no ejecuta nada. Esto sí: si una tabla con RLS fuera de la
-- lista escribible no tiene sus tres políticas restrictivas, este archivo se
-- niega a terminar en silencio y dice cuál falta.
do $$
declare
  faltan text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into faltan
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and c.relname <> all (array[
      'routines','routine_days','routine_day_exercises',
      'goals','nutrition_entries','nutrition_foods','body_weight_logs'
    ])
    and (select count(*) from pg_policy p
         where p.polrelid = c.oid
           and p.polname like 'Sin escritura desde agentes%') < 3;

  if faltan is not null then
    raise exception 'Tablas sin guarda anti-agente: %. Reejecuta el bloque default-deny.', faltan;
  end if;
end $$;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- do $$ declare t text; begin
--   for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--            where n.nspname='public' and c.relkind='r' loop
--     execute format('drop policy if exists "Sin escritura desde agentes ins" on %I', t);
--     execute format('drop policy if exists "Sin escritura desde agentes upd" on %I', t);
--     execute format('drop policy if exists "Sin escritura desde agentes del" on %I', t);
--     execute format('drop trigger if exists trg_log_agent_write on %I', t);
--   end loop; end $$;
-- drop function if exists public.restore_routine_revision(uuid);
-- drop function if exists public.undo_agent_write(bigint);
-- drop table if exists routine_revisions;
-- drop table if exists agent_writes;
-- drop function if exists public.log_agent_write();
-- drop function if exists public.current_actor();
