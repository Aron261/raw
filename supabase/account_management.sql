-- =============================================================================
-- GESTIÓN DE CUENTA — eliminación de la propia cuenta
-- =============================================================================
--
-- delete_own_account(): borra la cuenta del usuario autenticado y TODOS sus
-- datos. La mayoría de tablas referencian auth.users con ON DELETE CASCADE, pero
-- body_weight_logs, supplements/supplement_logs/bloodwork_results y
-- nutrition_entries/nutrition_targets NO tienen cascade, así que se borran
-- explícitamente antes de eliminar el usuario de auth.users (lo demás cae por
-- cascade: profiles, workouts, exercises, routines, goals, trainer_clients,
-- trainer_invites, messages). agent_writes y exercise_merge_log no tienen FK a
-- auth.users, así que también van explícitas: si se olvidan no rompen el borrado,
-- pero dejarían snapshots con datos personales de una cuenta que ya no existe.
--
-- Si una tabla nueva referencia auth.users SIN cascade y no se añade aquí, el
-- `delete from auth.users` final revienta con violación de FK y NADIE con filas
-- en esa tabla puede borrar su cuenta (pasó con nutrition_foods).
--
-- SECURITY DEFINER para poder borrar de auth.users. Solo actúa sobre auth.uid(),
-- nunca sobre otro usuario. Ejecutable solo por 'authenticated'.
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  -- Tablas que referencian auth.users SIN on delete cascade
  delete from body_weight_logs   where user_id = uid;
  delete from supplement_logs    where user_id = uid;
  delete from supplements        where user_id = uid;
  delete from bloodwork_results  where user_id = uid;
  delete from nutrition_entries  where user_id = uid;
  delete from nutrition_targets  where user_id = uid;
  delete from nutrition_foods    where user_id = uid;
  -- Tablas sin FK a auth.users (snapshots de auditoría con datos personales)
  delete from agent_writes       where user_id = uid;
  delete from exercise_merge_log where user_id = uid;

  -- El resto cae por cascade al eliminar el usuario de auth.
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant  execute on function public.delete_own_account() to authenticated;
