import { route, initRouter } from "./router.js";
import { renderNavbar } from "./components/navbar.js";
import { renderFooter } from "./components/footer.js";
import { renderHome } from "./views/home.js";
import { renderPlaceholder } from "./views/placeholder.js";
import { subscribe } from "./state.js";

const root = document.getElementById("root");
root.innerHTML = `
  <div id="navbar-slot"></div>
  <main id="view"></main>
  <div id="footer-slot"></div>
`;

const navbarSlot = document.getElementById("navbar-slot");
const view = document.getElementById("view");
const footerSlot = document.getElementById("footer-slot");

renderNavbar(navbarSlot);
renderFooter(footerSlot);
subscribe(() => renderNavbar(navbarSlot));

route("/", () => renderHome(view));
route("/categoria/:name", ({ params }) => renderPlaceholder(view, `Categoría: ${params.name}`));
route("/producto/:slug", ({ params }) => renderPlaceholder(view, `Producto: ${params.slug}`));
route("/carrito", () => renderPlaceholder(view, "Carrito"));

initRouter();
