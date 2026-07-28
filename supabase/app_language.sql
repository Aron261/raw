-- ── Idioma de la interfaz ───────────────────────────────────────────────
--
-- Es el ÚNICO ajuste de idioma: manda también sobre los nombres de ejercicio.
-- Hubo una etapa con exercise_lang (§8 de exercises_library_bilingual.sql) como
-- ajuste aparte; esa columna sigue en la tabla pero ya no la lee ni la escribe
-- nadie. No se borra porque tirar una columna es destructivo y no hace falta:
-- si algún día se vuelve a separar, los datos siguen ahí.
--
-- Por defecto 'es' — es el idioma en el que está escrita la app y en el que la
-- usan las personas que ya tienen cuenta. Nadie se despierta con la app
-- cambiada de idioma por este despliegue.
--
-- No toca datos: elige palabras. La identidad de un ejercicio es library_id,
-- así que el historial, los récords y las rutinas son los mismos en cualquier
-- idioma.

alter table profiles add column if not exists app_lang text not null default 'es'
  check (app_lang in ('es', 'en'));

comment on column profiles.app_lang is
  'Idioma de la app (es|en). Único ajuste de idioma: manda también sobre los nombres de ejercicio. exercise_lang quedó en desuso.';
