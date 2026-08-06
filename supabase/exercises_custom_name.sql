-- Poner tu propio nombre a un ejercicio.
--
-- `name` no vale para esto. Es la clave con la que se resuelve un ejercicio:
-- lleva el unique(user_id, name) y es contra lo que casa getOrCreateExerciseId
-- cuando escribes «press banca» y hay que dar con la fila que ya guarda ese
-- historial. Renombrar sobre `name` movería esa clave, y con ella el riesgo de
-- chocar con otra fila o de partir en dos el historial de un mismo movimiento.
--
-- Y en los ejercicios enlazados a la biblioteca `name` ni siquiera se ve: el
-- nombre que se pinta sale de la biblioteca, en el idioma de la app. Escribir
-- ahí no cambiaría nada en pantalla.
--
-- Así que el nombre elegido va aparte y solo manda al pintar. El enlace con la
-- biblioteca se conserva —el gif y la clasificación siguen—, el historial no se
-- mueve, y borrarlo devuelve el nombre de siempre.

alter table public.exercises
  add column if not exists custom_name text;

comment on column public.exercises.custom_name is
  'Nombre puesto por la persona usuaria. Manda sobre el de la biblioteca al pintar, en cualquier idioma. Nulo = el nombre de siempre.';
