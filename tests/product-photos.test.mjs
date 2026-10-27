import test from "node:test";
import assert from "node:assert/strict";
import { parts } from "../src/catalog.ts";
import { productPhoto } from "../src/productPhotos.ts";
import { getJennyMatch, jennyCoverage } from "../src/integrations/jennys.ts";
test("prefers an exact Jenny product photo and retains image product and source provenance", () => {
  const part = parts.find((p) => p.id === "ARA310991");
  const photo = productPhoto(part);
  const match = getJennyMatch(part.id);
  assert.equal(photo.publisher, "Jenny’s RC");
  assert.equal(photo.url, match.image.url);
  assert.equal(photo.sourceSha256, match.sourceSha256);
  assert.equal(photo.sourceUrl, match.productUrl);
  assert.equal(photo.shopifyProductId, match.shopifyProductId);
});
test("unmatched parts retain a labeled fallback rather than an unrelated Jenny photo", () => {
  const part = parts.find((p) => p.id === "ARA320754");
  const photo = productPhoto(part);
  assert.equal(photo.publisher, "Horizon Hobby");
  assert.equal(photo.url, part.image.url);
  assert.ok(photo.note.includes("No exact Jenny"));
  assert.equal(productPhoto({ ...part, image: null }), null);
});
test("Jenny photo coverage matches exact product identities and never silently broadens to all parts", () => {
  const count = parts.filter(
    (p) => productPhoto(p)?.publisher === "Jenny’s RC",
  ).length;
  assert.equal(count, jennyCoverage.matchedParts);
  assert.ok(count < parts.length);
});
