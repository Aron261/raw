/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#111111',
        'surface-2': '#1A1A1A',
        'surface-3': '#222222',
        border: '#2A2A2A',
        'border-subtle': '#1E1E1E',
        'text-primary': '#FFFFFF',
        'text-muted': '#666666',
        'text-dim': '#444444',
        'accent-red': '#FF2D2D',
        'accent-red-dim': 'rgba(255,45,45,0.12)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.025em',
        tighter: '-0.05em',
      },
      borderRadius: {
        sm: '3px',
      },
    },
  },
  plugins: [],
}
