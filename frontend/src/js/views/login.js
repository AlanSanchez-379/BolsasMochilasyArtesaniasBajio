import { api } from "../api.js";
import { setCurrentUser } from "../state.js";
import { navigate } from "../router.js";
import { supabase } from "../supabaseClient.js";

export function renderLogin(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-16 fade-in">
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h1 class="text-3xl font-bold mb-6 text-center">Iniciar Sesión</h1>

        <button id="google-btn" class="w-full flex items-center justify-center gap-3 border-2 border-gray-200 rounded-full py-3 font-semibold text-gray-700 hover:bg-gray-50">
          <i class="fa-brands fa-google text-brand-salmon"></i> Continuar con Google
        </button>
        <p class="text-center text-xs text-gray-400 mt-2 mb-6">
          Al continuar aceptas nuestros <a href="/terminos-y-condiciones" target="_blank" class="text-brand-mexican hover:underline">Términos y Condiciones</a>
          y <a href="/politica-privacidad" target="_blank" class="text-brand-mexican hover:underline">Política de Privacidad</a>.
        </p>

        <div class="flex items-center gap-3 mb-6">
          <div class="flex-grow h-px bg-gray-200"></div>
          <span class="text-gray-400 text-sm">o con tu correo</span>
          <div class="flex-grow h-px bg-gray-200"></div>
        </div>

        <form id="login-form" class="space-y-4">
          <div>
            <label for="login-email" class="block text-sm font-bold text-gray-700 mb-1">Correo</label>
            <input id="login-email" type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label for="login-password" class="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input id="login-password" type="password" name="password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <p id="login-error" class="text-red-500 text-sm hidden"></p>
          <button type="submit" class="w-full bg-brand-blue-dark text-white py-3 rounded-full text-lg font-semibold hover:bg-brand-blue">
            Ingresar
          </button>
        </form>

        <p class="text-center mt-4">
          <button id="forgot-password-btn" class="text-sm text-gray-500 hover:text-brand-blue-dark hover:underline">¿Olvidaste tu contraseña?</button>
        </p>

        <p class="text-center text-gray-500 mt-6">
          ¿No tienes cuenta? <button data-nav="/registro" class="text-brand-blue-dark font-semibold hover:underline">Regístrate</button>
        </p>
      </div>
    </div>
  `;

  container.querySelector('[data-nav="/registro"]').addEventListener("click", () => navigate("/registro"));

  container.querySelector("#google-btn").addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/#/auth/callback` },
    });
  });

  const form = container.querySelector("#login-form");
  const errorEl = container.querySelector("#login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    const formData = new FormData(form);
    try {
      const { user } = await api.login(formData.get("email"), formData.get("password"));
      setCurrentUser(user);
      navigate("/");
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

  container.querySelector("#forgot-password-btn").addEventListener("click", async () => {
    const emailInput = container.querySelector("#login-email").value.trim();
    if (!emailInput) {
      errorEl.textContent = "Por favor, ingresa tu correo primero para recuperar tu contraseña.";
      errorEl.classList.remove("hidden");
      return;
    }
    
    const btn = container.querySelector("#forgot-password-btn");
    btn.disabled = true;
    errorEl.classList.add("hidden");
    
    try {
      const res = await api.resetPassword(emailInput);
      errorEl.textContent = res.message || "Se ha enviado un enlace de recuperación a tu correo.";
      errorEl.classList.remove("text-red-500");
      errorEl.classList.add("text-emerald-600");
      errorEl.classList.remove("hidden");
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("text-emerald-600");
      errorEl.classList.add("text-red-500");
      errorEl.classList.remove("hidden");
    } finally {
      btn.disabled = false;
    }
  });
}
