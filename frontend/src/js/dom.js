import { navigate } from "./router.js";

export function bindNavLinks(container) {
  container.querySelectorAll("[data-nav]").forEach((el) => {
    if (el.tagName === "A") {
      el.setAttribute("href", el.dataset.nav);
      return; // Native links support keyboard, copying and opening another tab.
    }
    if (el.tagName !== "BUTTON") {
      el.setAttribute("role", "link");
      el.tabIndex = 0;
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target === el) navigate(el.dataset.nav);
      });
    }
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
}
