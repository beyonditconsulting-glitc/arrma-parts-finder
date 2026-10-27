import { readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export function extractMaintenance(html, observedAt) {
  const match = html.match(
    /<script id="mobify-data"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) throw Error("Official support page content missing");
  const state = JSON.parse(match[1]);
  const entries = [];
  function walk(node, path = "") {
    if (Array.isArray(node)) {
      node.forEach((row, index) => walk(row, `${path}/${index}`));
      return;
    }
    if (!node || typeof node !== "object") return;
    if (
      typeof node.label === "string" &&
      /^[A-Za-z0-9_-]{11}$/.test(node.youtube_video_id ?? "")
    )
      entries.push({ path, node });
    for (const [key, value] of Object.entries(node))
      walk(value, `${path}/${key}`);
  }
  walk(
    state.__PRELOADED_STATE__?.__STATE_MANAGEMENT_LIBRARY?.store?.contentStore,
  );
  function words(node) {
    if (Array.isArray(node)) return node.map(words).join(" ");
    if (!node || typeof node !== "object") return "";
    return [
      typeof node.text === "string" ? node.text : "",
      words(node.children),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function tools(node, result = []) {
    if (Array.isArray(node)) node.forEach((row) => tools(row, result));
    else if (node && typeof node === "object") {
      if (node.type === "li") {
        const text = words(node);
        if (text) result.push(text);
      } else tools(node.children, result);
    }
    return result;
  }
  function category(title) {
    if (/shock|suspension/i.test(title)) return "Suspension";
    if (/\bdiff\b|gear ratio|pinion/i.test(title)) return "Drivetrain";
    if (
      /servo|esc\b|motor|bind|transmitter|electronic|lipo|nimh|avc/i.test(title)
    )
      return "Electronics";
    if (/wheel|tires|tyres|body|hoons/i.test(title)) return "Body & wheels";
    return "Setup";
  }
  const byId = new Map();
  for (const { path, node } of entries) {
    const id = node.youtube_video_id;
    const existing = byId.get(id) ?? {
      id,
      title: node.label,
      description: node.video_headline ?? "",
      category: category(node.label),
      sourceTitles: [],
      requiredItems: [],
      sourceLocators: [],
    };
    existing.sourceTitles = [
      ...new Set([...existing.sourceTitles, node.label]),
    ];
    existing.requiredItems = [
      ...new Set([...existing.requiredItems, ...tools(node.inner_text)]),
    ];
    existing.sourceLocators.push(path);
    byId.set(id, existing);
  }
  if (!byId.size) throw Error("No source-listed videos found");
  return {
    sourceUrl: "https://www.horizonhobby.com/hh-support-arrma/",
    sourceSha256: createHash("sha256").update(html).digest("hex"),
    observedAt,
    sourceEntryCount: entries.length,
    videos: [...byId.values()],
    note: "Official support-page references. Video availability, embedding permission and model applicability are controlled by the publisher; not independently verified maintenance advice.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, output = "src/data/maintenance.js"] = process.argv.slice(2);
  if (!input)
    throw Error(
      "Usage: node scripts/extract-maintenance.mjs support-page.html output.js",
    );
  const data = extractMaintenance(
    readFileSync(input, "utf8"),
    statSync(input).mtime.toISOString(),
  );
  writeFileSync(
    output,
    "// Source-listed Horizon Hobby ARRMA support videos; no media files are rehosted.\nconst maintenance = " +
      JSON.stringify(data, null, 2) +
      ";\nexport default maintenance;\n",
  );
  console.log(
    `${data.videos.length} unique videos from ${data.sourceEntryCount} source entries`,
  );
}
