import test from "node:test";
import assert from "node:assert/strict";
import {
  maintenanceSource,
  searchMaintenance,
  maintenancePlayerHtml,
  isMaintenancePlayerNavigationAllowed,
} from "../src/maintenance.ts";
import { extractMaintenance } from "../scripts/extract-maintenance.mjs";
test("library includes each official unique video once and preserves source entries and tool lists", () => {
  assert.equal(
    maintenanceSource.sourceUrl,
    "https://www.horizonhobby.com/hh-support-arrma/",
  );
  assert.equal(maintenanceSource.sourceEntryCount, 34);
  assert.equal(maintenanceSource.videos.length, 32);
  assert.equal(new Set(maintenanceSource.videos.map((v) => v.id)).size, 32);
  const shocks = searchMaintenance("6s shock", "Suspension");
  assert.ok(shocks.some((v) => v.id === "l_LSvNaPXMg"));
  const eight = maintenanceSource.videos.find((v) => v.id === "5N3Lcm1_SpU");
  assert.ok(eight.requiredItems.includes("500cst/40wt Shock Oil"));
  assert.ok(
    maintenanceSource.videos.every(
      (v) => /^[A-Za-z0-9_-]{11}$/.test(v.id) && v.sourceLocators.length,
    ),
  );
});
test("search combines source titles, descriptions and required tools without fabricating fitment", () => {
  assert.ok(searchMaintenance("6s diff", "Drivetrain").length > 0);
  assert.ok(searchMaintenance("500cst").some((v) => v.id === "5N3Lcm1_SpU"));
  assert.equal(searchMaintenance("unlikelyunmatchedtext").length, 0);
  assert.equal(searchMaintenance("diff", "Suspension").length, 0);
});
test("source extraction deduplicates reused clips and rejects missing source data", () => {
  const id = "12345678abc";
  const data = {
    __PRELOADED_STATE__: {
      __STATE_MANAGEMENT_LIBRARY: {
        store: {
          contentStore: {
            items: [
              {
                label: "Title one",
                youtube_video_id: id,
                inner_text: { type: "li", children: [{ text: "Hex driver" }] },
              },
              { label: "Title two", youtube_video_id: id },
            ],
          },
        },
      },
    },
  };
  const result = extractMaintenance(
    `<script id="mobify-data">${JSON.stringify(data)}</script>`,
    "2026-01-01T00:00:00Z",
  );
  assert.equal(result.sourceEntryCount, 2);
  assert.equal(result.videos.length, 1);
  assert.deepEqual(result.videos[0].sourceTitles, ["Title one", "Title two"]);
  assert.deepEqual(result.videos[0].requiredItems, ["Hex driver"]);
  assert.throws(() => extractMaintenance("<html/>", "2026-01-01T00:00:00Z"));
});
test("player accepts only exact source IDs and stays inside approved in-app navigation", () => {
  const html = maintenancePlayerHtml("5N3Lcm1_SpU");
  assert.ok(html.includes("www.youtube-nocookie.com"));
  assert.ok(html.includes("playsinline:1"));
  assert.ok(!html.includes("autoplay:1"));
  assert.throws(() => maintenancePlayerHtml("bad<script>"));
  assert.equal(
    isMaintenancePlayerNavigationAllowed(
      "https://www.youtube-nocookie.com/embed/5N3Lcm1_SpU",
    ),
    true,
  );
  assert.equal(isMaintenancePlayerNavigationAllowed("about:blank"), true);
  for (const bad of [
    "https://www.youtube.com.evil.example",
    "https://evil.example@www.youtube.com",
    "http://www.youtube.com",
    "intent://video",
    "https://example.com",
  ])
    assert.equal(isMaintenancePlayerNavigationAllowed(bad), false);
});
