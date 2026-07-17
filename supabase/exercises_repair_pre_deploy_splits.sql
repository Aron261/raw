-- One-time repair for the window between the bilingual migration and the code
-- deploy. The migration renamed routine_day_exercises to canonical names but
-- only renamed exercise rows that were merge survivors; a solo linked row kept
-- its typed name ("Squat"). A workout logged on the still-old code in that
-- window couldn't match by name and created a fresh unlinked row, re-splitting
-- a history the migration had just unified.
--
-- Already applied to production. exercises_library_bilingual.sql now renames
-- EVERY linked exercise (not just survivors), so a fresh apply cannot leave the
-- gap this repairs — this file exists for the DB that already ran the old one.
do $$
declare
  grp record; survivor record; victim record; moved uuid[];
begin
  for grp in
    select e.user_id, resolve_library_exercise(e.name) as lib
    from exercises e
    where resolve_library_exercise(e.name) is not null
    group by e.user_id, resolve_library_exercise(e.name)
    having count(*) filter (where e.library_id is not null) >= 1
       and count(*) filter (where e.library_id is null
                              and resolve_library_exercise(e.name) is not null) >= 1
  loop
    select e.id, e.name,
           (select count(*) from sets s join workout_exercises we on s.workout_exercise_id=we.id
             where we.exercise_id=e.id) as sets
      into survivor
      from exercises e
     where e.user_id = grp.user_id
       and (e.library_id = grp.lib or resolve_library_exercise(e.name) = grp.lib)
     order by sets desc, (e.library_id is not null) desc, e.created_at asc
     limit 1;

    for victim in
      select e.id, e.name
        from exercises e
       where e.user_id = grp.user_id
         and (e.library_id = grp.lib or resolve_library_exercise(e.name) = grp.lib)
         and e.id <> survivor.id
    loop
      select coalesce(array_agg(id), '{}') into moved from workout_exercises where exercise_id = victim.id;
      update workout_exercises set exercise_id = survivor.id where exercise_id = victim.id;
      insert into exercise_merge_log (user_id, library_id, survivor_id, survivor_name_before,
        survivor_name_after, absorbed_id, absorbed_name, moved_workout_exercise_ids)
      values (grp.user_id, grp.lib, survivor.id, survivor.name,
        (select name from exercises_library where id = grp.lib), victim.id, victim.name, moved);
      delete from exercises where id = victim.id;
    end loop;

    update exercises
       set library_id = grp.lib, name = (select name from exercises_library where id = grp.lib)
     where id = survivor.id;
  end loop;

  -- Close the gap for everyone.
  update exercises e
     set name = l.name
    from exercises_library l
   where e.library_id = l.id and e.name <> l.name;
end $$;
