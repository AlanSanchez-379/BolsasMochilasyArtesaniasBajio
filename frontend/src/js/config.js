export const SUPABASE_URL = "https://rfgdinrcqbgzhrwdhdbt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gDPgAKgsqJlGsxfu7CSAJg_WcpuvpgM";

// No hay bundler/paso de build con variables de entorno, así que decidimos según el
// dominio desde el que se sirve el sitio: localhost/127.0.0.1 durante desarrollo, lo
// real en producción.
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const PRODUCTION_API_BASE = "https://bolsasmochilasyartesaniasbajio.onrender.com/api";

// localhost y 127.0.0.1 son orígenes distintos para las cookies (SameSite=Lax no viaja
// entre ellos aunque sea la misma máquina) — usar el mismo hostname con el que se cargó
// el frontend evita que la sesión "se pierda" según por cuál entraste al navegador.
export const API_BASE = isLocalDev ? `http://${window.location.hostname}:5000/api` : PRODUCTION_API_BASE;
