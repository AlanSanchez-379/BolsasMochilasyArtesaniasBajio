import { route, initRouter, onRouteChange } from "./router.js";
import { renderNavbar } from "./components/navbar.js";
import { renderFooter } from "./components/footer.js";
import { renderWhatsappFloat } from "./components/whatsappFloat.js";
import { renderHome } from "./views/home.js";
import { renderCategory } from "./views/category.js";
import { renderProductDetail } from "./views/productDetail.js";
import { renderCart } from "./views/cart.js";
import { renderCheckout } from "./views/checkout.js";
import { renderLogin } from "./views/login.js";
import { renderRegister } from "./views/register.js";
import { renderAuthCallback } from "./views/authCallback.js";
import { renderMyOrders } from "./views/myOrders.js";
import { renderAdmin } from "./views/admin/index.js";
import { subscribe, setCurrentUser } from "./state.js";
import { api } from "./api.js";
import { getCategories } from "./catalogCache.js";
import { getSettings } from "./settingsCache.js";

const root = document.getElementById("root");
root.innerHTML = `
  <div id="navbar-slot"></div>
  <main id="view"></main>
  <div id="footer-slot"></div>
  <div id="whatsapp-float-slot"></div>
`;

const navbarSlot = document.getElementById("navbar-slot");
const view = document.getElementById("view");
const footerSlot = document.getElementById("footer-slot");
const whatsappFloatSlot = document.getElementById("whatsapp-float-slot");
renderWhatsappFloat(whatsappFloatSlot);

// Se disparan de inmediato (no se esperan) para que, cuando la primera vista los pida,
// el fetch ya esté en curso o resuelto — así se evita el parpadeo de "Cargando..." en
// la primera pantalla que ve el usuario.
getCategories();
getSettings();

renderNavbar(navbarSlot);
renderFooter(footerSlot);
subscribe(() => renderNavbar(navbarSlot));

// El checkout no debe llevar footer (evita distracciones durante el pago).
onRouteChange((path) => {
  footerSlot.style.display = path === "/checkout" ? "none" : "";
});

route("/", () => renderHome(view));
route("/categoria/:name", ({ params }) => renderCategory(view, params.name));
route("/producto/:slug", ({ params }) => renderProductDetail(view, params.slug));
route("/carrito", () => renderCart(view));
route("/checkout", () => renderCheckout(view));
route("/login", () => renderLogin(view));
route("/registro", () => renderRegister(view));
route("/auth/callback", ({ query }) => renderAuthCallback(view, query));
route("/mis-pedidos", () => renderMyOrders(view));
route("/admin", () => renderAdmin(view));

// Antes de resolver la ruta inicial hay que saber si ya hay sesión (cookie), porque
// rutas como /admin o /checkout deciden qué mostrar según currentUser. Si el router
// arrancara primero, una recarga en una ruta protegida mostraría "Acceso restringido"
// aunque la sesión sí sea válida.
api
  .me()
  .then(({ user }) => setCurrentUser(user))
  .catch(() => {})
  .finally(() => initRouter());
