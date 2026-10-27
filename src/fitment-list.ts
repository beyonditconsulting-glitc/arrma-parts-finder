import type { Fitment } from "./catalog";

export const FITMENT_PAGE_SIZE = 5;
const definitions = [
  { key: "standard", label: "Standard replacement — retailer-listed" },
  { key: "optional", label: "Optional upgrade — not original equipment" },
  { key: "other", label: "Other or mixed associations — check fitment" },
] as const;
function groupKey(row: Fitment) {
  return row.relationship === "standard" || row.relationship === "optional"
    ? row.relationship
    : "other";
}

/** Order explicit associations before pagination; never broaden a source model ID. */
export function fitmentPage(
  fitments: Fitment[],
  primaryVehicleId: string,
  query = "",
  requestedPage = 0,
) {
  const other = fitments.filter((row) => row.vehicleId !== primaryVehicleId);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups = definitions.map((definition) => {
    const all = other.filter((row) => groupKey(row) === definition.key);
    const matches = all
      .filter((row) => {
        const text = `${row.name} ${row.vehicleId} ${row.brand}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      })
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.vehicleId.localeCompare(b.vehicleId),
      );
    return {
      ...definition,
      totalCount: all.length,
      matchCount: matches.length,
      rows: matches,
    };
  });
  const matches = groups.flatMap((group) => group.rows);
  const pageCount = Math.ceil(matches.length / FITMENT_PAGE_SIZE);
  const page = Number.isSafeInteger(requestedPage)
    ? Math.max(0, Math.min(requestedPage, Math.max(0, pageCount - 1)))
    : 0;
  const start = page * FITMENT_PAGE_SIZE;
  const visibleIds = new Set(
    matches.slice(start, start + FITMENT_PAGE_SIZE).map((row) => row.vehicleId),
  );
  return {
    otherCount: other.length,
    matchCount: matches.length,
    page,
    pageCount,
    start: matches.length ? start + 1 : 0,
    end: Math.min(start + FITMENT_PAGE_SIZE, matches.length),
    groups: groups.map((group) => ({
      ...group,
      rows: group.rows.filter((row) => visibleIds.has(row.vehicleId)),
    })),
  };
}
