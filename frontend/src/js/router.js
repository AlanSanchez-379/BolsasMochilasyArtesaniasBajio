import { readRouteLocation, isAppPath } from "./routeLocation.js";
import { resetRouteMetadata, setPageMetadata } from "./seo.js";
const routes = [];

// Guard contra condiciones de carrera: si el usuario navega antes de que una vista
// async termine de cargar datos, esa vista vieja no debe pisar el DOM de la nueva.
let renderToken = 0;

export function currentRenderToken() {
  return renderToken;
}

// Permite que componentes globales (ej. el footer) reaccionen a cambios de ruta sin
// que router.js tenga que conocerlos directamente.
const routeChangeListeners = [];

export function onRouteChange(fn) {
  routeChangeListeners.push(fn);
}

export function route(pattern, handler) {
  const paramNames = [];
  const regexBody = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment;
    })
    .join("/");
  routes.push({ regex: new RegExp(`^${regexBody}$`), paramNames, handler });
}

async function resolve() {
  const { path, query, migration } = readRouteLocation(window.location.href);
  if (migration) window.history.replaceState(null, "", migration);
  renderToken += 1;
  const token = renderToken;
  resetRouteMetadata(path, query);
  routeChangeListeners.forEach((fn) => fn(path));

  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      window.scrollTo(0, 0);
      try {
        await r.handler({ params, query });
      } catch (error) {
        console.error("No se pudo cargar la vista", error);
        if (token !== renderToken) return;
        document.getElementById("view").innerHTML = `
          <section role="alert" class="max-w-2xl mx-auto p-8 text-center">
            <h1 class="text-2xl font-bold mb-4">No pudimos cargar esta página</h1>
            <p class="mb-4">Revisa tu conexión e inténtalo de nuevo.</p>
            <button id="retry-view" class="bg-gray-900 text-white px-6 py-3 rounded">Reintentar</button>
            <a href="/categoria/Todos" class="block mt-4 underline">Volver al catálogo</a>
          </section>`;
        document.getElementById("retry-view").addEventListener("click", resolve);
      }
      return;
    }
  }

  setPageMetadata({ title: "Página no encontrada", noindex: true });
  document.getElementById("view").innerHTML =
    '<p class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-500">Página no encontrada.</p>';
}

export function navigate(path) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !isAppPath(url.pathname)) return;
  if (window.location.pathname + window.location.search !== url.pathname + url.search || window.location.hash) {
    window.history.pushState(null, "", url.pathname + url.search);
  }
  resolve();
}

export function initRouter() {
  window.addEventListener("hashchange", resolve);
  window.addEventListener("popstate", resolve);
  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.hash || !isAppPath(url.pathname)) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  resolve();
}
