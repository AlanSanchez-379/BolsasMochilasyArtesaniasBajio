/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        "brand-salmon": "var(--color-brand-salmon, #FE81D4)",
        "brand-blue-dark": "var(--color-brand-blue-dark, #FE81D4)",
        "brand-blue": "var(--color-brand-blue, #FAACBF)",
        "brand-cream": "var(--color-brand-cream, #FFEABB)",
        "brand-teal": "var(--color-brand-teal, #FBC3C1)",
        "text-dark": "var(--color-text-dark, #333333)",
        "brand-pink": "var(--color-brand-pink, #FE81D4)",
        "brand-pink-hover": "var(--color-brand-pink-hover, #FAACBF)",
        "brand-pink-light": "var(--color-brand-pink-light, #FBC3C1)",
        "brand-peach-light": "var(--color-brand-peach-light, #FFEABB)",
        "brand-mexican": "var(--color-brand-mexican, #E4007C)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.8s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};
