import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function exactToken(text, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, "i").test(text);
}
/** Text hits are review candidates, never automatic fitment verification. */
export function scanDiagramText(text, modelId, partNumbers) {
  if (
    typeof text !== "string" ||
    !modelId?.trim() ||
    !Array.isArray(partNumbers)
  )
    throw Error(
      "Expected diagram text, exact model ID and requested part numbers",
    );
  const pages = text.split("\f");
  const modelPages = pages.flatMap((page, index) =>
    exactToken(page, modelId) ? [index + 1] : [],
  );
  const hits = partNumbers
    .map((number) => {
      if (typeof number !== "string" || !number.trim())
        throw Error("Invalid part number");
      return {
        part_number: number,
        pages: pages.flatMap((page, index) =>
          exactToken(page, number) ? [index + 1] : [],
        ),
      };
    })
    .filter((hit) => hit.pages.length);
  return {
    model_id: modelId,
    model_identity_status: modelPages.length
      ? "exact_token_found"
      : "not_established",
    model_identity_pages: modelPages,
    page_count: pages.length - (pages.at(-1) === "" ? 1 : 0),
    part_number_hits: hits,
    fitment_status: "pending_visual_review",
    verified_fitments: [],
    limitation:
      "Exact text occurrence is not a compatibility verdict; visually inspect the assembly callout and exact document model identity before recording a verified fitment.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [pdf, modelId, partFile, output] = process.argv.slice(2);
  if (!pdf || !modelId || !partFile || !output)
    throw Error(
      "Usage: node scripts/diagram-source-scan.mjs diagram.pdf exact-model-id part-numbers.json output.json",
    );
  const bytes = readFileSync(pdf);
  if (bytes.subarray(0, 5).toString() !== "%PDF-")
    throw Error("Expected a PDF document, not a blocked HTML response");
  const text = execFileSync("pdftotext", ["-layout", pdf, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const result = scanDiagramText(
    text,
    modelId,
    JSON.parse(readFileSync(partFile, "utf8")),
  );
  writeFileSync(
    output,
    JSON.stringify(
      {
        ...result,
        pdf_sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log({
    model_id: modelId,
    candidate_parts: result.part_number_hits.length,
    fitment_status: result.fitment_status,
  });
}
