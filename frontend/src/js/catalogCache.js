import { api } from "./api.js";

// Categorías y subcategorías casi no cambian: se piden una sola vez por sesión y se
// comparten entre Navbar, Home, Categoría y el admin, en vez de que cada vista repita
// el mismo fetch.
let categoriesPromise = null;

export function getCategories() {
  if (!categoriesPromise) categoriesPromise = api.getCategories();
  return categoriesPromise;
}

export function invalidateCategoriesCache() {
  categoriesPromise = null;
}

// Stale-while-revalidate genérico: si ya hay una respuesta previa para `key`, la
// devuelve de inmediato (para pintar sin pantalla de "Cargando...") mientras
// revalida en segundo plano. La primera vez para cada key no hay datos previos,
// así que la vista debe mostrar su propio estado de carga hasta que `promise` resuelva.
const lastKnown = new Map();

export function getCachedOrFetch(key, fetcher) {
  const data = lastKnown.has(key) ? lastKnown.get(key) : null;
  const promise = fetcher().then((result) => {
    lastKnown.set(key, result);
    return result;
  });
  return { data, promise };
}
