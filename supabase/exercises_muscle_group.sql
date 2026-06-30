-- Clasificación de grupo muscular por ejercicio, a nivel de usuario.
--
-- Antes el grupo muscular solo vivía en `exercises_library` (global), que está
-- bloqueada para escritura desde el cliente (ver exercises_library_coaching_migration.sql).
-- Por eso los ejercicios personalizados nunca se clasificaban y caían en "Otros".
--
-- Guardamos el grupo en la tabla `exercises` (propia del usuario, RLS ya permite
-- "Users manage own exercises"). Lectura con prioridad en el frontend:
--   exercises.muscle_group  →  exercises_library.muscle_group  →  'Otros'
--
-- Columna nullable: null = sin clasificar (estándar se resuelve por la librería).

alter table public.exercises
  add column if not exists muscle_group text;
