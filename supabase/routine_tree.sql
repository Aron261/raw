-- Construcción atómica de rutinas (árbol completo en una transacción)
--
-- Aplicar DESPUÉS de agent_audit.sql (usa routine_revisions).
-- Orden: routines_invariants.sql → agent_audit.sql → routine_tree.sql
--
-- ── Por qué existe este archivo ───────────────────────────────────────────
-- createRoutine (src/hooks/useRoutines.js:92) escribía en tres etapas sin
-- transacción: insert de la rutina, bucle de inserts de días, y luego lotes de
-- ejercicios. Un fallo a mitad del bucle dejaba un ciclo a medio construir de
-- forma permanente. Aquí todo ocurre en una sola transacción.
--
-- Además centraliza la canonicalización de nombres de ejercicio. El cruce
-- plan↔entreno de useWorkout.js:253 se hace por exercise_name en minúsculas:
-- un nombre no canónico rompe el seguimiento del ciclo en silencio. Al
-- resolverlo aquí, la app y el conector no pueden divergir.
--
-- TODAS las funciones son security invoker. Es lo que sostiene la seguridad:
-- la misma función llamada por la app y por el conector concede exactamente
-- los permisos RLS de quien llama (dueño, o entrenador activo vía
-- is_active_trainer_of, siempre con la puerta beta). Una función security
-- definer aquí se convertiría en una vía de escalada de privilegios.

-- ── 1. routine_snapshot ───────────────────────────────────────────────────
-- Devuelve el árbol completo con la MISMA forma que acepta create_routine_tree,
-- así restaurar es literalmente volver a pasar el snapshot por el constructor.

create or replace function public.routine_snapshot(p_routine_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'name',          r.name,
    'description',   r.description,
    'type',          r.type,
    'source',        r.source,
    'goal',          r.goal,
    'level',         r.level,
    'days_per_week', r.days_per_week,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day_name', d.day_name,
               'focus',    d.focus,
               'exercises', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'exercise_name', e.exercise_name,
                          'sets',          e.sets,
                          'reps',          e.reps,
                          'rest_seconds',  e.rest_seconds,
                          'notes',         e.notes
                        ) order by e.exercise_order)
                 from routine_day_exercises e
                 where e.routine_day_id = d.id
               ), '[]'::jsonb)
             ) order by d.day_order)
      from routine_days d
      where d.routine_id = r.id
    ), '[]'::jsonb)
  )
  from routines r
  where r.id = p_routine_id;
$$;

-- ── 2. record_routine_revision ────────────────────────────────────────────
-- Guarda el estado actual antes de mutarlo. Poda a las últimas 20 revisiones
-- por rutina, así no hace falta un cron.

create or replace function public.record_routine_revision(p_routine_id uuid, p_reason text)
returns uuid
language plpgsql
security definer          -- routine_revisions no tiene política de insert
set search_path = public
as $$
declare
  v_user uuid;
  v_snap jsonb;
  v_id   uuid;
begin
  select user_id into v_user from routines where id = p_routine_id;
  if v_user is null then
    return null;                      -- rutina inexistente: nada que versionar
  end if;

  -- Autorización explícita. Es security definer (routine_revisions no tiene
  -- política de insert), así que el select de arriba salta RLS: sin esta
  -- comprobación un usuario autenticado podría llamarla por RPC y versionar la
  -- rutina de otro. Lo detectó el linter de seguridad de Supabase.
  if auth.uid() is null
     or not (v_user = auth.uid() or public.is_active_trainer_of(v_user)) then
    raise exception 'No autorizado';
  end if;

  v_snap := public.routine_snapshot(p_routine_id);
  if v_snap is null then
    return null;
  end if;

  insert into routine_revisions (routine_id, user_id, actor, client_id, reason, snapshot)
  values (p_routine_id, v_user, public.current_actor(),
          auth.jwt() ->> 'client_id', p_reason, v_snap)
  returning id into v_id;

  delete from routine_revisions
  where routine_id = p_routine_id
    and id not in (
      select id from routine_revisions
      where routine_id = p_routine_id
      order by created_at desc
      limit 20
    );

  return v_id;
end $$;

-- El grant por defecto a PUBLIC dejaba que anon la llamara por /rest/v1/rpc/.
-- Se concede solo a authenticated: las funciones del árbol son security invoker,
-- así que la llaman como el usuario autenticado y necesitan el permiso.
revoke execute on function public.record_routine_revision(uuid, text) from public, anon;
grant  execute on function public.record_routine_revision(uuid, text) to authenticated;

-- ── 3. Canonicalización de un nombre de ejercicio ─────────────────────────
-- IMPORTANTE: un nombre que no resuelve NO se rechaza, se deja tal cual.
-- 6 de los 29 ejercicios de rutina existentes en producción no resuelven
-- contra la biblioteca, y get_or_create_exercise trata explícitamente ese caso
-- como "ejercicio personalizado, su propio canon". Rechazarlos rompería datos
-- existentes y haría imposible escribir cualquier movimiento personalizado.

-- Cuando el nombre NO resuelve se devuelven además sugerencias de la biblioteca.
-- Esto importa: "sentadillas" no es un error tipográfico, es un término ambiguo
-- (la biblioteca tiene 5 variantes de sentadilla y ninguna se llama solo
-- "Sentadilla"). Elegir una automáticamente atribuiría mal el entrenamiento del
-- usuario. Devolver candidatos permite que quien llama —la app o Claude—
-- pregunte cuál antes de guardar, en vez de guardar un nombre vago en silencio.

create or replace function public.canonical_exercise_name(p_name text)
returns table (canon text, matched boolean, suggestions jsonb)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_lib uuid;
  v_raw text := btrim(coalesce(p_name, ''));
begin
  if v_raw = '' then
    raise exception 'Un ejercicio no tiene nombre';
  end if;

  v_lib := resolve_library_exercise(v_raw);
  if v_lib is not null then
    select l.name, true, '[]'::jsonb into canon, matched, suggestions
      from exercises_library l where l.id = v_lib;
  else
    canon   := v_raw;
    matched := false;
    begin
      select coalesce(jsonb_agg(s.name order by s.score desc), '[]'::jsonb)
        into suggestions
        from public.suggest_library_matches(v_raw, 4) s;
    exception when others then
      suggestions := '[]'::jsonb;      -- best-effort: nunca bloquea la escritura
    end;
  end if;
  return next;
end $$;

-- ── 4. create_routine_tree ────────────────────────────────────────────────
-- p = { user_id?, name, description?, type?, source?, goal?, level?,
--       days_per_week?,
--       days: [ { day_name?, focus?, exercises: [ { exercise_name, sets?,
--                 reps?, rest_seconds?, notes?, muscle_group? } ] } ] }

create or replace function public.create_routine_tree(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner    uuid;
  v_assigned uuid;
  v_rid      uuid;
  v_days     jsonb;
  v_day      jsonb;
  v_ex       jsonb;
  v_day_id   uuid;
  v_di       int := 0;
  v_ei       int;
  v_total    int := 0;
  v_canon    text;
  v_matched  boolean;
  v_sugg     jsonb;
  v_raw      text;
  v_norm     jsonb := '[]'::jsonb;
begin
  v_owner := coalesce(nullif(p->>'user_id','')::uuid, auth.uid());
  if v_owner is null then
    raise exception 'Usuario no autenticado';
  end if;
  v_assigned := case when v_owner <> auth.uid() then auth.uid() end;

  if coalesce(btrim(p->>'name'),'') = '' then
    raise exception 'La rutina necesita un nombre';
  end if;

  v_days := coalesce(p->'days', '[]'::jsonb);
  if jsonb_typeof(v_days) <> 'array' then
    raise exception 'days debe ser un array';
  end if;
  -- Topes: acotan el daño de un modelo confundido pidiendo un ciclo de 500 días.
  if jsonb_array_length(v_days) > 14 then
    raise exception 'Demasiados días (máximo 14)';
  end if;

  insert into routines (user_id, assigned_by, name, description, type, source,
                        goal, level, days_per_week, is_active)
  values (v_owner, v_assigned, btrim(p->>'name'), nullif(p->>'description',''),
          coalesce(nullif(p->>'type',''),'cycle'),
          coalesce(nullif(p->>'source',''),'manual'),
          nullif(p->>'goal',''), nullif(p->>'level',''),
          nullif(p->>'days_per_week','')::int,
          false)          -- nunca activa al crear: activar es un verbo aparte
  returning id into v_rid;

  for v_day in select * from jsonb_array_elements(v_days) loop
    insert into routine_days (routine_id, day_name, day_order, focus)
    values (v_rid,
            coalesce(nullif(btrim(v_day->>'day_name'),''), 'Día '||(v_di+1)),
            v_di,
            nullif(v_day->>'focus',''))
    returning id into v_day_id;

    v_ei := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises','[]'::jsonb)) loop
      if v_ei >= 20 then
        raise exception 'Demasiados ejercicios en un día (máximo 20)';
      end if;
      v_total := v_total + 1;
      if v_total > 200 then
        raise exception 'Demasiados ejercicios en total (máximo 200)';
      end if;

      v_raw := btrim(coalesce(v_ex->>'exercise_name',''));
      select c.canon, c.matched, c.suggestions into v_canon, v_matched, v_sugg
        from public.canonical_exercise_name(v_raw) c;

      v_norm := v_norm || jsonb_build_object(
        'input', v_raw, 'stored', v_canon, 'matched', v_matched,
        'suggestions', v_sugg);

      insert into routine_day_exercises (routine_day_id, exercise_name, exercise_order,
                                         sets, reps, rest_seconds, notes)
      values (v_day_id, v_canon, v_ei,
              nullif(v_ex->>'sets','')::int,
              nullif(v_ex->>'reps',''),
              nullif(v_ex->>'rest_seconds','')::int,
              nullif(v_ex->>'notes',''));

      -- Sembrar el ejercicio propio del usuario, best-effort.
      -- Solo cuando escribe sobre sí mismo: un entrenador no siembra ejercicios
      -- en la cuenta de su cliente.
      if v_owner = auth.uid() then
        begin
          perform get_or_create_exercise(v_canon, nullif(v_ex->>'muscle_group',''));
        exception when others then null;
        end;
      end if;

      v_ei := v_ei + 1;
    end loop;

    v_di := v_di + 1;
  end loop;

  perform public.record_routine_revision(v_rid, 'create_routine_tree');

  return jsonb_build_object(
    'routine_id', v_rid,
    'days',       v_di,
    'exercises',  v_total,
    'normalized', v_norm
  );
end $$;

-- ── 5. update_routine_tree ────────────────────────────────────────────────
-- Reemplazo completo del árbol, pero SIN borrar días referenciados.
--
-- workouts.routine_day_id es una FK sin "on delete" (schema.sql), así que
-- borrar un día que tiene entrenos registrados lanzaría violación de FK y
-- perdería la trazabilidad del historial. Por eso los días se actualizan en
-- sitio por day_order, y los días sobrantes solo se borran si nadie los
-- referencia; si están referenciados se vacían y se conservan, y se informa en
-- kept_days. routine_day_exercises no tiene FK entrante, así que sus filas sí
-- se pueden reemplazar libremente.

create or replace function public.update_routine_tree(p_routine_id uuid, p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner   uuid;
  v_days    jsonb;
  v_day     jsonb;
  v_ex      jsonb;
  v_day_id  uuid;
  v_di      int := 0;
  v_ei      int;
  v_total   int := 0;
  v_canon   text;
  v_matched boolean;
  v_sugg    jsonb;
  v_raw     text;
  v_norm    jsonb := '[]'::jsonb;
  v_kept    int := 0;
  v_new_n   int;
begin
  select user_id into v_owner from routines where id = p_routine_id;   -- RLS
  if v_owner is null then
    raise exception 'Rutina no encontrada';
  end if;

  v_days := coalesce(p->'days', '[]'::jsonb);
  if jsonb_typeof(v_days) <> 'array' then
    raise exception 'days debe ser un array';
  end if;
  if jsonb_array_length(v_days) > 14 then
    raise exception 'Demasiados días (máximo 14)';
  end if;
  v_new_n := jsonb_array_length(v_days);

  perform public.record_routine_revision(p_routine_id, 'update_routine_tree');

  update routines set
    name          = coalesce(nullif(btrim(p->>'name'),''), name),
    description   = coalesce(nullif(p->>'description',''), description),
    goal          = coalesce(nullif(p->>'goal',''), goal),
    level         = coalesce(nullif(p->>'level',''), level),
    days_per_week = coalesce(nullif(p->>'days_per_week','')::int, days_per_week),
    updated_at    = now()
  where id = p_routine_id;

  for v_day in select * from jsonb_array_elements(v_days) loop
    select id into v_day_id
      from routine_days
     where routine_id = p_routine_id and day_order = v_di;

    if v_day_id is null then
      insert into routine_days (routine_id, day_name, day_order, focus)
      values (p_routine_id,
              coalesce(nullif(btrim(v_day->>'day_name'),''), 'Día '||(v_di+1)),
              v_di,
              nullif(v_day->>'focus',''))
      returning id into v_day_id;
    else
      update routine_days set
        day_name = coalesce(nullif(btrim(v_day->>'day_name'),''), day_name),
        focus    = nullif(v_day->>'focus','')
      where id = v_day_id;

      delete from routine_day_exercises where routine_day_id = v_day_id;
    end if;

    v_ei := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises','[]'::jsonb)) loop
      if v_ei >= 20 then
        raise exception 'Demasiados ejercicios en un día (máximo 20)';
      end if;
      v_total := v_total + 1;
      if v_total > 200 then
        raise exception 'Demasiados ejercicios en total (máximo 200)';
      end if;

      v_raw := btrim(coalesce(v_ex->>'exercise_name',''));
      select c.canon, c.matched, c.suggestions into v_canon, v_matched, v_sugg
        from public.canonical_exercise_name(v_raw) c;

      v_norm := v_norm || jsonb_build_object(
        'input', v_raw, 'stored', v_canon, 'matched', v_matched,
        'suggestions', v_sugg);

      insert into routine_day_exercises (routine_day_id, exercise_name, exercise_order,
                                         sets, reps, rest_seconds, notes)
      values (v_day_id, v_canon, v_ei,
              nullif(v_ex->>'sets','')::int,
              nullif(v_ex->>'reps',''),
              nullif(v_ex->>'rest_seconds','')::int,
              nullif(v_ex->>'notes',''));

      if v_owner = auth.uid() then
        begin
          perform get_or_create_exercise(v_canon, nullif(v_ex->>'muscle_group',''));
        exception when others then null;
        end;
      end if;

      v_ei := v_ei + 1;
    end loop;

    v_di := v_di + 1;
  end loop;

  -- Días sobrantes: vaciar siempre; borrar solo los que nadie referencia.
  delete from routine_day_exercises
   where routine_day_id in (
     select id from routine_days
      where routine_id = p_routine_id and day_order >= v_new_n
   );

  select count(*) into v_kept
    from routine_days d
   where d.routine_id = p_routine_id
     and d.day_order >= v_new_n
     and exists (select 1 from workouts w where w.routine_day_id = d.id);

  delete from routine_days d
   where d.routine_id = p_routine_id
     and d.day_order >= v_new_n
     and not exists (select 1 from workouts w where w.routine_day_id = d.id);

  return jsonb_build_object(
    'routine_id', p_routine_id,
    'days',       v_di,
    'exercises',  v_total,
    'kept_days',  v_kept,       -- días conservados por tener entrenos ligados
    'normalized', v_norm
  );
end $$;

-- ── 6. set_active_routine ─────────────────────────────────────────────────
-- Sustituye los dos updates de useRoutines.js:208-227. En una sola transacción,
-- para que routines_one_active_per_user nunca vea el estado intermedio y un
-- fallo no deje al usuario sin ciclo activo.
-- p_routine_id = null → solo desactiva.

create or replace function public.set_active_routine(p_routine_id uuid,
                                                     p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
  v_type  text;
  v_target uuid := coalesce(p_user_id, auth.uid());
begin
  if p_routine_id is null then
    update routines set is_active = false, updated_at = now()
     where user_id = v_target and is_active;
    return jsonb_build_object('active_routine_id', null);
  end if;

  select user_id, type into v_owner, v_type from routines where id = p_routine_id;  -- RLS
  if v_owner is null then
    raise exception 'Rutina no encontrada';
  end if;
  if v_type <> 'cycle' then
    raise exception 'Solo los ciclos pueden marcarse como activos';
  end if;

  update routines set is_active = false, updated_at = now()
   where user_id = v_owner and is_active and id <> p_routine_id;

  update routines set is_active = true, updated_at = now()
   where id = p_routine_id;

  return jsonb_build_object('active_routine_id', p_routine_id);
end $$;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- drop function if exists public.set_active_routine(uuid, uuid);
-- drop function if exists public.update_routine_tree(uuid, jsonb);
-- drop function if exists public.create_routine_tree(jsonb);
-- drop function if exists public.canonical_exercise_name(text);
-- drop function if exists public.record_routine_revision(uuid, text);
-- drop function if exists public.routine_snapshot(uuid);
