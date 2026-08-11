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
        // Alias con los nombres del maquetado adoptado (mismos valores que arriba)
        "brand-pink": "#FE81D4",
        "brand-pink-hover": "#FAACBF",
        "brand-pink-light": "#FBC3C1",
        "brand-peach-light": "#FFEABB",
        "brand-mexican": "#E4007C", // acento (hovers, CTAs)
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
