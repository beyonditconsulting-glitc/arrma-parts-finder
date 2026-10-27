/**
 * A photo is displayed only after its part number and right to display it have
 * been reviewed. The source page and usage evidence are kept with the record.
 * Do not infer photo URLs from a part number or from a vehicle name.
 */
export type PartImage = {
  partNumber: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  usageEvidence: string;
  permission: "approved" | "pending" | "denied";
};

// Intentionally empty until actual photographs and display rights are verified.
export const partImages: PartImage[] = [];

function safeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function selectPartImage(partNumber: string | null, candidates: readonly PartImage[] = partImages): PartImage | undefined {
  const number = partNumber?.trim().toUpperCase();
  if (!number) return undefined;
  return candidates.find((image) =>
    image.partNumber.trim().toUpperCase() === number &&
    image.permission === "approved" &&
    image.sourceName.trim().length > 0 &&
    image.usageEvidence.trim().length > 0 &&
    safeHttpsUrl(image.imageUrl) && safeHttpsUrl(image.sourceUrl),
  );
}
