import type { Part } from "./catalog";
import { getJennyMatch } from "./integrations/jennys.ts";
export function productPhoto(part: Part) {
  const match = getJennyMatch(part.id);
  if (
    match?.image &&
    match.matchStatus === "retailer_reported_exact_number" &&
    [part.id, part.manufacturerPartNumber].includes(match.matchedNumber) &&
    match.image.shopifyProductId === match.shopifyProductId
  ) {
    return {
      ...match.image,
      publisher: "Jenny’s RC",
      sourceUrl: match.productUrl,
      sourceSha256: match.sourceSha256,
      observedAt: match.observedAt,
      note: "Take-off listing; contents and packaging should be checked before purchase.",
    };
  }
  return part.image
    ? {
        ...part.image,
        publisher: "Horizon Hobby",
        note: "No exact Jenny’s product photo matched.",
      }
    : null;
}
