import { useCallback, useMemo } from 'react'
import { useProfile } from './useProfile'
import { translate, localeFor, normalizeLang } from '../lib/i18n'

/*
 * El idioma de la interfaz. Independiente de useExerciseLang, que solo elige
 * las palabras de los nombres de ejercicio: alguien puede querer la app en
 * español y los lifts en inglés, que es para lo que existe aquel ajuste.
 *
 * Devuelve también el `locale` para fechas y números, porque cambiar el idioma
 * sin cambiar el formato deja una app en inglés diciendo "12 de julio".
 */
export function useLang() {
  const { profile, saveProfile, saving } = useProfile()
  const lang = normalizeLang(profile?.app_lang)

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])
  const locale = useMemo(() => localeFor(lang), [lang])
  const setLang = useCallback((next) => saveProfile({ app_lang: normalizeLang(next) }), [saveProfile])

  return { lang, locale, t, setLang, saving }
}
