import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Usado únicamente para el handshake de Google OAuth (redirect + sesión en el navegador).
// El resto de la autenticación (email/password) va directo contra nuestra API Flask.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: "pkce",
    // Nuestro router usa # para rutas propias; desactivamos el auto-detect de
    // supabase-js para no chocar con él y manejamos el code exchange nosotros.
    detectSessionInUrl: false,
    persistSession: false,
  },
});
