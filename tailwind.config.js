/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          bg: '#f0f4f8',       // Soft blue-gray background
          primary: '#7c3aed',  // Purple (header accent)
          secondary: '#3b82f6', // Calming blue
          accent: '#6366f1',   // Indigo
          text: '#1e293b',     // Dark slate text
          muted: '#94a3b8',    // Muted slate
          card: '#ffffff',     // White cards
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
