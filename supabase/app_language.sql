-- ── Idioma de la interfaz ───────────────────────────────────────────────
--
-- Independiente de exercise_lang (§8 de exercises_library_bilingual.sql), que
-- solo elige las palabras de los nombres de ejercicio. Son dos ajustes a
-- propósito: alguien puede querer la app en español y los lifts en inglés, que
-- es justo para lo que existe aquel.
--
-- Por defecto 'es' — es el idioma en el que está escrita la app y en el que la
-- usan las personas que ya tienen cuenta. Nadie se despierta con la app
-- cambiada de idioma por este despliegue.
--
-- No toca datos: igual que exercise_lang, esto elige palabras. El historial,
-- los récords y las rutinas son los mismos en cualquier idioma.

alter table profiles add column if not exists app_lang text not null default 'es'
  check (app_lang in ('es', 'en'));

comment on column profiles.app_lang is
  'Idioma de la interfaz (es|en). Independiente de exercise_lang, que solo afecta a los nombres de ejercicio.';
