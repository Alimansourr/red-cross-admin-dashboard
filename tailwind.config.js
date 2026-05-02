/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'redcross': {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#c8102e',  // Red Cross brand red
          600: '#a30e26',
          700: '#7a0a1c',
        }
      }
    },
  },
  plugins: [],
}