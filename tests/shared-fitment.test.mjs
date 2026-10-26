import test from "node:test";
import assert from "node:assert/strict";
import { parts, searchParts } from "../src/catalog.ts";
import { mergeFitments } from "../scripts/merge-fitments.mjs";
test("known brace lists exact standard vehicles separately from optional upgrade vehicle", () => {
  const p = parts.find((p) => p.id === "ARA320754");
  assert.equal(
    p.fitments.find((row) => row.vehicleId === "ARA7704V3").relationship,
    "standard",
  );
  assert.equal(
    p.fitments.find((row) => row.vehicleId === "ARA8708V6").relationship,
    "standard",
  );
  assert.equal(
    p.fitments.find((row) => row.vehicleId === "ARA8608V6").relationship,
    "optional",
  );
  assert.equal(
    p.fitments.find((row) => row.vehicleId === "ARA8708T1").relationship,
    "standard",
  );
  assert.equal(p.fitments.length, 4);
  assert.ok(
    searchParts("ARA320754 ARA7704V3", "All vehicles").some(
      (row) => row.id === p.id,
    ),
  );
  const vehicle = p.vehicles.find((v) => v.includes("ARA7704V3"));
  assert.ok(searchParts("ARA320754", vehicle).some((row) => row.id === p.id));
});
test("manufacturer numbers are searchable without replacing source catalog identity", () => {
  const p = parts.find(
    (p) => p.manufacturerPartNumber && p.manufacturerPartNumber !== p.id,
  );
  assert.ok(p);
  assert.ok(
    searchParts(p.manufacturerPartNumber, "All vehicles").some(
      (row) => row.id === p.id,
    ),
  );
});
test("deduplicates only exact IDs; preserves revisions and conflicting standard/optional evidence", () => {
  const base = {
    vehicleId: "MODEL-V1",
    name: "Test vehicle",
    brand: "Test",
    relationship: "standard",
    sourceUrl: "https://example.com/one",
    sourceSha256: "a".repeat(64),
    observedAt: "2026-01-01T00:00:00Z",
    sourceLocator: "row1",
  };
  const merged = mergeFitments(base, [
    { ...base, relationship: "optional", sourceLocator: "row2" },
    { ...base, vehicleId: "MODEL-V2" },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(
    merged.find((r) => r.vehicleId === "MODEL-V1").relationship,
    "standard_and_optional",
  );
  assert.equal(
    merged.find((r) => r.vehicleId === "MODEL-V1").sources.length,
    2,
  );
  assert.throws(() => mergeFitments(base, [{ ...base, vehicleId: "" }]));
});
test("every displayed association has a source and no prices claim to be live", () => {
  for (const p of parts) {
    assert.equal(
      new Set(p.fitments.map((row) => row.vehicleId)).size,
      p.fitments.length,
    );
    for (const row of p.fitments) {
      assert.ok(row.sources.length > 0);
      assert.ok(
        row.sources.every(
          (s) =>
            s.url.startsWith("https://www.horizonhobby.com/") &&
            /^[a-f0-9]{64}$/.test(s.sha256),
        ),
      );
    }
    if (p.observedPrice) {
      assert.ok(Number.isSafeInteger(p.observedPrice.amountMinor));
      assert.equal(p.observedPrice.currency, "USD");
      assert.ok(p.observedPrice.observedAt);
    }
  }
});
