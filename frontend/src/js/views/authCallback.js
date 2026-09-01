import { api } from "../api.js";
import { setCurrentUser } from "../state.js";
import { navigate, currentRenderToken } from "../router.js";
import { supabase } from "../supabaseClient.js";

// La confirmación de correo (registro) manda el access_token directo en el hash,
// pegado después de nuestro propio hash-route: "/#/auth/callback#access_token=...&...".
// Es el flujo implícito de Supabase, no PKCE -- no hay "code" que intercambiar, el
// token ya viene listo para usarse.
function extractImplicitAccessToken() {
  const hash = window.location.hash;
  const secondHash = hash.indexOf("#", 1);
  if (secondHash === -1) return null;
  return new URLSearchParams(hash.slice(secondHash + 1)).get("access_token");
}

export async function renderAuthCallback(container) {
  const token = currentRenderToken();
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-gray-400">Completando inicio de sesión...</div>`;

  async function finishLogin(accessToken) {
    const { user } = await api.oauthCallback(accessToken);
    setCurrentUser(user);
    if (token !== currentRenderToken()) return;
    navigate("/");
  }

  const implicitAccessToken = extractImplicitAccessToken();
  if (implicitAccessToken) {
    try {
      await finishLogin(implicitAccessToken);
    } catch (err) {
      if (token !== currentRenderToken()) return;
      container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-red-500">No se pudo iniciar sesión: ${err.message}</p>`;
    }
    return;
  }

  // Google (u otro proveedor OAuth) usa PKCE: el "code" viaja en el query string real
  // de la URL (antes del #), no dentro del hash -- el router de la SPA solo sabe leer
  // query params que vienen DESPUÉS del hash, así que aquí hay que leer
  // window.location.search directo en vez del `query` que arma el router.
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-red-500">Falta el código de autenticación.</p>`;
    return;
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    await finishLogin(data.session.access_token);
  } catch (err) {
    if (token !== currentRenderToken()) return;
    container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-red-500">No se pudo iniciar sesión: ${err.message}</p>`;
  }
}
