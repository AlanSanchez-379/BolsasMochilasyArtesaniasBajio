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
    // PKCE necesita guardar un "code verifier" en localStorage antes de mandar al
    // usuario a Google, para leerlo de vuelta al regresar (navegación de página
    // completa, no sobrevive en memoria). persistSession:false rompía justo eso. La
    // sesión de supabase-js que queda en localStorage después no se vuelve a usar —
    // la app maneja su propia sesión vía cookie de Flask (api.oauthCallback).
  },
});
