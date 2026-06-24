/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        paid: '#16a34a',
        due: '#dc2626',
      },
    },
  },
  plugins: [],
};
