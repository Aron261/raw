-- Lo que de verdad pasó en una sesión que no es de fuerza
--
-- Aplicar DESPUÉS de schedule.sql. Idempotente.
--
-- ── Por qué ───────────────────────────────────────────────────────────────
-- Hasta aquí, 'cardio' y 'mobility' eran etiquetas de color y nada más — el
-- propio schedule.sql lo decía: "no se registran datos de cardio en v1". Una
-- salida en bici de 50 minutos y un estiramiento de cinco dejaban exactamente
-- la misma huella en la app: un punto cian. Nada que mirar después, nada que
-- comparar, nada que sume a ninguna cifra. Por eso la sección entera se sentía
-- decorativa.
--
-- ── Por qué a nivel de SESIÓN y no de serie ───────────────────────────────
-- El motor de registro de Raw es reps × peso (sets.reps y sets.weight son NOT
-- NULL): meter cardio ahí obligaría a inventar reps y pesos falsos para que
-- cuadre, y contaminaría el volumen, los PR y el 1RM estimado con datos que no
-- son levantamientos. El cardio se mide por sesión — cuánto duró, cuánto
-- recorriste, cuánto costó — y así se guarda.
--
--   duration_min  minutos. La única cifra que aplica a TODO lo que no es
--                 fuerza, y la que suma a los minutos aeróbicos de la semana.
--   distance_km   solo tiene sentido si te desplazas; nulo en movilidad.
--   rpe           esfuerzo percibido 1–10, la escala que ya usa el gimnasio.
--
-- Nulo significa "no lo sé", no cero: media hora de bici sin mirar el
-- cuentakilómetros no son 0 km. Las cifras se cuentan solo donde existen.
--
-- Los rangos se comprueban aquí y no solo en el formulario, porque el conector
-- MCP escribe contra esta misma tabla sin pasar por la interfaz.

alter table scheduled_sessions
  add column if not exists duration_min int,
  add column if not exists distance_km  numeric(6,2),
  add column if not exists rpe          int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sessions_duration_sane'
  ) then
    alter table scheduled_sessions add constraint scheduled_sessions_duration_sane
      check (duration_min is null or (duration_min > 0 and duration_min <= 1440));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sessions_distance_sane'
  ) then
    alter table scheduled_sessions add constraint scheduled_sessions_distance_sane
      check (distance_km is null or (distance_km > 0 and distance_km <= 1000));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sessions_rpe_sane'
  ) then
    alter table scheduled_sessions add constraint scheduled_sessions_rpe_sane
      check (rpe is null or (rpe between 1 and 10));
  end if;
end $$;
