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
        display: ['Anton', 'Archivo', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight:  '-0.025em',
        tighter: '-0.05em',
      },
      borderRadius: {
        sm: '10px',
      },
    },
  },
  plugins: [],
}
