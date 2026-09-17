/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        online: '#16A34A',        // Green online / success
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
          online: '#16A34A',
        },
        aegis: {
          red: '#4F46E5',         // Primary indigo (swapped from red)
          crimson: '#4338CA',     // Hover indigo
          darkred: '#3730A3',     // Active deep indigo
          lightred: '#EEF2FF',    // Indigo tint
          softred: '#E0E7FF',     // Soft indigo
          border: '#334155',
          dark: '#1E293B',
          darker: '#0F172A',
          gray: '#0F172A',
          muted: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.25), 0 2px 6px -1px rgba(0, 0, 0, 0.15)',
        floating: '0 10px 30px -5px rgba(0, 0, 0, 0.35)',
        indigoglow: '0 0 20px rgba(79, 70, 229, 0.35)',
      }
    },
  },
  plugins: [],
}
