-- ── Micronutrientes ──────────────────────────────────────────────────────
--
-- Hasta ahora una comida eran cuatro números: kcal, proteína, carbos y grasa.
-- Con eso no se puede responder la mitad de las preguntas que de verdad se
-- hace alguien que entrena: ¿estoy comiendo algo de fibra?, ¿el sodio de este
-- día es una barbaridad?, ¿de dónde saco el hierro?
--
-- Lo que cambia el cálculo es que ya hay una fuente que sí conoce esos datos:
-- el conector MCP escribe comidas desde Claude, y quien las escribe puede
-- traer los micros de la misma consulta con la que estima los macros.
--
-- ── Por qué una columna jsonb y no dieciséis columnas ─────────────────────
-- La lista de nutrientes es una decisión de producto, no de esquema. El día
-- que se quiera añadir el nutriente diecisiete, con columnas cuesta una
-- migración + un despliegue de la Edge Function + tocar cinco `select`; con
-- jsonb cuesta una línea en un array de JavaScript. Esa diferencia es la que
-- decide si se añade o no se añade nunca.
--
-- La lista canónica vive en src/lib/nutrients.js y su espejo mínimo en
-- supabase/functions/mcp/nutrients.ts. Un test de paridad los compara.
--
-- ── Qué NO se hizo, a propósito ──────────────────────────────────────────
-- · Sin CHECK del vocabulario de claves. La base garantiza la FORMA (que es un
--   objeto), no las palabras. Validar los nombres aquí obligaría a una
--   migración por cada nutriente nuevo, que es justo lo que se estaba evitando.
--   El filtro de claves lo hace la aplicación al escribir (sanitizeMicros).
-- · Los macros siguen en columnas propias. Se ordenan, se suman en SQL y se
--   leen en la vista del entrenador; no hay ninguna razón para moverlos.
-- · nutrition_targets sigue siendo una fila por usuario, sin histórico. Sigue
--   siendo cierto que los días pasados se evalúan contra los objetivos de hoy.
-- · Sin índice. Nada filtra ni ordena por un micro: se leen las filas del día
--   enteras, que ya cubre nutrition_entries_user_date.
--
-- ── Guardia de agentes ───────────────────────────────────────────────────
-- NO hace falta reejecutar el bloque de agent_audit.sql: aquí no se crea
-- ninguna tabla, solo se añaden columnas. nutrition_entries y nutrition_foods
-- siguen siendo escribibles por un agente y ahora arrastran `micros` en el
-- before/after de agent_writes, así que undo_agent_write restaura el objeto
-- completo. nutrition_targets sigue sin ser escribible por agentes.
--
-- Idempotente: se puede volver a ejecutar sin efecto.

alter table nutrition_entries add column if not exists micros jsonb not null default '{}'::jsonb;
alter table nutrition_foods   add column if not exists micros jsonb not null default '{}'::jsonb;
alter table nutrition_targets add column if not exists micros jsonb not null default '{}'::jsonb;

-- `not null default '{}'` rellena las filas existentes sin reescribir la tabla
-- (default constante, PG11+). No hace falta un update de backfill.

-- jsonb acepta arrays, cadenas y números; aquí solo tiene sentido un objeto.
-- `add constraint` no tiene `if not exists`, así que la forma idempotente es
-- capturar duplicate_object.
do $$ begin
  alter table nutrition_entries add constraint nutrition_entries_micros_obj
    check (jsonb_typeof(micros) = 'object');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table nutrition_foods add constraint nutrition_foods_micros_obj
    check (jsonb_typeof(micros) = 'object');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table nutrition_targets add constraint nutrition_targets_micros_obj
    check (jsonb_typeof(micros) = 'object');
exception when duplicate_object then null; end $$;

comment on column nutrition_entries.micros is
  'Micronutrientes de esta comida. Claves canónicas y unidad fija por clave en src/lib/nutrients.js (g/mg/mcg). Una clave ausente significa DESCONOCIDO, no cero.';

comment on column nutrition_foods.micros is
  'Micronutrientes de la porción de referencia (serving_qty/serving_unit). Se escalan con la cantidad al registrar. Misma convención que nutrition_entries.micros.';

comment on column nutrition_targets.micros is
  'Objetivos diarios de micronutrientes. Ojo: unos son pisos (alcanzar) y otros techos (no pasarse) — la dirección la marca `dir` en src/lib/nutrients.js, no la base.';

-- ── Rollback ─────────────────────────────────────────────────────────────
-- alter table nutrition_entries drop constraint if exists nutrition_entries_micros_obj;
-- alter table nutrition_foods   drop constraint if exists nutrition_foods_micros_obj;
-- alter table nutrition_targets drop constraint if exists nutrition_targets_micros_obj;
-- alter table nutrition_entries drop column if exists micros;
-- alter table nutrition_foods   drop column if exists micros;
-- alter table nutrition_targets drop column if exists micros;
