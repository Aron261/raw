-- Curl femoral sentado unilateral: le faltaba entrada propia.
--
-- La biblioteca tenía "Curl femoral sentado" (sentado, a dos piernas) y "Curl
-- femoral tumbado unilateral" (una pierna, pero tumbado). El cruce de los dos
-- —sentado y a una pierna— no existía, así que quien lo hace teclea "Single Leg
-- Seated Curl", no hay match, y nace un ejercicio custom con el historial en
-- blanco. Pasó en esta cuenta el 27 de agosto.
--
-- Los alias son las formas en que se teclea de verdad, en los dos idiomas. Con
-- la búsqueda por palabras (exercises_search_words.sql) bastaría con una, pero
-- el resolutor —resolve_library_exercise— sigue exigiendo igualdad exacta, y es
-- él quien decide si al guardar te enlazas al canon o te quedas custom.

insert into exercises_library
  (name, name_en, muscle_group, category, primary_muscles, secondary_muscles,
   movement_pattern, equipment, difficulty, is_compound, tracking_type,
   substitution_group, best_rep_min, best_rep_max, aliases)
values
  ('Curl femoral sentado unilateral', 'Single-Leg Seated Leg Curl', 'Hamstrings', 'legs',
   array['Hamstrings'], array[]::text[], 'leg_curl_iso', array['maquina'], 'Principiante',
   false, 'weight_reps', 'curl_femoral', 8, 15,
   array['single leg seated curl','seated single leg curl','single-leg seated leg curl',
         'curl femoral sentado a una pierna','curl femoral unilateral sentado'])
on conflict do nothing;
