/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colors reference the CSS variables in index.css so Tailwind classes and
      // inline var() styles share ONE source of truth and theme together.
      colors: {
        background:       'var(--c-bg)',
        surface:          'var(--c-surface)',
        'surface-2':      'var(--c-surface-2)',
        'surface-3':      'var(--c-surface-3)',
        border:           'var(--c-border)',
        'border-subtle':  'var(--c-border-subtle)',
        'text-primary':   'var(--c-text)',
        'text-secondary': 'var(--c-text-secondary)',
        'text-muted':     'var(--c-text-muted)',
        'text-dim':       'var(--c-text-dim)',
        'text-ghost':     'var(--c-text-ghost)',
        action:           'var(--c-action)',
        'action-dim':     'var(--c-action-dim)',
        data:             'var(--c-data)',
        record:           'var(--c-record)',
        // Legacy aliases — accent maps to the action (pink)
        'accent-red':     'var(--c-accent)',
        'accent-red-dim': 'var(--c-accent-dim)',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight:  '-0.025em',
        tighter: '-0.05em',
      },
      // Misma fuente de verdad que los tokens de index.css.
      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
      },
      boxShadow: {
        e1: 'var(--e-1)',
        e2: 'var(--e-2)',
        e3: 'var(--e-3)',
      },
    },
  },
  plugins: [],
}
