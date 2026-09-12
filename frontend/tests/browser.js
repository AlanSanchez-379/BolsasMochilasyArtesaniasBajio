// Browser regression harness. Fixtures only: no accounts, API calls or real orders.
import { api } from "../src/js/api.js";
import { renderCategory } from "../src/js/views/category.js";
import { renderCart } from "../src/js/views/cart.js";
import { renderNavbar } from "../src/js/components/navbar.js";
import { renderProductDetail } from "../src/js/views/productDetail.js";
import { renderHome } from "../src/js/views/home.js";
import { state, cartTotal } from "../src/js/state.js";
import { route, initRouter } from "../src/js/router.js";

const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%23fce7f3'/%3E%3Cpath d='M90 150h220v220H90z' fill='%239d174d'/%3E%3Cpath d='M150 150V90h100v60' fill='none' stroke='%239d174d' stroke-width='20'/%3E%3C/svg%3E";
const product = { id: "fixture", slug: "bolso-artesanal", name: "Bolso artesanal", category_id: "bags", category: "Bolsas", subcategory: null, print_type: "YUTE", description: "Bolso artesanal con diseños florales.", price_normal: 195, price_medio: 185, price_wholesale: 175, price_super_wholesale: 165, medio_min_qty: 6, wholesale_min_qty: 12, super_wholesale_min_qty: 50, variants: [{ id: "blue", color: "Azul Lotería", sku: null, stock: 20, image_url: image }] };
api.getSettings = async () => ({ banner_url: image });
api.getCategories = async () => ({ categories: [{ name: "Bolsas" }] });
api.getProducts = async () => ({ products: [product] });
api.getBestsellers = async () => ({ products: [product] });
api.getProduct = async () => ({ product });
api.checkoutQuote = async (shipping, items) => {
  assert(shipping.postal_code === "37260", "Postal code is sent correctly");
  assert(items.length === 1, "Cart items are included in estimate");
  return { options: [{ label: "Envío", cost: 150, eta: "3–5 días" }] };
};
const view = document.getElementById("view");
const results = document.getElementById("results");
state.cart = [];
let checks = 0;
function assert(value, label) { if (!value) throw new Error(label); checks++; }
try {
  await renderCategory(view, "Todos", new URLSearchParams("q=monedero"));
  assert(view.textContent.includes("0 productos"), "Null subcategory search reaches empty result");
  const search = view.querySelector("#filter-search");
  search.value = "loteria";
  search.dispatchEvent(new Event("input"));
  assert(view.textContent.includes("1 producto"), "Accented variant search matches");
  assert(view.querySelector('a[href="#/producto/bolso-artesanal"]'), "Product is a native link");
  await renderNavbar(document.getElementById("navbar"));
  const menu = document.getElementById("mobile-menu-btn");
  menu.click();
  assert(menu.getAttribute("aria-expanded") === "true", "Mobile menu expanded state");
  menu.click();
  assert(menu.getAttribute("aria-expanded") === "false", "Mobile menu collapsed state");
  state.cart = [{ product: { ...product, is_on_sale: true, sale_price: 180 }, variant: product.variants[0], quantity: 1 }];
  assert(cartTotal() === 180, "Cart applies retail sale price");
  renderCart(view);
  view.querySelector("#shipping-estimate-postal").value = "37260";
  view.querySelector("#shipping-estimate-form").requestSubmit();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(view.querySelector("#shipping-estimate-result").textContent.includes("330.00"), "Guest shipping estimate includes subtotal");
  api.checkoutQuote = async () => { throw new Error("offline"); };
  view.querySelector("#shipping-estimate-form").requestSubmit();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(view.textContent.includes("No pudimos cotizar"), "Quote failure is recoverable");
  await renderProductDetail(view, product.slug);
  assert(!view.textContent.includes("null"), "Empty breadcrumb omitted");
  assert(document.title.includes(product.name), "Product title updated");
  assert(JSON.parse(document.getElementById("product-structured-data").textContent).offers.price === 195, "Product schema uses retail price");
  api.getProduct = async () => ({ product: { ...product, variants: [] } });
  await renderProductDetail(view, product.slug);
  assert(view.querySelector("#add-to-cart").disabled, "Missing variants cannot be purchased");
  api.getProduct = async () => ({ product });
  route("/", () => renderHome(view));
  route("/categoria/:name", ({ params, query }) => renderCategory(view, params.name, query));
  route("/producto/:slug", ({ params }) => renderProductDetail(view, params.slug));
  route("/carrito", () => renderCart(view));
  let failOnce = true;
  route("/test-error", async () => {
    if (failOnce) { failOnce = false; throw new Error("Expected test failure"); }
    await renderHome(view);
  });
  initRouter();
  results.textContent = `${checks} comprobaciones correctas. Vista con datos de prueba, sin conexión al catálogo real.`;
} catch (error) {
  results.textContent = `FALLO: ${error.message}`;
  console.error(error);
}
