import { Children, cloneElement, isValidElement, useId } from 'react'
import Eyebrow from './Eyebrow'

// Labelled form field wrapper. Pair with the `.input-field` class (or any control)
// as children. `hint` renders muted helper text below.
//
// La etiqueta es un <label> de verdad, atado a su control.
//
// Antes era un <p> suelto encima del input: visualmente idéntico, pero para un
// lector de pantalla el campo no tenía nombre —decía "cuadro de edición" y ya—
// y tocar la etiqueta no enfocaba el campo. Había UN htmlFor en toda la app
// para unos sesenta y cinco controles.
//
// El id se genera aquí y se inyecta en el hijo, así que los veintiocho Field
// que ya existen quedan atados sin tocar ni uno. Un hijo que traiga su propio
// id manda: hay casos donde quien llama lo necesita para otra cosa.
export default function Field({ label, hint, children, style, htmlFor }) {
  const auto = useId()

  // Solo se inyecta si hay un único hijo elemento. Con varios —o con texto
  // suelto— no hay forma de saber cuál es el control, y adivinar sería peor.
  const solo = Children.count(children) === 1 ? Children.only(children) : null
  const puedeAtarse = isValidElement(solo)
  const id = htmlFor || (puedeAtarse ? (solo.props.id || auto) : null)

  const control = puedeAtarse && !solo.props.id && !htmlFor
    ? cloneElement(solo, { id })
    : children

  return (
    <div style={{ marginBottom: '12px', ...style }}>
      {label && (
        <Eyebrow as="label" htmlFor={id || undefined} style={{ marginBottom: '6px', display: 'block' }}>
          {label}
        </Eyebrow>
      )}
      {control}
      {hint && <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '4px', lineHeight: 1.4 }}>{hint}</p>}
    </div>
  )
}
