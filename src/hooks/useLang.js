import { useCallback, useMemo } from 'react'
import { useProfile } from './useProfile'
import { translate, localeFor, normalizeLang } from '../lib/i18n'

/*
 * El idioma de la app. Es el único: useExerciseLang cuelga de este, así que
 * los nombres de ejercicio siguen a la interfaz y no hay forma de acabar con
 * media pantalla en cada idioma.
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
