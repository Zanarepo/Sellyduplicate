/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      animation: {
        moveStars: 'moveStars 60s linear infinite',
      },
      keyframes: {
        moveStars: {
          '0%': {
            backgroundPosition: '0 0',
          },
          '100%': {
            backgroundPosition: '1000px 1000px',
          },
        },
      },
    },
  },
  plugins: [],
};
