import { route, initRouter } from "./router.js";
import { renderNavbar } from "./components/navbar.js";
import { renderFooter } from "./components/footer.js";
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
