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

test("shared lists group all matches before taking the compact five-row page", async () => {
  const { fitmentPage, FITMENT_PAGE_SIZE } =
    await import("../src/fitment-list.ts");
  const source = {
    url: "https://example.com/source",
    sha256: "a".repeat(64),
    observedAt: "2026-01-01T00:00:00Z",
    locator: "fixture",
  };
  const row = (id, relationship, name = id) => ({
    vehicleId: id,
    name,
    brand: "Test",
    relationship,
    sources: [source],
  });
  const fitments = [
    row("primary", "standard"),
    ...Array.from({ length: 7 }, (_, i) =>
      row(`OPTION-${i}`, "optional", `A optional ${i}`),
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      row(`STANDARD-${i}`, "standard", `Z standard ${i}`),
    ),
  ];
  const first = fitmentPage(fitments, "primary");
  assert.equal(FITMENT_PAGE_SIZE, 5);
  assert.equal(first.otherCount, 13);
  assert.equal(first.groups[0].matchCount, 6);
  assert.equal(first.groups[1].matchCount, 7);
  assert.equal(first.groups[0].rows.length, 5);
  assert.equal(first.groups[1].rows.length, 0);
  const all = Array.from({ length: first.pageCount }, (_, page) =>
    fitmentPage(fitments, "primary", "", page),
  );
  assert.deepEqual(
    all.map((page) => page.groups.flatMap((group) => group.rows).length),
    [5, 5, 3],
  );
  const ids = all.flatMap((page) =>
    page.groups.flatMap((group) => group.rows.map((row) => row.vehicleId)),
  );
  assert.equal(ids.length, 13);
  assert.equal(new Set(ids).size, 13);
  assert.equal(
    ids.some((id) => id === "primary"),
    false,
  );
  assert.equal(
    fitments[1].vehicleId,
    "OPTION-0",
    "presentation must not mutate source ordering",
  );
});

test("mixed evidence stays separate and exact version/color/successor IDs remain distinct", async () => {
  const { fitmentPage } = await import("../src/fitment-list.ts");
  const fitments = [
    {
      vehicleId: "MODEL-V1T1",
      name: "Test red",
      brand: "Test",
      relationship: "standard",
      sources: [],
    },
    {
      vehicleId: "MODEL-V1T2",
      name: "Test blue",
      brand: "Test",
      relationship: "standard",
      sources: [],
    },
    {
      vehicleId: "MODEL-V2",
      name: "Test successor",
      brand: "Test",
      relationship: "standard_and_optional",
      sources: [],
    },
    {
      vehicleId: "MODEL-V3",
      name: "Test listed",
      brand: "Test",
      relationship: "listed",
      sources: [],
    },
  ];
  const result = fitmentPage(fitments, "MODEL-V1T1");
  assert.equal(result.otherCount, 3);
  assert.deepEqual(
    result.groups.map((g) => g.matchCount),
    [1, 0, 2],
  );
  assert.deepEqual(result.groups[2].rows.map((r) => r.relationship).sort(), [
    "listed",
    "standard_and_optional",
  ]);
  assert.deepEqual(
    fitmentPage(fitments, "MODEL-V1T1", "test MODEL-V1T2").groups.flatMap((g) =>
      g.rows.map((r) => r.vehicleId),
    ),
    ["MODEL-V1T2"],
  );
  assert.equal(
    fitmentPage(fitments, "MODEL-V1T1", "MODEL-V4").matchCount,
    0,
    "an unlisted successor must not be inferred",
  );
});

test("shared vehicle filters match independent terms and clamp pages safely", async () => {
  const { fitmentPage } = await import("../src/fitment-list.ts");
  const p = parts.find((part) => part.id === "ARA320754");
  const result = fitmentPage(
    p.fitments,
    p.provenance.vehicleId,
    "  ARA7704V3   ARRMA ",
    99,
  );
  assert.equal(result.matchCount, 1);
  assert.equal(result.page, 0);
  assert.deepEqual(
    result.groups.flatMap((g) => g.rows.map((row) => row.vehicleId)),
    ["ARA7704V3"],
  );
  const empty = fitmentPage(
    p.fitments,
    p.provenance.vehicleId,
    "not-a-source-model",
    99,
  );
  assert.equal(empty.pageCount, 0);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.equal(empty.groups.flatMap((g) => g.rows).length, 0);
});

test("every captured other-model association is reachable in compact pages without extra inferred vehicles", async () => {
  const { fitmentPage } = await import("../src/fitment-list.ts");
  for (const part of parts) {
    const first = fitmentPage(part.fitments, part.provenance.vehicleId);
    const expected = part.fitments
      .filter((row) => row.vehicleId !== part.provenance.vehicleId)
      .map((row) => row.vehicleId)
      .sort();
    const actual = [];
    for (let i = 0; i < first.pageCount; i++) {
      const page = fitmentPage(part.fitments, part.provenance.vehicleId, "", i);
      const rows = page.groups.flatMap((group) => group.rows);
      assert.ok(rows.length <= 5);
      actual.push(...rows.map((row) => row.vehicleId));
    }
    assert.deepEqual(actual.sort(), expected, part.id);
    assert.equal(
      first.groups.reduce((sum, group) => sum + group.matchCount, 0),
      expected.length,
    );
  }
});
