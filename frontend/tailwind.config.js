/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        "brand-salmon": "#FFB6A6",
        "brand-cream": "#FFEBD3",
        "brand-teal": "#9BCEC1",
        "brand-blue": "#67A2C5",
        "brand-blue-dark": "#4A85A8",
        "text-dark": "#333333",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
