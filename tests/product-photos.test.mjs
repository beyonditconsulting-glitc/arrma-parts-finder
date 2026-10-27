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
test("unmatched parts do not retry a denied Horizon CDN or borrow an unrelated Jenny photo", () => {
  const part = parts.find((p) => p.id === "ARA320754");
  assert.ok(
    part.image,
    "Captured Horizon metadata remains available for provenance",
  );
  assert.equal(productPhoto(part), null);
});
test("Jenny photo coverage matches exact product identities and never silently broadens to all parts", () => {
  const count = parts.filter(
    (p) => productPhoto(p)?.publisher === "Jenny’s RC",
  ).length;
  assert.equal(count, jennyCoverage.matchedParts);
  assert.ok(count < parts.length);
});

test("bundled exact photos have intact bytes and matching source image identity", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        "../database/discovery/bundled-product-photos.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(manifest.photos.length, jennyCoverage.matchedParts);
  for (const entry of manifest.photos) {
    const bytes = readFileSync(
      new URL("../" + entry.relativePath, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.assetSha256,
    );
    const part = parts.find((p) => p.id === entry.catalogPartId);
    assert.equal(productPhoto(part).url, entry.sourceImageUrl);
    assert.ok(bytes.length > 1000);
    assert.ok(
      (bytes[0] === 0xff && bytes[1] === 0xd8) ||
        (bytes[0] === 0x89 && bytes[1] === 0x50),
    );
  }
});
