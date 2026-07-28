// La clave es el texto en español, así que la propiedad que más importa aquí es
// la red de seguridad: una cadena sin traducir sale en español, nunca en blanco
// ni como una clave cruda.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { translate, localeFor, normalizeLang, dictionaryFor, LANGS } from './i18n'

describe('translate', () => {
  it('traduce lo que está en el diccionario', () => {
    expect(translate('en', 'Esta semana')).toBe('This week')
  })

  it('en español devuelve la clave, que YA es el español', () => {
    expect(translate('es', 'Esta semana')).toBe('Esta semana')
  })

  it('una cadena sin traducir cae al español en vez de romperse', () => {
    // Esto es lo que compra usar el español como clave: olvidarse de traducir
    // algo degrada a "sigue en español", no a una pantalla con "home.week".
    expect(translate('en', 'Una frase que nadie tradujo')).toBe('Una frase que nadie tradujo')
  })

  it('interpola variables', () => {
    expect(translate('es', '{n} días este mes', { n: 12 })).toBe('12 días este mes')
  })

  it('interpola la misma variable varias veces', () => {
    expect(translate('es', '{n} de {n}', { n: 3 })).toBe('3 de 3')
  })

  it('un idioma desconocido no revienta: cae al español', () => {
    expect(translate('fr', 'Esta semana')).toBe('Esta semana')
  })
})

describe('normalizeLang', () => {
  it('acepta los idiomas soportados', () => {
    for (const l of LANGS) expect(normalizeLang(l)).toBe(l)
  })
  it('cualquier otra cosa cae a español', () => {
    for (const v of [null, undefined, '', 'pt', 'EN', 123]) {
      expect(normalizeLang(v)).toBe('es')
    }
  })
})

describe('localeFor', () => {
  it('cambia también fechas y números, no solo palabras', () => {
    // Una app en inglés diciendo "12 de julio" está a medio traducir.
    expect(localeFor('es')).toBe('es-CO')
    expect(localeFor('en')).toBe('en-US')
    expect(localeFor('marciano')).toBe('es-CO')
  })
})

describe('diccionario inglés', () => {
  const en = dictionaryFor('en')

  it('existe y tiene contenido', () => {
    expect(en).toBeTruthy()
    expect(Object.keys(en).length).toBeGreaterThan(100)
  })

  it('ninguna entrada está vacía', () => {
    const empty = Object.entries(en).filter(([, v]) => !v || !String(v).trim())
    expect(empty).toEqual([])
  })

  it('ninguna entrada se quedó igual que el español por descuido', () => {
    // Algunas coinciden de verdad ("Cardio", "reps", "coach"); el resto sería
    // una traducción sin hacer que pasaría desapercibida.
    const SAME_ON_PURPOSE = new Set(['Cardio', 'reps', 'rep', 'coach', 'Auto', 'kcal hoy', 'Email', 'Snacks', 'Plan'])
    const suspicious = Object.entries(en)
      .filter(([k, v]) => k === v && !SAME_ON_PURPOSE.has(k))
      .map(([k]) => k)
    expect(suspicious).toEqual([])
  })

  it('no tiene claves duplicadas', () => {
    // Un literal de 400 entradas se presta a repetir una clave sin darse
    // cuenta: JS se queda con la última en silencio y la primera traducción
    // desaparece. Pasó con tres al ampliar el diccionario.
    const src = readFileSync(new URL('./i18n.js', import.meta.url), 'utf8')
    const body = src.slice(src.indexOf('const EN = {'))
    const keys = [...body.matchAll(/^ {2}'((?:[^'\\]|\\.)*)':/gm)].map(m => m[1])
    const seen = new Set()
    const dups = keys.filter(k => (seen.has(k) ? true : (seen.add(k), false)))
    expect(dups).toEqual([])
    expect(keys.length).toBe(Object.keys(en).length)
  })

  it('conserva los marcadores de interpolación de la clave', () => {
    const broken = Object.entries(en).filter(([k, v]) => {
      const vars = [...k.matchAll(/\{(\w+)\}/g)].map(m => m[1])
      return vars.some(name => !v.includes(`{${name}}`))
    })
    expect(broken).toEqual([])
  })
})
