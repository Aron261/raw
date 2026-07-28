// Guardia contra un fallo que ya ha aparecido tres veces al traducir pantallas.
//
// `t` viene de un hook, así que solo existe dentro del componente que lo llama.
// Meter un t('...') en un subcomponente —o en el componente principal, cuando
// solo se lo pusiste a los hijos— compila igual y revienta en tiempo de
// ejecución con "t is not defined", pero solo en la pantalla afectada: el
// calendario en vista semana, la portada de Perfil, ActiveWorkout. Un build
// verde no dice nada de esto.
//
// Esta prueba lee el código y comprueba que todo componente que llama a t()
// lo tiene en su ámbito: o llama a useLang(), o lo recibe por props.
//
// El patrón tiene que cubrir `export function X()` además de `function X()` y
// `export default function X()`: al traducir Coach se coló justo por ahí
// (BuildRoutineModal), y el guard no lo vio.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('..', import.meta.url).pathname
const CALL = /(?<![A-Za-z0-9_$.])t\('/

function jsxFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return jsxFiles(full)
    return name.endsWith('.jsx') && !name.includes('.test.') ? [full] : []
  })
}

describe('t() siempre está en ámbito', () => {
  it('ningún componente llama a t() sin tenerlo', () => {
    const offenders = []
    for (const file of jsxFiles(SRC)) {
      const src = readFileSync(file, 'utf8')
      if (!CALL.test(src)) continue
      const heads = [...src.matchAll(/^(?:export (?:default )?)?function (\w+)\(([^)]*)\)/gm)]
      heads.forEach((h, i) => {
        const start = h.index
        const end = i + 1 < heads.length ? heads[i + 1].index : src.length
        const body = src.slice(start, end)
        if (!CALL.test(body)) return
        if (body.includes('useLang()')) return
        if (/(^|[({,\s])t([,}\s)]|$)/.test(h[2])) return   // lo recibe por props
        offenders.push(`${file.replace(SRC, '')}:${h[1]}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
