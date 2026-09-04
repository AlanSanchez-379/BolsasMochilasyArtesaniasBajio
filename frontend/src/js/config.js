export const SUPABASE_URL = "https://rfgdinrcqbgzhrwdhdbt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gDPgAKgsqJlGsxfu7CSAJg_WcpuvpgM";

// No hay bundler/paso de build con variables de entorno, así que decidimos según el
// dominio desde el que se sirve el sitio: localhost/127.0.0.1 durante desarrollo, lo
// real en producción.
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

// La llave pública de Stripe tiene que ser del mismo modo (prueba/en vivo) que
// STRIPE_SECRET_KEY del backend con el que esté hablando -- localhost sigue usando la
// de prueba (empareja con el backend local, que también sigue en modo prueba) y
// producción usa la real.
const STRIPE_TEST_PUBLISHABLE_KEY =
  "pk_test_51U5ytCA6pDb3iMij1Fz25J70RDA7B9xNQzbh94F4SkVv1qPBVsmQg5Pm6RKLBzixjxJEKE8N29Gb1Wrpx4CwL1J100TgOEEO7C";
const STRIPE_LIVE_PUBLISHABLE_KEY =
  "pk_live_51U6OHcJnateLYVac6jkSCI2KwEeoOOM0pxsecHr7e0exi6ZLNV41x7POu61PhS5IEkc0BNWgGfao6jy0c7ij6aTI00bd5jRGCC";
export const STRIPE_PUBLISHABLE_KEY = isLocalDev ? STRIPE_TEST_PUBLISHABLE_KEY : STRIPE_LIVE_PUBLISHABLE_KEY;

const PRODUCTION_API_BASE = "https://bolsasmochilasyartesaniasbajio.onrender.com/api";

// localhost y 127.0.0.1 son orígenes distintos para las cookies (SameSite=Lax no viaja
// entre ellos aunque sea la misma máquina) — usar el mismo hostname con el que se cargó
// el frontend evita que la sesión "se pierda" según por cuál entraste al navegador.
export const API_BASE = isLocalDev ? `http://${window.location.hostname}:5000/api` : PRODUCTION_API_BASE;
