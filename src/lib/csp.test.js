import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/*
 * El script de arranque de index.html va inline (tiene que correr antes del
 * primer pintado para que no haya destello de tema), y el CSP de vercel.json
 * lo autoriza por hash. Si alguien toca el script y no recalcula el hash, el
 * navegador lo bloquea —pero solo en producción, porque el servidor de
 * desarrollo no aplica las cabeceras de vercel.json.
 *
 * Resultado: build verde, tests verdes, todo bien en local, y la app en vivo
 * arrancando sin resolver el tema. Ya pasó una vez en el rediseño.
 */
const root = new URL('../..', import.meta.url).pathname

describe('CSP', () => {
  it('el hash de vercel.json corresponde al script inline de index.html', () => {
    const html = readFileSync(`${root}/index.html`, 'utf8')
    const vercel = readFileSync(`${root}/vercel.json`, 'utf8')

    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    expect(scripts, 'se esperaba exactamente un script inline en index.html').toHaveLength(1)

    const actual = createHash('sha256').update(scripts[0], 'utf8').digest('base64')
    const allowed = [...vercel.matchAll(/'sha256-([^']+)'/g)].map(m => m[1])

    expect(
      allowed,
      `El script inline hashea a sha256-${actual}. Actualiza script-src en vercel.json.`,
    ).toContain(actual)
  })
})
