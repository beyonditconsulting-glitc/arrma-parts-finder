import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  searchParts,
  retailerUrl,
  parts,
  catalogVehicle,
  vehicles,
} from "../src/catalog.ts";
const source = JSON.parse(
  readFileSync(
    new URL(
      "../database/discovery/kraton-ARA8708T1-parts.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("mobile catalog contains every sourced entry exactly once and no demo records", () => {
  assert.equal(parts.length, 210);
  assert.deepEqual(
    parts.map((p) => p.id),
    source.records.map((p) => p.id),
  );
  assert.equal(new Set(parts.map((p) => p.id)).size, 210);
  assert.ok(parts.every((p) => !p.id.endsWith("DEMO") && !("prices" in p)));
  for (const p of parts) {
    const original = source.records.find((r) => r.id === p.id);
    assert.equal(p.name, original.name);
    assert.equal(p.brand, original.brand);
    assert.equal(p.pricingStatus, "unknown");
    assert.equal(p.fitmentStatus, "retailer-listed");
    const page = source.pages.find((page) => page.record_ids.includes(p.id));
    assert.equal(p.provenance.sourceSha256, page.sha256);
    assert.equal(p.provenance.sourceUrl, page.source_url);
    assert.equal(p.provenance.observedAt, page.retrieved_at);
    assert.deepEqual(p.vehicles, [catalogVehicle]);
  }
});
test("search finds exact IDs, names, vehicle ID and combined filters", () => {
  assert.equal(
    searchParts("ARA320754", catalogVehicle)[0].name,
    "ARRMA Aluminum Rear Brace V2",
  );
  assert.ok(
    searchParts("front brace", "All vehicles").some(
      (p) => p.id === "ARA320756",
    ),
  );
  assert.equal(searchParts("ARA8708T1", "All vehicles").length, 210);
  assert.ok(searchParts("spektrum", "All vehicles").length > 0);
  assert.equal(searchParts("brace", catalogVehicle, "Electronics").length, 0);
  assert.ok(searchParts("brace", catalogVehicle, "Chassis & body").length > 0);
  assert.equal(searchParts("nothingmatches", "All vehicles").length, 0);
  assert.equal(searchParts("", catalogVehicle, "Upgrades").length, 0);
});
test("fitment does not spread to other models or imply confirmed V2 alias", () => {
  assert.equal(searchParts("", "Kraton 6S EXB V2").length, 0);
  assert.equal(searchParts("", "Typhon 6S").length, 0);
  assert.deepEqual(vehicles, ["All vehicles", catalogVehicle]);
});
test("retailer actions distinguish source product link from unverified searches", () => {
  const p = parts.find((p) => p.id === "ARA320754");
  assert.equal(retailerUrl("Horizon Hobby", p), p.provenance.productUrl);
  assert.equal(new URL(retailerUrl("eBay", p)).searchParams.get("_nkw"), p.id);
  assert.equal(
    new URL(retailerUrl("Jenny’s RC", p)).searchParams.get("q"),
    p.id,
  );
});
