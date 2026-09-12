import test from "node:test";
import assert from "node:assert/strict";
import { matchesProductSearch } from "../src/js/catalogFilters.js";
import { priceForQuantity } from "../src/js/pricing.js";
import { productCardHtml } from "../src/js/components/productCard.js";

const product = {
  id: "test-bag", slug: "bolso", name: "Bolso artesanal", category: "Bolsas", subcategory: null,
  description: null, variants: [{ stock: 20, color: "Azul Lotería", sku: null }],
  price_normal: 195, price_medio: 185, price_wholesale: 175, price_super_wholesale: 165,
  medio_min_qty: 6, wholesale_min_qty: 12, super_wholesale_min_qty: 50,
};

test("searching an unrelated term handles null subcategories without throwing", () => {
  assert.equal(matchesProductSearch(product, "monedero"), false);
});
test("empty optional fields and variant arrays are searchable", () => {
  assert.equal(matchesProductSearch({ name: "Monedero", variants: null }, "monedero"), true);
  assert.equal(matchesProductSearch({}, ""), true);
  assert.equal(matchesProductSearch({}, "azul"), false);
});
test("search matches multiple fields and ignores accents and case", () => {
  assert.equal(matchesProductSearch(product, " BOLSO loteria AZUL "), true);
  assert.equal(matchesProductSearch(product, "bolso rojo"), false);
});
test("all tier boundaries use configured quantities", () => {
  for (const [qty, expected] of [[1,195],[5,195],[6,185],[11,185],[12,175],[49,175],[50,165]]) {
    assert.equal(priceForQuantity(product, qty), expected);
  }
});
test("sale price matches backend precedence, without overriding volume tiers", () => {
  const sale = { ...product, is_on_sale: true, sale_price: 180 };
  assert.equal(priceForQuantity(sale, 1), 180);
  assert.equal(priceForQuantity(sale, 6), 185);
  assert.equal(priceForQuantity(sale, 12), 175);
  assert.equal(priceForQuantity({ ...sale, sale_price: null }, 1), 195);
});
test("cards disclose retail and minimum wholesale quantity, without fake markdown", () => {
  const html = productCardHtml(product);
  assert.match(html, /195\.00/);
  assert.match(html, /175\.00/);
  assert.match(html, /desde 12 piezas de la misma línea/);
  assert.doesNotMatch(html, /line-through/);
  assert.match(html, /<a href="\/producto\/bolso"/);
});
test("empty stock and names containing markup render safely", () => {
  const html = productCardHtml({ ...product, name: '<script>"test"</script>', variants: null });
  assert.match(html, /AGOTADO/);
  assert.doesNotMatch(html, /<script>/);
});
test("package card shows a package price, not a per-piece wholesale offer", () => {
  const html = productCardHtml({ ...product, is_bundle: true });
  assert.match(html, /Por paquete/);
  assert.doesNotMatch(html, /desde 12 piezas/);
});
