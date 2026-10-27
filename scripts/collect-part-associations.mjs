import { readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const baseline = JSON.parse(
  readFileSync(
    new URL("database/discovery/kraton-ARA8708T1-parts.json", root),
    "utf8",
  ),
);
const records = [];
const failures = [];
for (const part of baseline.records) {
  try {
    const file = new URL(`database/evidence/part-pages/${part.id}.html`, root);
    const bytes = readFileSync(file);
    const html = bytes.toString("utf8");
    if (!html.includes("</html>"))
      throw Error("Truncated response: document closing tag missing");
    const match = html.match(
      /<script id="mobify-data"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!match) throw Error("Product state missing");
    const products = JSON.parse(match[1]).__PRELOADED_STATE__
      .__STATE_MANAGEMENT_LIBRARY.store.productStore.productsById;
    const product = products[part.id];
    if (!product || product.id !== part.id)
      throw Error("Exact catalog identity missing");
    const identities = [];
    for (const raw of html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      const data = JSON.parse(raw[1]);
      if (data["@type"] === "Product" && data.sku === part.id)
        identities.push(data);
    }
    const specNumbers = (product.specifications ?? []).flatMap(
      (group, index) => {
        const number = group.specs?.["Manufacturer #"];
        return typeof number === "string" && number.trim()
          ? [
              {
                number: number.trim(),
                locator: `mobify-data productStore.productsById[${part.id}].specifications[${index}].specs[Manufacturer #]`,
              },
            ]
          : [];
      },
    );
    const specValues = [...new Set(specNumbers.map((row) => row.number))];
    const jsonldNumbers = [
      ...new Set(
        identities
          .map((x) => x.mpn)
          .filter((x) => typeof x === "string" && x.trim()),
      ),
    ];
    const mpns = specValues.length ? specValues : jsonldNumbers;
    const parentItems = product.parentItems;
    if (
      parentItems !== undefined &&
      parentItems !== null &&
      !Array.isArray(parentItems)
    )
      throw Error("Invalid parentItems field");
    const sourceUrl = part.product_url;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const time = statSync(file).mtime.toISOString();
    const associations = (parentItems ?? []).map((p, index) => {
      if (typeof p.pid !== "string" || typeof p.productName !== "string")
        throw Error("Parent identity missing");
      const standard =
        p.fitmentStandard === true || p.fitmentType === "Standard Part";
      const optional =
        p.fitmentOptional === true || p.fitmentType === "Optional Part";
      return {
        vehicleId: p.pid,
        name: p.productName,
        brand: p.brand ?? p.manufacturer ?? "Unstated",
        relationship:
          standard && optional
            ? "standard_and_optional"
            : standard
              ? "standard"
              : optional
                ? "optional"
                : "listed",
        sourceUrl,
        sourceSha256: sha256,
        observedAt: time,
        sourceLocator: `mobify-data productStore.productsById[${part.id}].parentItems[${index}]`,
      };
    });
    const offers = identities.flatMap((x) =>
      Array.isArray(x.offers) ? x.offers : x.offers ? [x.offers] : [],
    );
    const candidates = offers
      .filter(
        (o) =>
          o.priceCurrency === "USD" &&
          (typeof o.price === "number" || typeof o.price === "string") &&
          /^\d+(\.\d{1,2})?$/.test(String(o.price)),
      )
      .map((o) => Math.round(Number(o.price) * 100));
    const amounts = [...new Set(candidates)];
    const price =
      amounts.length === 1 && Number.isSafeInteger(amounts[0])
        ? {
            amountMinor: amounts[0],
            currency: "USD",
            observedAt: time,
            sourceUrl,
          }
        : null;
    records.push({
      id: part.id,
      image: (() => {
        const image = product.images?.large?.[0];
        if (!image?.url) return null;
        const url = new URL(image.url);
        if (url.protocol !== "https:" || url.username || url.password)
          throw Error("Invalid product image URL");
        return {
          url: url.href,
          alt: image.alt || product.name,
          sourceUrl,
          sourceSha256: sha256,
          observedAt: time,
          sourceLocator: `mobify-data productStore.productsById[${part.id}].images.large[0]`,
        };
      })(),
      manufacturerPartNumber: mpns.length === 1 ? mpns[0] : null,
      manufacturerNumberEvidence: specNumbers.length
        ? specNumbers
        : identities.map((row) => ({
            number: row.mpn,
            locator: `JSON-LD Product sku=${part.id} mpn`,
          })),
      jsonldIdentity: identities.map((row) => ({ sku: row.sku, mpn: row.mpn })),
      parentItemsStatus:
        parentItems === undefined
          ? "missing"
          : parentItems === null
            ? "null"
            : parentItems.length
              ? "present"
              : "empty",
      associations,
      observedPrice: price,
      sourceUrl,
      sourceSha256: sha256,
      observedAt: time,
      sourceFile: `database/evidence/part-pages/${part.id}.html`,
      coverageNote:
        "Only explicit captured parentItems are listed. Missing associations do not imply exclusive fitment; optional parts are not original equipment.",
    });
  } catch (error) {
    failures.push({ id: part.id, error: error.message });
  }
}
const output = {
  schema_version: 1,
  dataset_type: "observed",
  expected_count: baseline.records.length,
  captured_count: records.length,
  records,
  failures,
  scope:
    "Exact part-page associations and USD price snapshots. Not independently diagram-verified, not exhaustive, and not live pricing.",
};
writeFileSync(
  new URL("database/discovery/part-associations.json", root),
  JSON.stringify(output, null, 2) + "\n",
);
console.log({
  captured: records.length,
  expected: baseline.records.length,
  associations: records.reduce((n, p) => n + p.associations.length, 0),
  failures,
});
if (failures.length) process.exitCode = 1;
