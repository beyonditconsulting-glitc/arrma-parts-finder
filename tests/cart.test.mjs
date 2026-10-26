import test from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  setCartQuantity,
  decodeCart,
  vendorCartCount,
  checkoutCapability,
  vendors,
} from "../src/cart.ts";
import { vendorOffer, displayObservedPrice } from "../src/offers.ts";
test("same item is independently stored in each vendor cart; repeat add changes only that quantity", () => {
  let cart = addToCart([], "eBay", "ARA320754");
  cart = addToCart(cart, "Jenny’s RC", "ARA320754");
  cart = addToCart(cart, "eBay", "ARA320754");
  assert.equal(vendorCartCount(cart, "eBay"), 2);
  assert.equal(vendorCartCount(cart, "Jenny’s RC"), 1);
  assert.equal(vendorCartCount(cart, "Horizon Hobby"), 0);
  cart = setCartQuantity(cart, "eBay", "ARA320754", 0);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].vendor, "Jenny’s RC");
});
test("cart serializes and restores exact vendor, item and quantity", () => {
  const cart = addToCart([], "Horizon Hobby", "ARA320754");
  assert.deepEqual(
    decodeCart(JSON.stringify(cart), new Set(["ARA320754"])),
    cart,
  );
  assert.throws(() => decodeCart(JSON.stringify(cart), new Set(["different"])));
  assert.throws(() =>
    decodeCart(JSON.stringify([...cart, ...cart]), new Set(["ARA320754"])),
  );
  assert.throws(() => setCartQuantity(cart, "eBay", "ARA320754", 1.5));
  assert.throws(() => setCartQuantity(cart, "eBay", "ARA320754", 100));
});
test("disconnected checkout can never imply a vendor cart transfer", () => {
  for (const vendor of vendors) {
    assert.equal(checkoutCapability(vendor).ready, false);
    assert.ok(checkoutCapability(vendor).reason.includes("in this app only"));
  }
});
test("snapshot cannot masquerade as live three-vendor comparison or zero price", () => {
  const price = {
    amountMinor: 1899,
    currency: "USD",
    observedAt: "2026-10-26T00:00:00Z",
    sourceUrl: "https://www.horizonhobby.com/product/ARA320754.html",
  };
  assert.equal(vendorOffer("Horizon Hobby", price).status, "snapshot");
  assert.equal(displayObservedPrice(price), "$18.99 observed");
  for (const vendor of ["eBay", "Jenny’s RC"]) {
    assert.equal(vendorOffer(vendor, price).price, null);
    assert.equal(vendorOffer(vendor, price).label, "Price unavailable");
  }
  assert.equal(displayObservedPrice(null), "Price unavailable");
});
