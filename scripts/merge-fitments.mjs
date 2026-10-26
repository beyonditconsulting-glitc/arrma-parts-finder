export function mergeFitments(primary, associations) {
  const rows = new Map();
  for (const row of [primary, ...associations]) {
    if (
      typeof row.vehicleId !== "string" ||
      !row.vehicleId ||
      typeof row.name !== "string" ||
      !["standard", "optional", "standard_and_optional", "listed"].includes(
        row.relationship,
      )
    )
      throw Error("Invalid explicit vehicle association");
    const source = {
      url: row.sourceUrl,
      sha256: row.sourceSha256,
      observedAt: row.observedAt,
      locator: row.sourceLocator,
    };
    const existing = rows.get(row.vehicleId);
    if (!existing)
      rows.set(row.vehicleId, {
        vehicleId: row.vehicleId,
        name: row.name,
        brand: row.brand,
        relationship: row.relationship,
        sources: [source],
      });
    else {
      const relations = [existing.relationship, row.relationship];
      if (
        relations.includes("standard_and_optional") ||
        (relations.includes("standard") && relations.includes("optional"))
      )
        existing.relationship = "standard_and_optional";
      else if (existing.relationship === "listed")
        existing.relationship = row.relationship;
      if (
        !existing.sources.some(
          (s) => s.sha256 === source.sha256 && s.locator === source.locator,
        )
      )
        existing.sources.push(source);
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.vehicleId.localeCompare(b.vehicleId),
  );
}
