// Raw logo — a selectorized weight stack (one plate racked, the rest loaded).
// Theme + palette aware via tokens: selected plates take the action accent
// (steel in Slate, pink in Vibrante); the tile + sleeve track the surface.
export default function Logo({ size = 56, tile = true, ...rest }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label="Raw"
      {...rest}
    >
      {tile && <rect width="96" height="96" rx="22" fill="var(--c-surface)" stroke="var(--c-border-subtle)" />}
      <rect x="26" y="22" width="44" height="9" rx="4.5" fill="var(--c-text-ghost)" />
      <rect x="26" y="34" width="44" height="9" rx="4.5" fill="var(--c-action)" />
      <rect x="26" y="46" width="44" height="9" rx="4.5" fill="var(--c-action)" />
      <rect x="26" y="58" width="44" height="9" rx="4.5" fill="var(--c-action)" />
      <rect x="26" y="70" width="44" height="9" rx="4.5" fill="var(--c-action)" />
      <rect x="43" y="20" width="10" height="61" fill={tile ? 'var(--c-surface)' : 'var(--c-bg)'} />
      <circle cx="48" cy="38.5" r="4.2" fill="var(--c-text)" />
    </svg>
  )
}
