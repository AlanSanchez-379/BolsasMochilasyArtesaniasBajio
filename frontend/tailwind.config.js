/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        // Paleta de marca (agosto 2026): principal / hover / fondos suaves / bordes y detalles.
        "brand-salmon": "#FE81D4", // principal (botones, iconos)
        "brand-blue-dark": "#FE81D4", // principal (botones, iconos)
        "brand-blue": "#FAACBF", // hover
        "brand-cream": "#FFEABB", // fondos suaves
        "brand-teal": "#FBC3C1", // bordes y detalles
        "text-dark": "#333333",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
