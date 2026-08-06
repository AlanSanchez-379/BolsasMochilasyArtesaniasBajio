import { api } from "../api.js";
import { setCurrentUser } from "../state.js";
import { navigate, currentRenderToken } from "../router.js";
import { supabase } from "../supabaseClient.js";

export async function renderAuthCallback(container, query) {
  const token = currentRenderToken();
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-24 text-center text-xl text-gray-400">Completando inicio de sesión...</div>`;

  const code = query.get("code");
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
