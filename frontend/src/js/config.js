export const SUPABASE_URL = "https://rfgdinrcqbgzhrwdhdbt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gDPgAKgsqJlGsxfu7CSAJg_WcpuvpgM";

export const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51U5ytCA6pDb3iMij1Fz25J70RDA7B9xNQzbh94F4SkVv1qPBVsmQg5Pm6RKLBzixjxJEKE8N29Gb1Wrpx4CwL1J100TgOEEO7C";

// No hay bundler/paso de build con variables de entorno, así que decidimos la URL del
// backend según el dominio desde el que se sirve el sitio: localhost/127.0.0.1 durante
// desarrollo, el backend real en producción.
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const PRODUCTION_API_BASE = "https://bolsasmochilasyartesaniasbajio.onrender.com/api";

export const API_BASE = isLocalDev ? "http://127.0.0.1:5000/api" : PRODUCTION_API_BASE;
