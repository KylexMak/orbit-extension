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
          bg: '#1a1a2e', // Deep blue/purple background
          primary: '#a78bfa', // Soft purple
          secondary: '#60a5fa', // Soft blue
          accent: '#c084fc', // Bright purple accent
          text: '#f3f4f6', // Off-white text
          muted: '#9ca3af', // Gray text
          card: '#1f2937', // Dark card background
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
