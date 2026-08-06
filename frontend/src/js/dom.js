import { navigate } from "./router.js";

export function bindNavLinks(container) {
  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
}
