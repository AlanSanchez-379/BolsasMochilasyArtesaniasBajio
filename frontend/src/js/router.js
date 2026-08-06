const routes = [];

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

function currentPath() {
  const hash = window.location.hash.slice(1) || "/";
  return hash.split("?")[0] || "/";
}

function currentQuery() {
  const hash = window.location.hash.slice(1);
  const qIndex = hash.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : "");
}

async function resolve() {
  const path = currentPath();
  const query = currentQuery();

  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      window.scrollTo(0, 0);
      await r.handler({ params, query });
      return;
    }
  }

  document.getElementById("view").innerHTML =
    '<p class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-500">Página no encontrada.</p>';
}

export function navigate(path) {
  if (window.location.hash.slice(1) === path) {
    resolve();
  } else {
    window.location.hash = path;
  }
}

export function initRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
