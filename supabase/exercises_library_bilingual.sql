-- Bilingual canonical exercise identity.
--
-- The problem: exercise identity was a free-text name, upserted per user on
-- (user_id, name). "Bench Press" and "Press de banca con barra" were two
-- unrelated exercises with two separate PR histories, so the app's central
-- claim — the number is the hero — was reporting the wrong number.
--
-- The fix: the library is the canon. Each library row carries a Spanish name
-- (canonical), an English name, and an alias list; a per-user exercise links to
-- its library row via library_id. Names become labels; ids become identity.
-- Custom exercises keep library_id null — they are their own canon.
--
-- Apply order matters: the uniqueness guarantee in §6 can only be created once
-- existing duplicates have been merged (§5).

-- ── 1. Library: English name + aliases ──────────────────────────────────
alter table exercises_library add column if not exists name_en text;
alter table exercises_library add column if not exists aliases text[] not null default '{}';

-- ── 2. Per-user exercises: link to the canon ────────────────────────────
alter table exercises add column if not exists library_id uuid references exercises_library(id);
create index if not exists exercises_library_id_idx on exercises(library_id);

-- ── 3. Normalisation + resolution ───────────────────────────────────────
-- Accent- and case-insensitive, whitespace-collapsed. Marked immutable so it
-- can back an index; unaccent() is only stable, hence the wrapper.
create extension if not exists unaccent;

create or replace function exercise_norm(txt text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, extensions
as $$
  select regexp_replace(lower(trim(public.unaccent(txt))), '\s+', ' ', 'g')
$$;

-- Resolve any spelling a lifter might type to its library row: Spanish name,
-- English name, or a known alias. Null means "no canonical match" — the signal
-- to create a custom exercise.
create or replace function resolve_library_exercise(txt text)
returns uuid
language sql
stable
parallel safe
set search_path = public
as $$
  select l.id
  from exercises_library l
  where exercise_norm(l.name) = exercise_norm(txt)
     or exercise_norm(l.name_en) = exercise_norm(txt)
     or exists (select 1 from unnest(l.aliases) a where exercise_norm(a) = exercise_norm(txt))
  order by
    (exercise_norm(l.name) = exercise_norm(txt)) desc,
    (exercise_norm(l.name_en) = exercise_norm(txt)) desc
  limit 1
$$;

create index if not exists exercises_library_name_norm_idx on exercises_library(exercise_norm(name));
create index if not exists exercises_library_name_en_norm_idx on exercises_library(exercise_norm(name_en));

-- ── 4. English names + aliases ──────────────────────────────────────────
-- Aliases are only for names that mean the *same movement*. Anything requiring
-- judgement (is "Chest Supported Row" a machine row or a chest-supported T-bar
-- row?) is deliberately absent: a wrong alias silently merges two histories.
-- Verify after loading that no key resolves to two rows.
update exercises_library l
   set name_en = v.en,
       aliases = case when v.al = '' then '{}'::text[] else string_to_array(v.al, '||') end
from (values
  ('Curl con barra EZ', 'EZ-Bar Curl', 'ez bar curl||ez curl'),
  ('Curl con barra recta', 'Barbell Curl', 'barbell curl||straight bar curl'),
  ('Curl con mancuernas de pie', 'Standing Dumbbell Curl', 'standing dumbbell curl||standing db curl||dumbbell curl||db curl'),
  ('Curl con mancuernas sentado', 'Seated Dumbbell Curl', 'seated dumbbell curl||seated db curl'),
  ('Curl en máquina', 'Machine Curl', 'machine curl||machine bicep curl'),
  ('Curl en polea alta', 'High Cable Curl', 'high cable curl'),
  ('Curl en polea baja', 'Cable Curl', 'cable curl||biceps cable curl||bicep cable curl||low cable curl'),
  ('Curl inclinado con mancuernas', 'Incline Dumbbell Curl', 'incline dumbbell curl||incline db curl'),
  ('Curl martillo', 'Hammer Curl', 'hammer curl||hammer curls'),
  ('Curl predicador con barra EZ', 'EZ-Bar Preacher Curl', 'preacher curl||ez preacher curl'),
  ('Curl predicador con mancuerna', 'Dumbbell Preacher Curl', 'dumbbell preacher curl||db preacher curl'),
  ('Ab wheel', 'Ab Wheel Rollout', 'ab wheel||ab rollout||ab wheel rollout'),
  ('Bird dog', 'Bird Dog', ''),
  ('Crunch en polea', 'Cable Crunch', 'cable crunch||kneeling cable crunch'),
  ('Crunch inverso', 'Reverse Crunch', 'reverse crunch'),
  ('Crunch tradicional', 'Crunch', 'crunch||crunches'),
  ('Dead bug', 'Dead Bug', ''),
  ('Dragon flag', 'Dragon Flag', ''),
  ('Elevación de piernas en barra', 'Hanging Leg Raise', 'hanging leg raise||hanging leg raises'),
  ('Elevación de piernas tumbado', 'Lying Leg Raise', 'lying leg raise||lying leg raises'),
  ('Farmer carry', 'Farmer''s Carry', 'farmer carry||farmers carry||farmer''s walk'),
  ('Hollow body hold', 'Hollow Body Hold', 'hollow hold'),
  ('Mountain climbers', 'Mountain Climbers', ''),
  ('Pallof press', 'Pallof Press', ''),
  ('Plancha con elevación de brazo', 'Plank with Arm Raise', 'plank with arm raise'),
  ('Plancha frontal', 'Plank', 'plank||front plank'),
  ('Plancha lateral', 'Side Plank', 'side plank'),
  ('Rodillas al pecho en barra', 'Hanging Knee Raise', 'hanging knee raise||hanging knee raises'),
  ('Russian twist', 'Russian Twist', ''),
  ('Sit-up', 'Sit-Up', 'sit up||situp'),
  ('Suitcase carry', 'Suitcase Carry', ''),
  ('Woodchop en polea alta', 'High Cable Woodchop', 'high woodchop'),
  ('Woodchop en polea baja', 'Low Cable Woodchop', 'low woodchop'),
  ('Aducción en máquina', 'Hip Adduction Machine', 'hip adduction||adduction machine||adductor machine||adduccion de cadera||hip adductor'),
  ('Extensión de cuádriceps en máquina', 'Leg Extension', 'leg extension||leg extensions||quad extension'),
  ('Extensión de cuádriceps unilateral', 'Single-Leg Extension', 'single leg extension||single leg extensions||unilateral leg extension'),
  ('Hack squat en máquina', 'Hack Squat Machine', 'hack squat||hack squat machine'),
  ('Prensa de pierna', 'Leg Press', 'leg press'),
  ('Prensa de pierna unilateral', 'Single-Leg Press', 'single leg press||unilateral leg press'),
  ('Sentadilla con barra', 'Barbell Squat', 'squat||squats||barbell squat||back squat'),
  ('Sentadilla en Smith', 'Smith Machine Squat', 'smith squat||smith machine squat'),
  ('Sentadilla frontal', 'Front Squat', 'front squat'),
  ('Sentadilla goblet', 'Goblet Squat', 'goblet squat'),
  ('Sentadilla hack con barra', 'Barbell Hack Squat', 'barbell hack squat'),
  ('Sissy squat', 'Sissy Squat', ''),
  ('Zancada con barra', 'Barbell Lunge', 'barbell lunge||barbell lunges'),
  ('Zancada con mancuernas', 'Dumbbell Lunge', 'dumbbell lunge||db lunge||lunges||lunge'),
  ('Buenos días', 'Good Morning', 'good morning||good mornings'),
  ('Dominadas agarre prono', 'Pull-Up', 'pull up||pullup||pull ups||pullups'),
  ('Dominadas agarre supino', 'Chin-Up', 'chin up||chinup||chin ups'),
  ('Encogimientos con barra', 'Barbell Shrug', 'barbell shrug||barbell shrugs'),
  ('Encogimientos con mancuernas', 'Dumbbell Shrug', 'dumbbell shrug||db shrug'),
  ('Encogimientos en máquina', 'Machine Shrug', 'machine shrug'),
  ('Face pull en polea', 'Face Pull', 'face pull||face pulls'),
  ('Hiperextensiones en banco', 'Back Extension', 'back extension||hyperextension||hyperextensions'),
  ('Jalón al pecho agarre cerrado', 'Close-Grip Lat Pulldown', 'close grip pulldown||close grip lat pulldown'),
  ('Jalón al pecho en polea alta', 'Lat Pulldown', 'lat pulldown||lat pull down||pulldown'),
  ('Jalón en polea alta agarre supino', 'Underhand Lat Pulldown', 'underhand pulldown||supinated pulldown||reverse grip pulldown'),
  ('Pullover en polea alta', 'Cable Lat Pullover', 'cable pullover||lat pullover'),
  ('Remo con barra', 'Barbell Row', 'barbell row||bent over row||barbell rows'),
  ('Remo con mancuerna unilateral', 'Single-Arm Dumbbell Row', 'dumbbell row||db row||one arm row||single arm row'),
  ('Remo en máquina', 'Machine Row', 'machine row||seated machine row'),
  ('Remo en polea baja', 'Seated Cable Row', 'cable row||seated cable row||low row'),
  ('Remo en polea baja agarre ancho', 'Wide-Grip Cable Row', 'wide grip cable row'),
  ('Remo en Smith', 'Smith Machine Row', 'smith row||smith machine row'),
  ('Remo invertido', 'Inverted Row', 'inverted row'),
  ('Remo T-bar', 'T-Bar Row', 't bar row||tbar row||t-bar row'),
  ('Remo T-bar con pecho apoyado', 'Chest-Supported T-Bar Row', 'chest supported t bar row'),
  ('Straight-arm pulldown', 'Straight-Arm Pulldown', 'straight arm pulldown||straight arm pull down'),
  ('Superman', 'Superman', ''),
  ('Elevación de talones de pie', 'Standing Calf Raise', 'standing calf raise||calf raises standing'),
  ('Elevación de talones en prensa', 'Calf Press', 'calf press||calf raise on leg press'),
  ('Elevación de talones sentado', 'Seated Calf Raise', 'seated calf raise||calf raises seated||calf raise seated'),
  ('Abducción en máquina', 'Hip Abduction Machine', 'hip abduction||abduction machine||glute abduction||abductor machine'),
  ('Glute bridge', 'Glute Bridge', ''),
  ('Hip thrust con barra', 'Barbell Hip Thrust', 'hip thrust||barbell hip thrust'),
  ('Hip thrust en máquina', 'Machine Hip Thrust', 'machine hip thrust'),
  ('Patada de glúteo en polea', 'Cable Kickback', 'cable kickback||glute kickback'),
  ('Step-up con mancuernas', 'Dumbbell Step-Up', 'step up||step ups||dumbbell step up'),
  ('Zancada búlgara', 'Bulgarian Split Squat', 'bulgarian split squat||bulgarian'),
  ('Zancada inversa', 'Reverse Lunge', 'reverse lunge||reverse lunges'),
  ('Curl femoral de pie', 'Standing Leg Curl', 'standing leg curl'),
  ('Curl femoral sentado', 'Seated Leg Curl', 'seated leg curl||leg curl seated'),
  ('Curl femoral tumbado', 'Lying Leg Curl', 'lying leg curl||leg curl lying||leg curl'),
  ('Nordic curl', 'Nordic Curl', 'nordic ham curl'),
  ('Peso muerto piernas rígidas', 'Stiff-Leg Deadlift', 'stiff leg deadlift||sldl||straight leg deadlift'),
  ('Peso muerto rumano', 'Romanian Deadlift', 'romanian deadlift||rdl'),
  ('Elevaciones frontales con barra', 'Barbell Front Raise', 'barbell front raise'),
  ('Elevaciones frontales con mancuernas', 'Dumbbell Front Raise', 'front raise||dumbbell front raise||front raises'),
  ('Elevaciones frontales en polea baja', 'Cable Front Raise', 'cable front raise'),
  ('Elevaciones laterales con mancuernas', 'Dumbbell Lateral Raise', 'lateral raise||lateral raises||side raise||db lateral raise||dumbbell lateral raises'),
  ('Elevaciones laterales en máquina', 'Machine Lateral Raise', 'machine lateral raise||machine lateral raises'),
  ('Elevaciones laterales en polea baja', 'Cable Lateral Raise', 'cable lateral raise||cable lateral raises||cable side raise'),
  ('Press en máquina de hombro', 'Shoulder Press Machine', 'machine shoulder press||shoulder press machine'),
  ('Press en Smith hombro', 'Smith Machine Shoulder Press', 'smith shoulder press'),
  ('Press landmine', 'Landmine Press', 'landmine press'),
  ('Press militar con barra de pie', 'Standing Barbell Overhead Press', 'overhead press||ohp||military press||standing barbell press'),
  ('Press militar con barra sentado', 'Seated Barbell Overhead Press', 'seated barbell press||seated military press'),
  ('Press militar con mancuernas de pie', 'Standing Dumbbell Shoulder Press', 'standing dumbbell shoulder press'),
  ('Press militar con mancuernas sentado', 'Seated Dumbbell Shoulder Press', 'seated dumbbell shoulder press||shoulder dumbbell press||dumbbell shoulder press||db shoulder press'),
  ('Aperturas con mancuernas plano', 'Flat Dumbbell Fly', 'dumbbell fly||flat dumbbell fly||db fly'),
  ('Aperturas inclinadas con mancuernas', 'Incline Dumbbell Fly', 'incline dumbbell fly||incline fly'),
  ('Crossover en polea alta', 'High Cable Crossover', 'high cable crossover'),
  ('Crossover en polea baja', 'Low Cable Crossover', 'low cable crossover'),
  ('Crossover en polea media', 'Cable Crossover', 'cable crossover||crossover'),
  ('Flexiones', 'Push-Up', 'push up||pushup||push ups||pushups'),
  ('Flexiones declinadas', 'Decline Push-Up', 'decline push up'),
  ('Flexiones diamante', 'Diamond Push-Up', 'diamond push up'),
  ('Flexiones inclinadas', 'Incline Push-Up', 'incline push up'),
  ('Fondos en paralelas', 'Chest Dip', 'chest dip||dips||parallel bar dips'),
  ('Pec deck / Mariposa', 'Pec Deck', 'pec deck||pectoral fly machine||chest fly machine||butterfly||pec fly'),
  ('Press de banca con barra', 'Barbell Bench Press', 'bench press||barbell bench press||flat bench press||bench'),
  ('Press de banca con mancuernas', 'Dumbbell Bench Press', 'dumbbell bench press||dumbbell chest press||db bench press||db chest press'),
  ('Press de banca en Smith', 'Smith Machine Bench Press', 'smith bench press'),
  ('Press declinado con barra', 'Decline Barbell Press', 'decline bench press||decline barbell press'),
  ('Press declinado con mancuernas', 'Decline Dumbbell Press', 'decline dumbbell press'),
  ('Press en máquina inclinado', 'Incline Machine Press', 'incline machine press'),
  ('Press en máquina pecho', 'Machine Chest Press', 'machine chest press||chest press machine'),
  ('Press inclinado con barra', 'Incline Barbell Press', 'incline bench press||incline barbell press'),
  ('Press inclinado con mancuernas', 'Incline Dumbbell Press', 'incline dumbbell press||incline db press'),
  ('Press inclinado en Smith', 'Incline Smith Machine Press', 'incline smith press'),
  ('Pull-over en polea', 'Cable Chest Pullover', 'chest cable pullover'),
  ('Extensión en polea alta con barra', 'Tricep Pushdown', 'tricep pushdown||triceps pushdown||pushdown||bar pushdown'),
  ('Extensión en polea alta con cuerda', 'Rope Pushdown', 'rope pushdown||rope pushdowns||rope tricep extension'),
  ('Extensión en polea baja', 'Low Cable Tricep Extension', 'low cable tricep extension'),
  ('Extensión unilateral en polea', 'Single-Arm Cable Extension', 'single arm cable extension||unilateral tricep extension'),
  ('Fondos en banco', 'Bench Dip', 'bench dip||bench dips'),
  ('Fondos en paralelas tríceps', 'Tricep Dip', 'tricep dip||triceps dip'),
  ('Katanas en polea baja', 'Cable Overhead Tricep Extension', 'katanas||overhead cable tricep extension'),
  ('Press cerrado con barra', 'Close-Grip Bench Press', 'close grip bench press||close grip bench'),
  ('Press cerrado en Smith', 'Close-Grip Smith Press', 'close grip smith press'),
  ('Press francés con barra EZ tumbado', 'Lying EZ-Bar Triceps Extension', 'french press||lying ez bar extension'),
  ('Press francés con mancuerna tumbado', 'Lying Dumbbell Triceps Extension', 'lying dumbbell extension'),
  ('Press francés con mancuernas sentado', 'Seated Dumbbell Triceps Extension', 'seated dumbbell extension||overhead dumbbell extension'),
  ('Skull crusher con barra EZ', 'EZ-Bar Skull Crusher', 'skull crusher||skullcrusher||skull crushers'),
  ('Skull crusher con mancuernas', 'Dumbbell Skull Crusher', 'dumbbell skull crusher')
) as v(es, en, al)
where l.name = v.es;

-- ── 5. Link existing rows + merge duplicates ────────────────────────────
-- A merge moves history between exercises. Log every one so a mapping that
-- later proves wrong can be undone by hand.
create table if not exists exercise_merge_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merged_at timestamptz not null default now(),
  library_id uuid,
  survivor_id uuid not null,
  survivor_name_before text not null,
  survivor_name_after text not null,
  absorbed_id uuid not null,
  absorbed_name text not null,
  moved_workout_exercise_ids uuid[] not null default '{}'
);
alter table exercise_merge_log enable row level security;
drop policy if exists "Users read own merge log" on exercise_merge_log;
create policy "Users read own merge log" on exercise_merge_log
  for select using (auth.uid() = user_id);

-- Non-destructive: an unmatched name keeps library_id null and stays its own canon.
update exercises set library_id = resolve_library_exercise(name) where library_id is null;

-- The survivor of a merge is the row carrying the most logged sets — the one
-- whose history the lifter actually built.
do $$
declare grp record; survivor record; victim record; moved uuid[];
begin
  for grp in
    select user_id, library_id from exercises
     where library_id is not null
     group by user_id, library_id having count(*) > 1
  loop
    select e.id, e.name,
           (select count(*) from sets s join workout_exercises we on s.workout_exercise_id = we.id
             where we.exercise_id = e.id) as sets
      into survivor
      from exercises e
     where e.user_id = grp.user_id and e.library_id = grp.library_id
     order by sets desc, e.created_at asc limit 1;

    for victim in
      select e.id, e.name from exercises e
       where e.user_id = grp.user_id and e.library_id = grp.library_id and e.id <> survivor.id
    loop
      select coalesce(array_agg(id), '{}') into moved from workout_exercises where exercise_id = victim.id;
      update workout_exercises set exercise_id = survivor.id where exercise_id = victim.id;
      insert into exercise_merge_log (user_id, library_id, survivor_id, survivor_name_before,
        survivor_name_after, absorbed_id, absorbed_name, moved_workout_exercise_ids)
      values (grp.user_id, grp.library_id, survivor.id, survivor.name,
        (select name from exercises_library where id = grp.library_id), victim.id, victim.name, moved);
      delete from exercises where id = victim.id;
    end loop;

    update exercises set name = (select name from exercises_library where id = grp.library_id)
     where id = survivor.id;
  end loop;
end $$;

-- Rename EVERY linked exercise to its canonical name, not just merge survivors.
-- A solo linked row left under its typed name ("Squat") together with the
-- routine rename below is exactly what lets pre-deploy old code (which upserts
-- by name) re-create a split "Sentadilla con barra" — the name and the
-- identity must agree everywhere.
update exercises e
   set name = l.name
  from exercises_library l
 where e.library_id = l.id and e.name <> l.name;

-- Routines address exercises by text name; re-point any name a merge retired.
update routine_day_exercises rde
   set exercise_name = l.name
  from exercises_library l
 where l.id = resolve_library_exercise(rde.exercise_name)
   and rde.exercise_name <> l.name;

-- ── 6. The guarantee ────────────────────────────────────────────────────
-- One exercise per library entry per user, enforced by the database rather than
-- by convention: a second "Bench Press" can never split the history again.
-- Custom exercises (library_id null) are exempt — nulls don't collide.
create unique index if not exists exercises_user_library_uniq
  on exercises(user_id, library_id) where library_id is not null;

-- ── 7. The only door for creating an exercise ───────────────────────────
-- Resolves whatever was typed to the canonical row, reusing the exercise that
-- already holds this movement's history. Runs as the caller, so RLS applies and
-- auth.uid() owns the result.
create or replace function get_or_create_exercise(p_name text, p_muscle_group text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lib uuid; v_id uuid; v_lib_name text; v_lib_group text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'exercise name required'; end if;

  v_lib := resolve_library_exercise(p_name);

  if v_lib is not null then
    select id into v_id from exercises where user_id = v_uid and library_id = v_lib limit 1;
    if v_id is not null then return v_id; end if;

    select name, muscle_group into v_lib_name, v_lib_group from exercises_library where id = v_lib;

    -- Adopt a pre-existing unlinked row with the canonical name rather than
    -- colliding with the (user_id, name) unique constraint.
    select id into v_id from exercises
     where user_id = v_uid and exercise_norm(name) = exercise_norm(v_lib_name) limit 1;
    if v_id is not null then
      update exercises set library_id = v_lib where id = v_id;
      return v_id;
    end if;

    insert into exercises (user_id, name, library_id, muscle_group)
    values (v_uid, v_lib_name, v_lib, coalesce(p_muscle_group, v_lib_group))
    returning id into v_id;
    return v_id;
  end if;

  -- No canonical match: a custom exercise, its own canon.
  select id into v_id from exercises
   where user_id = v_uid and exercise_norm(name) = exercise_norm(p_name) limit 1;
  if v_id is not null then return v_id; end if;

  insert into exercises (user_id, name, muscle_group)
  values (v_uid, btrim(p_name), p_muscle_group) returning id into v_id;
  return v_id;
end $$;

-- ── 8. Display language ─────────────────────────────────────────────────
-- Chooses the words only; identity is library_id, so switching never touches
-- history or PRs.
alter table profiles add column if not exists exercise_lang text not null default 'es'
  check (exercise_lang in ('es','en'));
