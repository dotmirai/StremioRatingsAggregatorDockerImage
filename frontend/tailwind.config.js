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
          DEFAULT: '#00C6FF',
          dark: '#0072FF',
        },
        secondary: {
          DEFAULT: '#FF6B6B',
          dark: '#556270',
        },
      },
      animation: {
        'float': 'floating 3s ease-in-out infinite',
        'pulse-slow': 'pulse 2s infinite',
      },
      keyframes: {
        floating: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
      },
    },
  },
  plugins: [],
}