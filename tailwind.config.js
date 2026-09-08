/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mexdesk: {
          red: '#E52E2E',         // Iconic AnyDesk primary red
          crimson: '#D01919',     // Deeper red on hover
          darkred: '#9B1111',     // Dark red active
          lightred: '#FFF1F1',    // Subtle red background
          softred: '#FEE2E2',     // Red badge background
          border: '#E2E8F0',
          dark: '#1E293B',
          darker: '#0F172A',
          gray: '#F8FAFC',
          muted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        floating: '0 10px 30px -5px rgba(0, 0, 0, 0.15)',
        redglow: '0 0 20px rgba(229, 46, 46, 0.3)',
      }
    },
  },
  plugins: [],
}
