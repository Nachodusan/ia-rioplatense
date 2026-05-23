/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tinta — casi negro, para tipografía y elementos primarios
        ink: {
          50:  '#f6f7f9',
          100: '#eaecef',
          200: '#d2d6dc',
          300: '#a9b0ba',
          400: '#7a8290',
          500: '#535b6a',
          600: '#3a414f',
          700: '#262c38',
          800: '#171c26',
          900: '#0c1018',
          950: '#06090f',
        },
        // Off-white — fondos y superficies cálidas
        ivory: {
          50:  '#fdfcf9',
          100: '#faf8f2',
          200: '#f5f2e8',
          300: '#ece7d6',
        },
        // Azul eléctrico — color de acción
        signal: {
          50:  '#eff5ff',
          100: '#dbe7ff',
          200: '#bdd2ff',
          300: '#90b3ff',
          400: '#5e8aff',
          500: '#3a64ff',
          600: '#1f44f5',
          700: '#1932dd',
          800: '#1a2cb1',
          900: '#1c2c8a',
        },
        // Oro tenue — para tildes premium
        gold: {
          400: '#e2b770',
          500: '#cd9c52',
          600: '#a87932',
        },
        // Compat con clases viejas
        brand: {
          50:  '#eff5ff', 100: '#dbe7ff', 200: '#bdd2ff', 300: '#90b3ff', 400: '#5e8aff',
          500: '#3a64ff', 600: '#1f44f5', 700: '#1932dd', 800: '#1a2cb1', 900: '#1c2c8a',
        },
        accent: { 500: '#7c3aed', 600: '#6d28d9' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(12, 16, 24, 0.04), 0 8px 24px -6px rgba(12, 16, 24, 0.08)',
        ring: '0 0 0 1px rgba(12, 16, 24, 0.08), 0 1px 2px rgba(12, 16, 24, 0.04)',
        lift: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(12,16,24,0.05), 0 12px 32px -8px rgba(12,16,24,0.12)',
        glow: '0 0 0 4px rgba(58, 100, 255, 0.12)',
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
}
