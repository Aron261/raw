-- Los dos ejercicios que quedaron sin decidir.
--
-- exercises_library_missing.sql los dejó fuera a propósito: "Cable Crossed
-- Extensions" no se sabía qué movimiento era —y tiene 9 entrenos detrás, así
-- que equivocarse costaba— y "Chest Supported Row" ya se había dejado ambiguo
-- en exercises_library_bilingual.sql ("¿es un remo en máquina o un T-bar con
-- pecho apoyado?"). Ahora están decididos: el primero es de tríceps, el
-- segundo de espalda.
--
-- Chest Supported Row se queda como fila propia y NO como alias de "Remo T-bar
-- con pecho apoyado", que es la duda que registró aquel comentario. Decir que
-- es de espalda no dice que sea el T-bar, y meterlo ahí fundiría dos
-- historiales que igual no son el mismo ejercicio. Si resulta que sí lo es,
-- fusionarlas después es una línea; separarlas otra vez, no.
--
-- Ninguno lleva animación: el corpus no tiene nada que se le parezca lo
-- bastante. Quedan para una próxima ronda de curación, con `media_reviewed`
-- en false, que es lo que impide que la app enseñe un movimiento equivocado.
--
-- Los dos usuarios que registraron "Chest Supported Row" se enlazan por
-- library_id, que es lo que conserva el historial; sus filas no se renombran.

begin;

insert into exercises_library
  (name, name_en, aliases, muscle_group, primary_muscles, secondary_muscles,
   category, movement_pattern, equipment, difficulty, is_compound, tracking_type,
   substitution_group, best_rep_min, best_rep_max, description, media_reviewed)
values
  ('Extensión de Tríceps cruzada en polea', 'Triceps Cable Crossed Extensions',
   array['cable crossed extensions','crossed extensions','extensiones cruzadas en polea',
         'triceps cable crossed extensions'],
   'Tríceps', array['Tríceps'], null,
   'push', 'triceps_extension', array['polea'], 'Intermedio', false, 'weight_reps',
   'extension_triceps', 10, 15,
   'Extensión de tríceps con los cables cruzados, uno en cada mano', false),

  ('Remo con pecho apoyado', 'Chest Supported Row',
   array['chest supported row','remo con pecho apoyado','remo pecho apoyado'],
   'Espalda', array['Espalda'], array['Bíceps'],
   'pull', 'horizontal_pull', array['maquina','banco'], 'Principiante', true, 'weight_reps',
   'remo_horizontal', 8, 12,
   'Jale horizontal con el pecho apoyado en un respaldo inclinado', false)
on conflict (name) do nothing;

-- Enlazar lo ya entrenado a su canon. Vale para todos los usuarios, no solo
-- para quien aplica: "Chest Supported Row" lo registraron dos personas.
update exercises e
   set library_id = l.id,
       muscle_group = coalesce(e.muscle_group, l.muscle_group)
  from exercises_library l
 where e.library_id is null
   and (
     (exercise_norm(e.name) = exercise_norm('Cable Crossed Extensions')
        and l.name = 'Extensión de Tríceps cruzada en polea') or
     (exercise_norm(e.name) = exercise_norm('Chest Supported Row')
        and l.name = 'Remo con pecho apoyado')
   );

commit;
