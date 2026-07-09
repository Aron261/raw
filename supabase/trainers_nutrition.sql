-- =============================================================================
-- ENTRENADORES · ACCESO A NUTRICIÓN Y PESO DEL CLIENTE
-- =============================================================================
--
-- Extiende el módulo de entrenadores (trainers.sql):
--   - El entrenador con vínculo 'active' puede LEER el registro de comidas y
--     el peso corporal del cliente (seguimiento, solo lectura).
--   - El entrenador puede GESTIONAR los objetivos de nutrición del cliente
--     (planificar calorías y macros), igual que hace con rutinas y metas.
--
-- Igual que en trainers.sql, estas políticas se SUMAN a las owner-only
-- existentes (OR lógico). Las políticas restrictivas del candado beta siguen
-- aplicando sobre el usuario actual (el entrenador).
--
-- Orden de ejecución: después de trainers.sql, nutrition.sql y
-- body_weight_logs.sql.
-- =============================================================================

-- Comidas del cliente — solo lectura
create policy "Trainers read client nutrition entries"
  on nutrition_entries for select
  using (public.is_active_trainer_of(user_id));

-- Objetivos de nutrición del cliente — CRUD completo (planificar)
create policy "Trainers manage client nutrition targets"
  on nutrition_targets for all
  using (public.is_active_trainer_of(user_id))
  with check (public.is_active_trainer_of(user_id));

-- Peso corporal del cliente — solo lectura (contexto para planificar)
create policy "Trainers read client weight logs"
  on body_weight_logs for select
  using (public.is_active_trainer_of(user_id));
