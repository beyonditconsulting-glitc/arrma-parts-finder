import test from "node:test";
import assert from "node:assert/strict";
import { scanDiagramText } from "../scripts/diagram-source-scan.mjs";
test("diagram scanner preserves exact model and part token identity without granting fitment verification", () => {
  const result = scanDiagramText(
    "ARA8708T1\nARA3207540\fAssembly callout ARA320754\f",
    "ARA8708T1",
    ["ARA320754", "ARA32075"],
  );
  assert.deepEqual(result.model_identity_pages, [1]);
  assert.deepEqual(result.part_number_hits, [
    { part_number: "ARA320754", pages: [2] },
  ]);
  assert.equal(result.model_identity_status, "exact_token_found");
  assert.equal(result.fitment_status, "pending_visual_review");
  assert.deepEqual(result.verified_fitments, []);
});
test("another generation or missing document identity remains unestablished", () => {
  const result = scanDiagramText("KRATON ARA8708V6\nARA320754", "ARA8708T1", [
    "ARA320754",
  ]);
  assert.equal(result.model_identity_status, "not_established");
  assert.equal(result.part_number_hits.length, 1);
  assert.equal(result.verified_fitments.length, 0);
  assert.throws(() => scanDiagramText("", "", ["ARA320754"]));
});
