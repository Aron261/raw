import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_PRESS } from '../../lib/motion'

// The single button primitive for Raw. Token-driven, theme-aware, spring
// press-scale + focus-ring built in. Variants map to the design-system roles.
const VARIANTS = {
  primary:   { background: 'var(--c-action)',  color: 'var(--c-on-action)', border: '1px solid transparent' },
  secondary: { background: 'var(--c-surface-2)', color: 'var(--c-text)',     border: '1px solid var(--c-border)' },
  ghost:     { background: 'transparent',       color: 'var(--c-text-muted)', border: '1px solid transparent' },
  danger:    { background: 'transparent',       color: 'var(--c-action-text)', border: '1px solid var(--c-action-border)' },
}

// Más aire que antes: en "Cuerpo" un control es una cosa que se toca, y el
// área táctil forma parte de cómo se siente. lg queda en 52px de alto.
//
// El minHeight no es redundante con el padding: `md` salía en 43px —un píxel
// por debajo del mínimo que la propia app se exige— y `sm` en 34px, porque el
// alto lo decidían el texto y el relleno, que se eligen por estética. Aquí el
// suelo se declara aparte para que ninguna combinación futura de tamaño de
// letra vuelva a bajarlo sin que nadie se entere.
const SIZES = {
  sm: { padding: '10px 16px', fontSize: '12px', borderRadius: 'var(--r-sm)', minHeight: '44px' },
  md: { padding: '14px 18px', fontSize: '13px', borderRadius: 'var(--r-md)', minHeight: '44px' },
  lg: { padding: '18px',      fontSize: '15px', borderRadius: 'var(--r-lg)', minHeight: '52px' },
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', full = false, loading = false, disabled = false,
    leftIcon = null, children, style, ...rest },
  ref,
) {
  const reduce = useReducedMotion()
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md
  const isOff = disabled || loading

  return (
    <motion.button
      ref={ref}
      disabled={isOff}
      whileTap={isOff || reduce ? undefined : { scale: 0.975 }}
      transition={SPRING_PRESS}
      style={{
        ...v, ...s,
        width: full ? '100%' : undefined,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        fontFamily: 'var(--font-sans)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1,
        // El primario tiene cuerpo: sube un paso sobre la superficie en la que
        // se apoya. Los demás son planos a propósito — si todo flota, nada flota.
        boxShadow: variant === 'primary' && !isOff ? 'var(--e-1)' : 'none',
        cursor: isOff ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 160ms var(--ease-out), box-shadow 200ms var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {loading
        ? <span className="spinner" style={{ borderTopColor: 'currentColor', borderColor: 'rgba(127,127,127,0.25)' }} />
        : leftIcon}
      {children}
    </motion.button>
  )
})

export default Button
