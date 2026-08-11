export const SUPABASE_URL = "https://rfgdinrcqbgzhrwdhdbt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gDPgAKgsqJlGsxfu7CSAJg_WcpuvpgM";

// No hay bundler/paso de build con variables de entorno, así que decidimos la URL del
// backend según el dominio desde el que se sirve el sitio: localhost/127.0.0.1 durante
// desarrollo, el backend real en producción.
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const PRODUCTION_API_BASE = "https://bolsasmochilasyartesaniasbajio.onrender.com/api";

export const API_BASE = isLocalDev ? "http://127.0.0.1:5000/api" : PRODUCTION_API_BASE;
