import { motion, useReducedMotion } from 'motion/react'
import { SPRING_PRESS } from '../../lib/motion'

/*
 * La superficie de contenido de Raw.
 *
 * En el sistema anterior una tarjeta se separaba del fondo con un filete de
 * 1px y nada más ("etched, never floated"). En "Cuerpo" la jerarquía la
 * lleva la elevación: la tarjeta se apoya sobre el hueso y, si además se
 * puede tocar, sube con el puntero y cede al pulsarla.
 *
 *   raised    una superficie que reclama atención sin ser accionable
 *   tappable  la tarjeta ES el control: añade resorte de pulsación
 *   accent    el bloque teñido del azul de acción (la tarjeta de "hoy")
 */
export default function Card({
  as: Tag = 'div',
  accent = false,
  raised = false,
  tappable = false,
  className = '',
  style,
  children,
  ...rest
}) {
  const reduce = useReducedMotion()
  // motion[tag] pasa por el proxy, que cachea el componente. Construirlo con
  // motion.create() aquí devolvería un tipo nuevo en cada render y React
  // remontaría la tarjeta entera —perdiendo foco y estado— en cada pasada.
  const Comp = tappable ? (motion[Tag] || motion.div) : Tag

  const motionProps = tappable && !reduce
    ? { whileTap: { scale: 0.985 }, transition: SPRING_PRESS }
    : {}

  return (
    <Comp
      className={[
        'material',
        raised || accent ? 'material-raised' : '',
        tappable ? 'material-tappable' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        background: accent ? 'var(--c-action)' : 'var(--c-surface)',
        color: accent ? 'var(--c-on-action)' : 'var(--c-text)',
        borderColor: accent ? 'transparent' : 'var(--c-border-subtle)',
        padding: '18px',
        ...style,
      }}
      {...motionProps}
      {...rest}
    >
      {children}
    </Comp>
  )
}
