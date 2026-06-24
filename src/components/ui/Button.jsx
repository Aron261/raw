import { forwardRef } from 'react'

// The single button primitive for Raw. Token-driven, theme-aware, press-scale
// + focus-ring built in. Variants map to the design-system roles.
const VARIANTS = {
  primary:   { background: 'var(--c-action)',  color: 'var(--c-on-action)', border: '1px solid transparent' },
  secondary: { background: 'var(--c-surface-2)', color: 'var(--c-text)',     border: '1px solid var(--c-border)' },
  ghost:     { background: 'transparent',       color: 'var(--c-text-muted)', border: '1px solid transparent' },
  danger:    { background: 'transparent',       color: 'var(--c-action-text)', border: '1px solid var(--c-action-border)' },
}

const SIZES = {
  sm: { padding: '8px 14px',  fontSize: '11px' },
  md: { padding: '12px 16px', fontSize: '13px' },
  lg: { padding: '16px',      fontSize: '14px' },
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', full = false, loading = false, disabled = false,
    leftIcon = null, children, style, onPointerDown, onPointerUp, onPointerLeave, ...rest },
  ref,
) {
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md
  const isOff = disabled || loading

  const press = (scale) => (e) => { if (!isOff) e.currentTarget.style.transform = `scale(${scale})` }

  return (
    <button
      ref={ref}
      disabled={isOff}
      style={{
        ...v, ...s,
        width: full ? '100%' : undefined,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        fontFamily: 'var(--font-sans)', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1,
        borderRadius: 'var(--r-md)',
        cursor: isOff ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'transform 160ms var(--ease-out), opacity 160ms var(--ease-out)',
        ...style,
      }}
      onPointerDown={(e) => { press(0.97)(e); onPointerDown?.(e) }}
      onPointerUp={(e) => { press(1)(e); onPointerUp?.(e) }}
      onPointerLeave={(e) => { press(1)(e); onPointerLeave?.(e) }}
      {...rest}
    >
      {loading
        ? <span className="spinner" style={{ borderTopColor: 'currentColor', borderColor: 'rgba(127,127,127,0.25)' }} />
        : leftIcon}
      {children}
    </button>
  )
})

export default Button
