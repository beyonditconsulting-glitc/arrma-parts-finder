import test from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  setCartQuantity,
  decodeCart,
  vendorCartCount,
  checkoutCapability,
} from "../src/cart.ts";
import { getJennyMatch } from "../src/integrations/jennys.ts";
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
  for (const vendor of ["Horizon Hobby", "eBay"]) {
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

test("Jenny transfer is available only for an entirely matched cart and preserves quantity", () => {
  const match = getJennyMatch("ARA310991");
  assert.ok(match?.available);
  const ready = checkoutCapability("Jenny’s RC", [
    { vendor: "Jenny’s RC", partId: match.catalogPartId, quantity: 2 },
  ]);
  assert.equal(ready.ready, true);
  assert.ok(ready.url.includes(`${match.variantId}:2`));
  assert.equal(new URL(ready.url).hostname, "jennysrc.com");
  const blocked = checkoutCapability("Jenny’s RC", [
    { vendor: "Jenny’s RC", partId: match.catalogPartId, quantity: 1 },
    { vendor: "Jenny’s RC", partId: "ARA320754", quantity: 1 },
  ]);
  assert.equal(blocked.ready, false);
  assert.equal(blocked.url, null);
  assert.ok(blocked.unmatched.some((row) => row.partId === "ARA320754"));
  assert.equal(checkoutCapability("Jenny’s RC").ready, false);
});
test("Jenny quote is attached only to a matched part and stays a dated snapshot", () => {
  const offer = vendorOffer("Jenny’s RC", null, "ARA310991");
  assert.equal(offer.status, "snapshot");
  assert.equal(offer.price.currency, "USD");
  assert.ok(offer.price.observedAt);
  assert.ok(offer.label.endsWith("observed"));
  assert.equal(
    vendorOffer("Jenny’s RC", null, "ARA320754").status,
    "not_connected",
  );
});
