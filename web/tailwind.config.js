/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef7f2', 100: '#d6ecdf', 200: '#acd8c0', 500: '#2b8a62', 600: '#1f6f50', 700: '#185a41', 900: '#0d3324' },
        accent: { 500: '#e0892b', 600: '#c4721a' },
        ink: { 500: '#5b6670', 700: '#2f3a43', 900: '#162028' },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
