/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Google Stitch Precision Design Tokens
        surface: '#0f131c',
        'surface-dim': '#0f131c',
        'surface-bright': '#353943',
        'surface-container-lowest': '#0a0e17',
        'surface-container-low': '#181b25',
        'surface-container': '#1c1f29',
        'surface-container-high': '#262a34',
        'surface-container-highest': '#31353f',
        'on-surface': '#dfe2ef',
        'on-surface-variant': '#94a3b8',
        'primary-container': '#dc2626',
        'on-primary-container': '#fff6f5',
        'inverse-primary': '#bf0715',
        secondary: '#4edea3',
        'secondary-container': '#00a572',
        'on-secondary-container': '#00311f',
        tertiary: '#bec6e0',
        'tertiary-container': '#6a7188',
        outline: '#475569',
        error: '#ef4444',
        'error-container': '#93000a',

        // Legacy & Brand Aliases
        primary: {
          DEFAULT: '#4F46E5',     // Indigo primary
          hover: '#4338CA',       // Hover / active indigo
          card: '#818CF8',        // Address card / periwinkle indigo
          tint: '#EEF2FF',        // Chips / light tint
          light: '#6366F1',
        },
        destructive: {
          DEFAULT: '#EF4444',     // Reserved exclusively for delete / disconnect
          hover: '#DC2626',
          bg: '#3B1E28',
          border: '#7F1D1D',
        },
        online: '#10B981',        // Green online / success
        mexdesk: {
          primary: '#4F46E5',
          hover: '#4338CA',
          card: '#818CF8',
          tint: '#EEF2FF',
          dark: '#1E293B',
          darker: '#0F172A',
          darkest: '#0B1120',
          border: '#334155',
          destructive: '#EF4444',
          online: '#10B981',
        },
        aegis: {
          red: '#DC2626',         // Aegis Red
          crimson: '#B91C1C',     // Hover Red
          darkred: '#991B1B',     // Active deep red
          lightred: '#FEE2E2',    // Red tint
          softred: '#FEF2F2',     // Soft red
          border: '#334155',
          dark: '#1E293B',
          darker: '#0F172A',
          gray: '#0A0E17',
          muted: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.25)',
        floating: '0 10px 30px -5px rgba(0, 0, 0, 0.65)',
        indigoglow: '0 0 20px rgba(79, 70, 229, 0.35)',
      }
    },
  },
  plugins: [],
}
