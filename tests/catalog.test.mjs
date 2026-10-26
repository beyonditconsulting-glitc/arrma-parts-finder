import test from "node:test";
import assert from "node:assert/strict";
import { searchParts, retailerUrl, parts } from "../src/catalog.ts";
test("search supports part number, name, brand and vehicle", () => {
  assert.equal(
    searchParts("ARA330654", "All vehicles")[0].name,
    "Front suspension arms",
  );
  assert.equal(searchParts("differential gear", "All vehicles").length, 1);
  assert.equal(
    searchParts("perfect pass", "All vehicles")[0].brand,
    "Perfect Pass",
  );
  assert.ok(searchParts("Typhon", "All vehicles").length > 0);
});
test("vehicle and category filters combine with search", () => {
  assert.equal(searchParts("servo", "Senton 3S").length, 0);
  assert.equal(searchParts("", "Kraton 6S", "Upgrades").length, 2);
  assert.equal(searchParts("nothing matches", "All vehicles").length, 0);
  assert.equal(searchParts("   FRONT   arms ", "Kraton 6S").length, 1);
});
test("retailer searches use catalog IDs or demo descriptions safely", () => {
  assert.equal(
    new URL(retailerUrl("eBay", parts[0])).searchParams.get("_nkw"),
    "ARA330654",
  );
  assert.equal(
    new URL(retailerUrl("Horizon Hobby", parts[3])).searchParams.get("q"),
    "M2C Aluminum chassis brace",
  );
  assert.equal(
    new URL(retailerUrl("Jenny’s RC", parts[0])).hostname,
    "jennysrc.com",
  );
});
