-- ── Composición corporal ─────────────────────────────────────────────────
--
-- La app pedía un objetivo de calorías y no daba ninguna forma de saber cuál.
-- «2.500 kcal» era un default inventado y todo el mundo lo dejaba puesto.
--
-- Con estos cuatro campos se puede calcular: gasto basal (Mifflin-St Jeor, o
-- Katch-McArdle si hay % de grasa), gasto total según actividad, y el ajuste
-- según la fase. El cálculo vive en src/lib/nutritionPlan.js — aquí solo están
-- los insumos.
--
-- ── Por qué en profiles y no en una tabla nueva ──────────────────────────
-- Por seguridad, no por comodidad. El bloque de agent_audit.sql deniega la
-- escritura de agentes enumerando las tablas ESCRIBIBLES: una tabla nueva no
-- aparece en esa lista, pero tampoco recibe las políticas de denegación, así
-- que quedaría escribible por un token de agente. Es decir: crear una tabla
-- para el % de grasa le daría a Claude control sobre el insumo del objetivo
-- calórico del usuario, que es exactamente lo que la pantalla de consentimiento
-- (OAuthConsent.jsx) promete que no puede hacer. profiles ya lleva las tres
-- políticas restrictivas.
--
-- Además, un entrenador ya lee profiles de sus clientes (trainers.sql), así que
-- el plan de nutrición de un cliente sale de datos que ya se pueden consultar.
--
-- ── Por qué nullable y sin default ───────────────────────────────────────
-- Un default en activity_level dejaría a la calculadora producir un número
-- seguro a partir de un dato que nadie dio. La recomendación tiene que poder
-- decir «me falta esto» — es la diferencia entre una herramienta y un oráculo.
-- Mientras estén vacíos, nutritionPlan.js los deduce de goal y days_per_week
-- (que sí existen) y lo advierte en pantalla.
--
-- ── Por qué existe body_fat_source ───────────────────────────────────────
-- Una silueta elegida a ojo es ±5 puntos; un DEXA es ±1. La razón que se le
-- muestra al usuario tiene que poder decir cuál de las dos está usando, para no
-- vender como medición lo que es una estimación. Y el día que entre una báscula
-- de bioimpedancia o un plicómetro, entra sin tocar el esquema.
--
-- ── Qué NO se hizo, a propósito ──────────────────────────────────────────
-- · NO se añade body_fat_pct a body_weight_logs. Esa tabla SÍ es escribible por
--   agentes (está en la lista blanca de agent_audit.sql), así que guardar ahí
--   el insumo principal de la recomendación lo haría controlable por la puerta
--   de atrás. Si algún día se quiere histórico de composición, es una decisión
--   propia y hay que tomarla mirando esto.
-- · Los enums nuevos son ids ASCII neutros al idioma, aunque sex/goal/level
--   sean cadenas en español. Aquéllos son anteriores a app_lang y se quedan
--   como están; los nuevos no repiten el error, porque la etiqueta visible
--   tiene que poder cambiar con el idioma sin migrar datos.
--
-- Idempotente: se puede volver a ejecutar sin efecto.

alter table profiles add column if not exists body_fat_pct numeric(4,1)
  check (body_fat_pct is null or (body_fat_pct >= 3 and body_fat_pct <= 70));

alter table profiles add column if not exists body_fat_source text
  check (body_fat_source is null or body_fat_source in ('estimado', 'medido'));

alter table profiles add column if not exists activity_level text
  check (activity_level is null or activity_level in
    ('sedentario', 'ligero', 'moderado', 'alto', 'muy_alto'));

alter table profiles add column if not exists nutrition_phase text
  check (nutrition_phase is null or nutrition_phase in
    ('definicion', 'mantener', 'volumen'));

comment on column profiles.body_fat_pct is
  'Porcentaje de grasa corporal. Habilita Katch-McArdle en lugar de Mifflin-St Jeor. Null = desconocido, no cero.';

comment on column profiles.body_fat_source is
  'De dónde sale body_fat_pct: estimado (selector visual, ±5 puntos) o medido (DEXA, bioimpedancia). Decide cuánta confianza muestra la app.';

comment on column profiles.activity_level is
  'Multiplicador de gasto sobre el basal. Null = se deduce de days_per_week y se avisa.';

comment on column profiles.nutrition_phase is
  'Fase de nutrición: definicion (-20%), mantener (0), volumen (+10%). Null = se deduce de goal y se avisa.';

-- ── Rollback ─────────────────────────────────────────────────────────────
-- alter table profiles drop column if exists nutrition_phase;
-- alter table profiles drop column if exists activity_level;
-- alter table profiles drop column if exists body_fat_source;
-- alter table profiles drop column if exists body_fat_pct;
