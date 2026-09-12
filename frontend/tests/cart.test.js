import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { state, cartTotal, combinedQtyForProductLine } = await import("../src/js/state.js");
const product = { category_id: "bags", print_type: "YUTE", price_normal: 195, price_medio: 185, price_wholesale: 175, price_super_wholesale: 165, medio_min_qty: 6, wholesale_min_qty: 12, super_wholesale_min_qty: 50 };

test("volume combines variants and products only within the same category and print type", () => {
  state.cart = [
    { product, quantity: 3 },
    { product: { ...product, id: "another-bag" }, quantity: 3 },
    { product: { ...product, print_type: "ANIMADO" }, quantity: 5 },
    { product: { ...product, category_id: "backpacks" }, quantity: 5 },
    { product: { ...product, is_bundle: true }, quantity: 1 },
  ];
  assert.equal(combinedQtyForProductLine(product), 6);
  assert.equal(cartTotal(), 6 * 185 + 10 * 195 + 195);
});

test("multiple packages retain their configured package price", () => {
  state.cart = [{ product: { ...product, is_bundle: true }, quantity: 6 }];
  assert.equal(cartTotal(), 6 * 195);
});
