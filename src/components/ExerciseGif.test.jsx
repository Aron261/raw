// @vitest-environment jsdom
// La puerta de ExerciseGif es lo único que impide enseñar el movimiento
// equivocado. El emparejamiento con ExerciseDB se hizo por parecido de nombre,
// y sin `media_reviewed` a «Aperturas con mancuernas» le tocaba un "dumbbell
// rear fly": misma familia de palabras, otro músculo. De ahí que se pruebe que
// no pinta nada mientras nadie lo haya confirmado.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import ExerciseGif from './ExerciseGif'

afterEach(cleanup)

const gif = 'https://static.exercisedb.dev/media/abc.gif'
const img = (c) => c.container.querySelector('img')

describe('ExerciseGif', () => {
  it('pinta la animación aprobada', () => {
    const c = render(<ExerciseGif exercise={{ gif_url: gif, media_reviewed: true }} />)
    expect(img(c)).toBeTruthy()
    expect(img(c).getAttribute('src')).toBe(gif)
  })

  it('no pinta nada si nadie la ha revisado', () => {
    const c = render(<ExerciseGif exercise={{ gif_url: gif, media_reviewed: false }} />)
    expect(img(c)).toBeNull()
  })

  it('no pinta nada si no hay animación', () => {
    const c = render(<ExerciseGif exercise={{ gif_url: null, media_reviewed: true }} />)
    expect(img(c)).toBeNull()
  })

  it('aguanta un ejercicio sin ficha de librería', () => {
    expect(img(render(<ExerciseGif exercise={null} />))).toBeNull()
    expect(img(render(<ExerciseGif exercise={{ name: 'Custom' }} />))).toBeNull()
  })

  // Las filas de entreno traen la librería unida como `library`; las de la
  // propia librería vienen planas. Los dos casos llegan al mismo componente.
  it('lee la ficha unida como `library`', () => {
    const c = render(<ExerciseGif exercise={{ name: 'X', library: { gif_url: gif, media_reviewed: true } }} />)
    expect(img(c)).toBeTruthy()
  })

  it('es decorativa: no anuncia nada al lector de pantalla', () => {
    const c = render(<ExerciseGif exercise={{ gif_url: gif, media_reviewed: true }} />)
    expect(img(c).getAttribute('aria-hidden')).toBe('true')
    expect(img(c).getAttribute('alt')).toBe('')
  })

  it('se retira si la imagen no carga, en vez de dejar el hueco roto', () => {
    const c = render(<ExerciseGif exercise={{ gif_url: gif, media_reviewed: true }} />)
    fireEvent.error(img(c))
    expect(img(c)).toBeNull()
  })
})
