-- Generado por scripts/edb/emit-sql.js — no editar a mano.
-- Solo contiene filas marcadas OK en scripts/edb/review/*.tsv.
-- Requiere exercises_library_media.sql aplicado antes.

begin;

-- ── Media para ejercicios existentes (104) ──
update exercises_library l set
  gif_url = v.gif, media_source = 'exercisedb-oss', media_source_id = v.src,
  media_reviewed = true, updated_at = now()
from (values
  ('Curl con barra EZ', 'https://static.exercisedb.dev/media/6TG6x2w.gif', '6TG6x2w'),
  ('Curl con barra recta', 'https://static.exercisedb.dev/media/25GPyDY.gif', '25GPyDY'),
  ('Curl con mancuernas de pie', 'https://static.exercisedb.dev/media/3s4NnTh.gif', '3s4NnTh'),
  ('Curl en polea baja', 'https://static.exercisedb.dev/media/G08RZcQ.gif', 'G08RZcQ'),
  ('Curl inclinado con mancuernas', 'https://static.exercisedb.dev/media/ae9UoXQ.gif', 'ae9UoXQ'),
  ('Curl martillo', 'https://static.exercisedb.dev/media/2NpxjC1.gif', '2NpxjC1'),
  ('Curl predicador con barra EZ', 'https://static.exercisedb.dev/media/qOgPVf6.gif', 'qOgPVf6'),
  ('Curl predicador con mancuerna', 'https://static.exercisedb.dev/media/7D5bgLT.gif', '7D5bgLT'),
  ('Ab wheel', 'https://static.exercisedb.dev/media/NAgVB3t.gif', 'NAgVB3t'),
  ('Crunch en polea', 'https://static.exercisedb.dev/media/WW95auq.gif', 'WW95auq'),
  ('Crunch tradicional', 'https://static.exercisedb.dev/media/BMMolZ3.gif', 'BMMolZ3'),
  ('Elevación de piernas en barra', 'https://static.exercisedb.dev/media/QOA0FD0.gif', 'QOA0FD0'),
  ('Elevación de piernas tumbado', 'https://static.exercisedb.dev/media/9IxJdtC.gif', '9IxJdtC'),
  ('Farmer carry', 'https://static.exercisedb.dev/media/qPEzJjA.gif', 'qPEzJjA'),
  ('Mountain climbers', 'https://static.exercisedb.dev/media/RJgzwny.gif', 'RJgzwny'),
  ('Plancha frontal', 'https://static.exercisedb.dev/media/VBAWRPG.gif', 'VBAWRPG'),
  ('Plancha lateral', 'https://static.exercisedb.dev/media/VO2qeJg.gif', 'VO2qeJg'),
  ('Russian twist', 'https://static.exercisedb.dev/media/fZFZ704.gif', 'fZFZ704'),
  ('Sit-up', 'https://static.exercisedb.dev/media/2gPfomN.gif', '2gPfomN'),
  ('Woodchop en polea alta', 'https://static.exercisedb.dev/media/ZSJNetl.gif', 'ZSJNetl'),
  ('Woodchop en polea baja', 'https://static.exercisedb.dev/media/FVmZVhk.gif', 'FVmZVhk'),
  ('Aducción en máquina', 'https://static.exercisedb.dev/media/oHsrypV.gif', 'oHsrypV'),
  ('Extensión de cuádriceps en máquina', 'https://static.exercisedb.dev/media/my33uHU.gif', 'my33uHU'),
  ('Extensión de cuádriceps unilateral', 'https://static.exercisedb.dev/media/my33uHU.gif', 'my33uHU'),
  ('Hack squat en máquina', 'https://static.exercisedb.dev/media/Qa55kX1.gif', 'Qa55kX1'),
  ('Prensa de pierna', 'https://static.exercisedb.dev/media/V07qpXy.gif', 'V07qpXy'),
  ('Prensa de pierna unilateral', 'https://static.exercisedb.dev/media/V07qpXy.gif', 'V07qpXy'),
  ('Sentadilla con barra', 'https://static.exercisedb.dev/media/W9pFVv1.gif', 'W9pFVv1'),
  ('Sentadilla en Smith', 'https://static.exercisedb.dev/media/jFtipLl.gif', 'jFtipLl'),
  ('Sentadilla frontal', 'https://static.exercisedb.dev/media/Y7YcmIJ.gif', 'Y7YcmIJ'),
  ('Sentadilla goblet', 'https://static.exercisedb.dev/media/yn8yg1r.gif', 'yn8yg1r'),
  ('Sissy squat', 'https://static.exercisedb.dev/media/xdYPUtE.gif', 'xdYPUtE'),
  ('Zancada con barra', 'https://static.exercisedb.dev/media/py1HSzx.gif', 'py1HSzx'),
  ('Zancada con mancuernas', 'https://static.exercisedb.dev/media/RRWFUcw.gif', 'RRWFUcw'),
  ('Buenos días', 'https://static.exercisedb.dev/media/XlZ4lAC.gif', 'XlZ4lAC'),
  ('Dominadas agarre prono', 'https://static.exercisedb.dev/media/d1GgzTU.gif', 'd1GgzTU'),
  ('Dominadas agarre supino', 'https://static.exercisedb.dev/media/T2mxWqc.gif', 'T2mxWqc'),
  ('Encogimientos con barra', 'https://static.exercisedb.dev/media/dG7tG5y.gif', 'dG7tG5y'),
  ('Encogimientos con mancuernas', 'https://static.exercisedb.dev/media/NJzBsGJ.gif', 'NJzBsGJ'),
  ('Encogimientos en máquina', 'https://static.exercisedb.dev/media/ZZKbeMw.gif', 'ZZKbeMw'),
  ('Hiperextensiones en banco', 'https://static.exercisedb.dev/media/rUXfn3R.gif', 'rUXfn3R'),
  ('Jalón al pecho en polea alta', 'https://static.exercisedb.dev/media/RVwzP10.gif', 'RVwzP10'),
  ('Jalón en polea alta agarre supino', 'https://static.exercisedb.dev/media/xBYcQHj.gif', 'xBYcQHj'),
  ('Remo con barra', 'https://static.exercisedb.dev/media/eZyBC3j.gif', 'eZyBC3j'),
  ('Remo en máquina', 'https://static.exercisedb.dev/media/7I6LNUG.gif', '7I6LNUG'),
  ('Remo en polea baja', 'https://static.exercisedb.dev/media/fUBheHs.gif', 'fUBheHs'),
  ('Remo en polea baja agarre ancho', 'https://static.exercisedb.dev/media/qcY50ZD.gif', 'qcY50ZD'),
  ('Remo en Smith', 'https://static.exercisedb.dev/media/JGKowMS.gif', 'JGKowMS'),
  ('Remo invertido', 'https://static.exercisedb.dev/media/bZGHsAZ.gif', 'bZGHsAZ'),
  ('Remo T-bar', 'https://static.exercisedb.dev/media/R5swFnc.gif', 'R5swFnc'),
  ('Remo T-bar con pecho apoyado', 'https://static.exercisedb.dev/media/aaXr7ld.gif', 'aaXr7ld'),
  ('Straight-arm pulldown', 'https://static.exercisedb.dev/media/x69MAlq.gif', 'x69MAlq'),
  ('Superman', 'https://static.exercisedb.dev/media/4GqRrAk.gif', '4GqRrAk'),
  ('Elevación de talones de pie', 'https://static.exercisedb.dev/media/bJYHBIN.gif', 'bJYHBIN'),
  ('Elevación de talones en prensa', 'https://static.exercisedb.dev/media/7B4F5nZ.gif', '7B4F5nZ'),
  ('Elevación de talones sentado', 'https://static.exercisedb.dev/media/bOOdeyc.gif', 'bOOdeyc'),
  ('Abducción en máquina', 'https://static.exercisedb.dev/media/CHpahtl.gif', 'CHpahtl'),
  ('Glute bridge', 'https://static.exercisedb.dev/media/GibBPPg.gif', 'GibBPPg'),
  ('Step-up con mancuernas', 'https://static.exercisedb.dev/media/aXtJhlg.gif', 'aXtJhlg'),
  ('Zancada búlgara', 'https://static.exercisedb.dev/media/qx4fgX7.gif', 'qx4fgX7'),
  ('Curl femoral de pie', 'https://static.exercisedb.dev/media/M5Y7GPg.gif', 'M5Y7GPg'),
  ('Curl femoral sentado', 'https://static.exercisedb.dev/media/Zg3XY7P.gif', 'Zg3XY7P'),
  ('Curl femoral tumbado', 'https://static.exercisedb.dev/media/17lJ1kr.gif', '17lJ1kr'),
  ('Peso muerto piernas rígidas', 'https://static.exercisedb.dev/media/hrVQWvE.gif', 'hrVQWvE'),
  ('Peso muerto rumano', 'https://static.exercisedb.dev/media/o6LqKKP.gif', 'o6LqKKP'),
  ('Elevaciones frontales con barra', 'https://static.exercisedb.dev/media/b2Uoz54.gif', 'b2Uoz54'),
  ('Elevaciones frontales con mancuernas', 'https://static.exercisedb.dev/media/3eGE2JC.gif', '3eGE2JC'),
  ('Elevaciones frontales en polea baja', 'https://static.exercisedb.dev/media/u2X71Np.gif', 'u2X71Np'),
  ('Elevaciones laterales con mancuernas', 'https://static.exercisedb.dev/media/DsgkuIt.gif', 'DsgkuIt'),
  ('Elevaciones laterales en máquina', 'https://static.exercisedb.dev/media/dRTfGZT.gif', 'dRTfGZT'),
  ('Elevaciones laterales en polea baja', 'https://static.exercisedb.dev/media/goJ6ezq.gif', 'goJ6ezq'),
  ('Press en máquina de hombro', 'https://static.exercisedb.dev/media/67n3r98.gif', '67n3r98'),
  ('Press en Smith hombro', 'https://static.exercisedb.dev/media/903mzG8.gif', '903mzG8'),
  ('Press militar con barra de pie', 'https://static.exercisedb.dev/media/dCPESfR.gif', 'dCPESfR'),
  ('Press militar con barra sentado', 'https://static.exercisedb.dev/media/kTbSH9h.gif', 'kTbSH9h'),
  ('Press militar con mancuernas de pie', 'https://static.exercisedb.dev/media/A6wtbuL.gif', 'A6wtbuL'),
  ('Press militar con mancuernas sentado', 'https://static.exercisedb.dev/media/f1jf47L.gif', 'f1jf47L'),
  ('Aperturas con mancuernas plano', 'https://static.exercisedb.dev/media/8DiFDVA.gif', '8DiFDVA'),
  ('Aperturas inclinadas con mancuernas', 'https://static.exercisedb.dev/media/ESOd5Pl.gif', 'ESOd5Pl'),
  ('Flexiones', 'https://static.exercisedb.dev/media/I4hDWkc.gif', 'I4hDWkc'),
  ('Flexiones declinadas', 'https://static.exercisedb.dev/media/i5cEhka.gif', 'i5cEhka'),
  ('Flexiones diamante', 'https://static.exercisedb.dev/media/soIB2rj.gif', 'soIB2rj'),
  ('Flexiones inclinadas', 'https://static.exercisedb.dev/media/B1EVP9F.gif', 'B1EVP9F'),
  ('Fondos en paralelas', 'https://static.exercisedb.dev/media/9WTm7dq.gif', '9WTm7dq'),
  ('Pec deck / Mariposa', 'https://static.exercisedb.dev/media/wDN97Ca.gif', 'wDN97Ca'),
  ('Press de banca con barra', 'https://static.exercisedb.dev/media/EIeI8Vf.gif', 'EIeI8Vf'),
  ('Press de banca en Smith', 'https://static.exercisedb.dev/media/trqKQv2.gif', 'trqKQv2'),
  ('Press declinado con barra', 'https://static.exercisedb.dev/media/GrO65fd.gif', 'GrO65fd'),
  ('Press declinado con mancuernas', 'https://static.exercisedb.dev/media/DwhEmmE.gif', 'DwhEmmE'),
  ('Press inclinado con barra', 'https://static.exercisedb.dev/media/3TZduzM.gif', '3TZduzM'),
  ('Press inclinado con mancuernas', 'https://static.exercisedb.dev/media/ns0SIbU.gif', 'ns0SIbU'),
  ('Press inclinado en Smith', 'https://static.exercisedb.dev/media/5v7KYld.gif', '5v7KYld'),
  ('Pull-over en polea', 'https://static.exercisedb.dev/media/nIR4Rwl.gif', 'nIR4Rwl'),
  ('Extensión en polea alta con barra', 'https://static.exercisedb.dev/media/3ZflifB.gif', '3ZflifB'),
  ('Extensión en polea alta con cuerda', 'https://static.exercisedb.dev/media/dU605di.gif', 'dU605di'),
  ('Extensión en polea baja', 'https://static.exercisedb.dev/media/1xHyxys.gif', '1xHyxys'),
  ('Extensión unilateral en polea', 'https://static.exercisedb.dev/media/sYCcnon.gif', 'sYCcnon'),
  ('Fondos en banco', 'https://static.exercisedb.dev/media/9RT8oQW.gif', '9RT8oQW'),
  ('Press cerrado con barra', 'https://static.exercisedb.dev/media/J6Dx1Mu.gif', 'J6Dx1Mu'),
  ('Press cerrado en Smith', 'https://static.exercisedb.dev/media/WcHl7ru.gif', 'WcHl7ru'),
  ('Press francés con barra EZ tumbado', 'https://static.exercisedb.dev/media/6CKUx7o.gif', '6CKUx7o'),
  ('Press francés con mancuerna tumbado', 'https://static.exercisedb.dev/media/mpKZGWz.gif', 'mpKZGWz'),
  ('Press francés con mancuernas sentado', 'https://static.exercisedb.dev/media/kont8Ut.gif', 'kont8Ut'),
  ('Skull crusher con barra EZ', 'https://static.exercisedb.dev/media/h8LFzo9.gif', 'h8LFzo9')
) as v(name, gif, src)
where l.name = v.name;

-- ── Renombrados (26) ──
update exercises_library set
  name_en = 'Biceps EZ-Bar Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['EZ-Bar Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl con barra EZ';
update exercises_library set
  name_en = 'Biceps Barbell Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Barbell Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl con barra recta';
update exercises_library set
  name = 'Curl de Bíceps con mancuernas de pie',
  name_en = 'Standing Biceps Dumbbell Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl con mancuernas de pie', 'Standing Dumbbell Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl con mancuernas de pie';
update exercises_library set
  name = 'Curl de Bíceps en Polea',
  name_en = 'Biceps Cable Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl en polea baja', 'Cable Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl en polea baja';
update exercises_library set
  name = 'Curl inclinado de Bíceps con mancuernas',
  name_en = 'Incline Dumbbell Biceps Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl inclinado con mancuernas', 'Incline Dumbbell Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl inclinado con mancuernas';
update exercises_library set
  name = 'Curl Predicador con barra',
  name_en = 'Preacher Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl predicador con barra EZ', 'EZ-Bar Preacher Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl predicador con barra EZ';
update exercises_library set
  name = 'Crunch',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Crunch tradicional']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Crunch tradicional';
update exercises_library set
  name = 'Elevación de piernas',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Elevación de piernas en barra']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Elevación de piernas en barra';
update exercises_library set
  name = 'Jalón a la Cara',
  name_en = 'Face Pull',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Woodchop en polea alta', 'High Cable Woodchop']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Woodchop en polea alta';
update exercises_library set
  name = 'Jalón de Pecho en Polea Baja',
  name_en = 'Low Cable Chest Fly',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Woodchop en polea baja', 'Low Cable Woodchop']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Woodchop en polea baja';
update exercises_library set
  name = 'Extensión de cuádriceps',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Extensión de cuádriceps en máquina']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Extensión de cuádriceps en máquina';
update exercises_library set
  name = 'Hack squat',
  name_en = 'Hack Squat',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Hack squat en máquina', 'Hack Squat Machine']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Hack squat en máquina';
update exercises_library set
  name = 'Remo Acostado',
  name_en = 'Lying Row',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Remo T-bar', 'T-Bar Row']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Remo T-bar';
update exercises_library set
  name = 'Flexión de Pecho Superman',
  name_en = 'Superman Push-up',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Superman']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Superman';
update exercises_library set
  name = 'Curl de Bíceps con Disco',
  name_en = 'Plate Biceps Curl',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl femoral de pie', 'Standing Leg Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl femoral de pie';
update exercises_library set
  name = 'Curl Nórdico',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Nordic curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Nordic curl';
update exercises_library set
  name = 'Press en Landmine',
  name_en = 'Landmine Press',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press en máquina de hombro', 'Shoulder Press Machine']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press en máquina de hombro';
update exercises_library set
  name = 'Aperturas con mancuernas',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Aperturas con mancuernas plano']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Aperturas con mancuernas plano';
update exercises_library set
  name = 'Press de Pecho en Máquina',
  name_en = 'Machine Chest Press',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Pec deck / Mariposa', 'Pec Deck']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Pec deck / Mariposa';
update exercises_library set
  name = 'Press de banca',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press de banca con barra']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press de banca con barra';
update exercises_library set
  name = 'Press de Pecho Inclinado en máquina',
  name_en = 'Incline Machine Chest Press',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press en máquina inclinado', 'Incline Machine Press']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press en máquina inclinado';
update exercises_library set
  name = 'Press de Pecho en Polea',
  name_en = 'Cable Chest Press',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Pull-over en polea', 'Cable Chest Pullover']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Pull-over en polea';
update exercises_library set
  name = 'Press de Tríceps en Polea',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Extensión en polea alta con barra']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Extensión en polea alta con barra';
update exercises_library set
  name = 'Extensión de Tríceps con Cuerda',
  name_en = 'Rope Triceps Pushdown',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Extensión en polea alta con cuerda', 'Rope Pushdown']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Extensión en polea alta con cuerda';
update exercises_library set
  name = 'Extensión de Tríceps en polea baja',
  name_en = 'Overhead Tricep Extension',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Extensión en polea baja', 'Low Cable Tricep Extension']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Extensión en polea baja';
update exercises_library set
  name = 'Extensión de Tríceps unilateral en polea',
  name_en = 'Single-Arm Cable Triceps Extension',
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Extensión unilateral en polea', 'Single-Arm Cable Extension']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Extensión unilateral en polea';

-- ── Grupo muscular corregido (4) ──
update exercises_library
   set muscle_group = 'Espalda',
       primary_muscles = array['Espalda']::text[],
       updated_at = now()
 where name = 'Jalón a la Cara';
update exercises_library
   set muscle_group = 'Pecho',
       primary_muscles = array['Pecho']::text[],
       updated_at = now()
 where name = 'Jalón de Pecho en Polea Baja';
update exercises_library
   set muscle_group = 'Pecho',
       primary_muscles = array['Pecho']::text[],
       updated_at = now()
 where name = 'Flexión de Pecho Superman';
update exercises_library
   set muscle_group = 'Bíceps',
       primary_muscles = array['Bíceps']::text[],
       updated_at = now()
 where name = 'Curl de Bíceps con Disco';

-- ── Retiradas por duplicidad (4) ──
-- Curl en polea alta → Curl de Bíceps en Polea
update exercises_library set
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Curl en polea alta', 'High Cable Curl']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Curl de Bíceps en Polea';
update exercises_library
   set is_active = false, updated_at = now()
 where name = 'Curl en polea alta';
-- Face pull en polea → Jalón a la Cara
update exercises_library set
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Face pull en polea', 'Face Pull']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Jalón a la Cara';
update exercises_library
   set is_active = false, updated_at = now()
 where name = 'Face pull en polea';
-- Press landmine → Press en Landmine
update exercises_library set
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press landmine', 'Landmine Press']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press en Landmine';
update exercises_library
   set is_active = false, updated_at = now()
 where name = 'Press landmine';
-- Press en máquina pecho → Press de Pecho en Máquina
update exercises_library set
  aliases = aliases || (
    select coalesce(array_agg(n), '{}')
    from unnest(array['Press en máquina pecho', 'Machine Chest Press']::text[]) n
    where exercise_norm(n) not in (select exercise_norm(a) from unnest(aliases) a)),
  updated_at = now()
where name = 'Press de Pecho en Máquina';
update exercises_library
   set is_active = false, updated_at = now()
 where name = 'Press en máquina pecho';

commit;
