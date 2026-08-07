-- Sesiones recurrentes en el calendario
--
-- Aplicar DESPUÉS de schedule.sql. Idempotente.
--
-- ── Por qué ───────────────────────────────────────────────────────────────
-- La capa de planificación se rellenaba día a día, con un formulario por cada
-- día. Para lo que se repite —"cardio martes y jueves"— eso significa abrir el
-- calendario ocho veces al mes. Nadie lo hace más de una semana, y es
-- exactamente lo que pasó: 39 entrenos registrados contra 1 sola sesión
-- planeada en toda la vida de la tabla.
--
-- ── Por qué una serie MATERIALIZADA y no una regla ────────────────────────
-- La alternativa sería guardar una regla ("cada martes") y expandirla al
-- pintar. Se descarta: cada ocurrencia tiene su propio estado (planeado /
-- hecho / saltado) y sus propios datos reales, así que necesita fila. Una
-- regla obligaría a una tabla de excepciones para "el martes 12 lo salté",
-- que es la misma tabla de filas pero con más piezas.
--
-- series_id agrupa las ocurrencias creadas de una vez. Es lo único que hace
-- falta para poder borrar la serie entera sin borrar el historial: las
-- ocurrencias ya cerradas (hechas o saltadas) se conservan a propósito — son
-- pasado registrado, no plan. Sin agrupador, "quitar el cardio de los martes"
-- son ocho borrados a mano.

alter table scheduled_sessions
  add column if not exists series_id uuid;

-- Buscar "las demás de esta serie" es la única consulta que añade.
create index if not exists scheduled_sessions_series
  on scheduled_sessions(user_id, series_id)
  where series_id is not null;
