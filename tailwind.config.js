/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./popup.html",
    "./options.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#E2F5B6',
          50: '#f7fce8',
          100: '#E2F5B6',
          200: '#d4ebb0',
          300: '#c5e09a',
        },
        brand: {
          50: '#eef5f0',
          100: '#dce9df',
          200: '#b8d3bf',
          300: '#8fb59a',
          400: '#6a9477',
          500: '#4f7359',
          600: '#37523E',
          700: '#2d4333',
          800: '#243528',
          900: '#1c291f',
          950: '#121a15',
        },
        dark: {
          50: '#f7fce8',
          100: '#E2F5B6',
          200: '#dce9df',
          300: '#b8d3bf',
          400: '#8fb59a',
          500: '#6a9477',
          600: '#4f7359',
          700: '#37523E',
          800: '#2d4333',
          900: '#eef5f0',
          950: '#E2F5B6',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};
