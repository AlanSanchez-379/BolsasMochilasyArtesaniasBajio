import { api } from "../api.js";
import { setCurrentUser } from "../state.js";
import { navigate, currentRenderToken } from "../router.js";
import { supabase } from "../supabaseClient.js";

export async function renderAuthCallback(container) {
  const token = currentRenderToken();
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-gray-400">Completando inicio de sesión...</div>`;

  // Supabase manda el "code" del flujo PKCE como query string real de la URL (antes
  // del #), no dentro del hash -- el router de la SPA solo sabe leer query params
  // que vienen DESPUÉS del hash, así que aquí hay que leer window.location.search
  // directo en vez del `query` que arma el router.
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-red-500">Falta el código de autenticación.</p>`;
    return;
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    const { user } = await api.oauthCallback(data.session.access_token);
    setCurrentUser(user);
    if (token !== currentRenderToken()) return;
    navigate("/");
  } catch (err) {
    if (token !== currentRenderToken()) return;
    container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-red-500">No se pudo iniciar sesión: ${err.message}</p>`;
  }
}
