/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
