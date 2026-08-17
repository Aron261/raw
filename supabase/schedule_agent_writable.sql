-- El calendario, escribible desde un conector (auditado y reversible)
--
-- Aplicar DESPUÉS de agent_audit.sql, schedule.sql, schedule_series.sql y
-- schedule_actuals.sql. Idempotente.
--
-- ── Qué cambia y por qué ──────────────────────────────────────────────────
-- agent_audit.sql es default-deny: enumera las tablas escribibles por un
-- agente y bloquea todas las demás. `scheduled_sessions` estaba fuera, así que
-- un conector podía LEER el calendario pero no poner nada en él. Eso deja la
-- planificación como la única tarea de la app que hay que hacer a mano, día a
-- día, con un formulario — y es justo la tarea que mejor se dice hablando:
-- "ponme cardio los martes y jueves de este mes" son ocho aperturas del
-- calendario contra una frase.
--
-- ── Por qué es seguro abrirla y no lo sería abrir workouts ────────────────
-- Esta tabla guarda INTENCIÓN, no historial. Si un agente se equivoca, lo que
-- queda mal es un plan futuro, que se borra de un toque. Los entrenos y las
-- series siguen fuera de la lista por dos razones que no aplican aquí: son el
-- registro de lo que de verdad pasó, y el outbox offline puede reenviar una
-- escritura vieja horas después y pisar lo que se escriba desde fuera.
--
-- Todo lo que se escriba desde un conector queda en agent_writes con su before
-- y su after, y se revierte con undo_change como cualquier otra escritura de
-- agente. Ese es el trato que hace aceptable abrir la tabla; sin el trigger,
-- no lo sería.
--
-- La lista `writable` se repite entera a propósito: es la MISMA lista de
-- agent_audit.sql más esta tabla. Si diverge, el bloque de comprobación del
-- final de agent_audit.sql lo grita.

-- ── 1. Auditar sus escrituras ─────────────────────────────────────────────
drop trigger if exists trg_log_agent_write on scheduled_sessions;
create trigger trg_log_agent_write
  after insert or update or delete on scheduled_sessions
  for each row execute function public.log_agent_write();

-- ── 2. Sacarla de la guardia de solo-app ──────────────────────────────────
do $$
declare
  t text;
  -- Una sola fuente, compartida con agent_audit.sql. Antes eran dos copias a
  -- mano y bastaba re-ejecutar el otro archivo para volver a candar esta tabla.
  writable text[] := public.agent_writable_tables();
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
  loop
    execute format('drop policy if exists "Sin escritura desde agentes ins" on %I', t);
    execute format('drop policy if exists "Sin escritura desde agentes upd" on %I', t);
    execute format('drop policy if exists "Sin escritura desde agentes del" on %I', t);

    if t <> all (writable) then
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
    end if;
  end loop;
end $$;

-- ── 3. Comprobación en voz alta ───────────────────────────────────────────
-- Que la tabla quede escribible es el objetivo; que quede escribible SIN
-- auditar sería un agujero. Si el trigger no está, esto revienta el despliegue
-- en vez de dejarlo pasar en silencio.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_log_agent_write'
      and tgrelid = 'public.scheduled_sessions'::regclass
  ) then
    raise exception 'scheduled_sessions es escribible por agentes pero no audita sus escrituras';
  end if;
end $$;
