/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:       'oklch(97% 0.006 255)',
        surface:          '#FFFFFF',
        'surface-2':      'oklch(95.5% 0.005 255)',
        'surface-3':      'oklch(93% 0.005 255)',
        border:           'oklch(85% 0.006 255)',
        'border-subtle':  'oklch(91% 0.005 255)',
        'text-primary':   'oklch(13% 0.005 255)',
        'text-muted':     'oklch(54% 0.005 255)',
        'text-dim':       'oklch(52% 0.005 255)',
        'accent-red':     '#FF2D2D',
        'accent-red-dim': 'rgba(255,45,45,0.08)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
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
