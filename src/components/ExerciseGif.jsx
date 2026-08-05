import { useState } from 'react'

/*
 * La animación de un ejercicio.
 *
 * Dos reglas que no son de estilo:
 *
 * 1. Solo se muestra si `media_reviewed`. El emparejamiento entre la librería y
 *    ExerciseDB se hizo por parecido de nombre, y ahí "dumbbell rear fly" se
 *    cuela como aperturas de pecho. Una animación equivocada enseña mal el
 *    movimiento, que es peor que no enseñar nada, así que la puerta es que una
 *    persona lo haya confirmado. Sin ese visto bueno, esto no pinta nada.
 *
 * 2. Fondo blanco en los dos temas. Los gifs vienen sobre blanco y con la
 *    musculatura marcada en rojo; invertirlos en modo oscuro para que "peguen"
 *    rompería justo ese rojo, que es la información. Se recorta con esquinas
 *    redondeadas para que se lea como una lámina y no como un fallo de tema.
 *
 * `exercise` es la fila de la librería (o una fila de usuario con `library`
 * unido). Si no hay animación aprobada devuelve null: quien lo use no tiene
 * que comprobar nada antes.
 */
export default function ExerciseGif({ exercise, size = 184, rounded = 12, style }) {
  const [failed, setFailed] = useState(false)
  // El fondo blanco no puede pintarse antes que la imagen: con `loading="lazy"`
  // la miniatura tarda, y hasta entonces el hueco era un cuadrado blanco sobre
  // la superficie clara — se leía como un fallo de carga permanente. Hasta que
  // carga es transparente y deja ver el hueco de quien lo contiene.
  const [loaded, setLoaded] = useState(false)
  const lib = exercise?.library || exercise?.exercises_library || exercise
  if (!lib?.gif_url || !lib?.media_reviewed || failed) return null

  return (
    <img
      src={lib.gif_url}
      alt=""
      // Decorativa: el nombre del ejercicio ya está al lado, y describir una
      // animación de un lift en alt no aporta a quien usa lector de pantalla.
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      style={{
        width: size, height: size,
        flexShrink: 0,
        objectFit: 'contain',
        // Blanco literal y no un token, a propósito: los GIF de la biblioteca
        // vienen con el fondo blanco quemado en el propio archivo. Si esto
        // siguiera al tema, en modo oscuro se vería un recuadro blanco flotando
        // dentro de otro. Es el fondo de la imagen, no del cromo.
        background: loaded ? '#fff' : 'transparent',
        borderRadius: rounded,
        border: loaded ? '1px solid var(--c-border-subtle)' : 'none',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 160ms var(--ease-out)',
        ...style,
      }}
    />
  )
}
