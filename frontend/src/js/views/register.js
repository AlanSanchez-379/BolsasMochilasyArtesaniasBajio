import { api } from "../api.js";
import { setCurrentUser } from "../state.js";
import { navigate } from "../router.js";
import { supabase } from "../supabaseClient.js";

export function renderRegister(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-16 fade-in">
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h1 class="text-3xl font-bold mb-6 text-center">Crear Cuenta</h1>

        <button id="google-btn" class="w-full flex items-center justify-center gap-3 border-2 border-gray-200 rounded-full py-3 font-semibold text-gray-700 hover:bg-gray-50">
          <i class="fa-brands fa-google text-brand-salmon"></i> Continuar con Google
        </button>
        <p class="text-center text-xs text-gray-400 mt-2 mb-6">
          Al continuar aceptas nuestros <a href="#/terminos-y-condiciones" target="_blank" class="text-brand-mexican hover:underline">Términos y Condiciones</a>
          y <a href="#/politica-privacidad" target="_blank" class="text-brand-mexican hover:underline">Política de Privacidad</a>.
        </p>

        <div class="flex items-center gap-3 mb-6">
          <div class="flex-grow h-px bg-gray-200"></div>
          <span class="text-gray-400 text-sm">o con tu correo</span>
          <div class="flex-grow h-px bg-gray-200"></div>
        </div>

        <form id="register-form" class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Nombre completo</label>
            <input type="text" name="full_name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Correo</label>
            <input type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input type="password" name="password" required minlength="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <label class="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" id="accept-terms" required class="mt-1 w-4 h-4 flex-shrink-0" />
            <span>
              He leído y acepto los <a href="#/terminos-y-condiciones" target="_blank" class="text-brand-blue-dark font-semibold hover:underline">Términos y Condiciones</a>
              y la <a href="#/politica-privacidad" target="_blank" class="text-brand-blue-dark font-semibold hover:underline">Política de Privacidad</a>.
            </span>
          </label>
          <p id="register-error" class="text-red-500 text-sm hidden"></p>
          <p id="register-success" class="text-brand-teal text-sm hidden"></p>
          <button type="submit" class="w-full bg-brand-blue-dark text-white py-3 rounded-full text-lg font-semibold hover:bg-brand-blue">
            Crear cuenta
          </button>
        </form>

        <p class="text-center text-gray-500 mt-6">
          ¿Ya tienes cuenta? <button data-nav="/login" class="text-brand-blue-dark font-semibold hover:underline">Inicia sesión</button>
        </p>
      </div>
    </div>
  `;

  container.querySelector('[data-nav="/login"]').addEventListener("click", () => navigate("/login"));

  container.querySelector("#google-btn").addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/#/auth/callback` },
    });
  });

  const form = container.querySelector("#register-form");
  const errorEl = container.querySelector("#register-error");
  const successEl = container.querySelector("#register-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");
    const formData = new FormData(form);
    try {
      const result = await api.register(formData.get("email"), formData.get("password"), formData.get("full_name"));
      if (result.user) {
        setCurrentUser(result.user);
        navigate("/");
      } else {
        successEl.textContent = result.message;
        successEl.classList.remove("hidden");
        form.reset();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}
